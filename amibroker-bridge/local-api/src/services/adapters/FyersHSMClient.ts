
function isMarketOpen() {
  const d = new Date()
  const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short' } as any
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(d)
  let hour = 0, min = 0, weekday = ''
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10)
    if (part.type === 'minute') min = parseInt(part.value, 10)
    if (part.type === 'weekday') weekday = part.value
  }
  if (weekday === 'Sat' || weekday === 'Sun') return false
  const time = hour * 100 + min
  return time >= 900 && time <= 2355
}

import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface HSMMappedTick {
  instrumentId: string // e.g. NSE:BRITANNIA-EQ
  lastPrice: number
  volume: number
  timestamp: number
  open?: number
  high?: number
  low?: number
  prevClose?: number
  updateType: 'snapshot' | 'live'
}

const DATA_FIELDS = [
  "ltp",
  "vol_traded_today",
  "last_traded_time",
  "exch_feed_time",
  "bid_size",
  "ask_size",
  "bid_price",
  "ask_price",
  "last_traded_qty",
  "tot_buy_qty",
  "tot_sell_qty",
  "avg_trade_price",
  "low_circuit",
  "high_circuit"
]

const INDEX_FIELDS = [
  "ltp",
  "high_price",
  "low_price",
  "open_price",
  "prev_close_price",
  "exch_feed_time"
]

export class FyersHSMClient extends EventEmitter {
  private ws: WebSocket | null = null
  private hsmKey: string = ''
  private accessToken: string
  private isConnecting = false
  public authenticated = false
  private pendingSubscriptions = new Set<string>()
  private activeSubscriptions = new Set<string>()
  
  private symbolMappings = new Map<string, string>() // HSM token -> DataBridge Ticker (e.g., sf|nse_cm|16921 -> NSE:BRITANNIA-EQ)
  private reverseMappings = new Map<string, string>() // DataBridge Ticker -> HSM token

  private subscriptions = new Map<number, string>() // topic_id -> HSM token
  private scripsData = new Map<number, any>() // topic_id -> normalized snapshot
  private indexData = new Map<number, any>() // topic_id -> normalized snapshot

  // Dedup state: token -> { ltp, timestamp }
  private lastTickState = new Map<string, { ltp: number, time: number }>()

  private lastMessageTime = 0
  private watchdogTimer: NodeJS.Timeout | null = null

  private tickQueue: HSMMappedTick[] = []
  private isProcessingQueue = false
  private lastTickLogTime = 0

  private tickStats = new Map<string, { ticks: number, lastTime: number }>()
  private statsTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null

  private hsmUrl = "wss://socket.fyers.in/hsm/v1-5/prod"
  private source = "DataBridgePro"
  private reconnectAttempts = 0

  constructor(accessToken: string) {
    super()
    this.accessToken = accessToken

            this.statsTimer = setInterval(() => {
      if (!this.authenticated) return
      
      const receiving: string[] = []
      const notReceiving: string[] = []
      const subbed = Array.from(this.subscriptions.values()).map(h => this.symbolMappings.get(h)).filter(Boolean) as string[]
      
      for (const sym of subbed) {
        if (this.tickStats.has(sym)) {
          receiving.push(sym)
        } else {
          notReceiving.push(sym)
        }
      }
      
      console.log(`[System Status] Total Symbols Active: ${subbed.length} | Receiving Live Ticks: ${receiving.length}`)
      if (notReceiving.length > 0) {
        console.log(`[Warning] No Live Data for: ${notReceiving.slice(0, 10).join(',')}...`)
      }

    }, 30000)

  }

  private extractHsmKey(): boolean {
    try {
      const token = this.accessToken.includes(':') ? this.accessToken.split(':')[1] : this.accessToken
      const parts = token.split('.')
      if (parts.length !== 3) return false
      
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8')
      const payload = JSON.parse(payloadJson)
      
      if (payload.hsm_key) {
        const expTime = payload.exp || 0
        const currentTime = Math.floor(Date.now() / 1000)
        if (expTime < currentTime) {
          this.emitLog('error', 'Token expired.')
          return false
        }
        this.hsmKey = payload.hsm_key
        return true
      }
    } catch (e: any) {
      this.emitLog('error', `Failed to parse token: ${e.message}`)
    }
    return false
  }

  private emitLog(level: string, message: string) {
    console.log(message)
    this.emit('log_entry', { level, component: 'FyersHSM', message })
  }

  public setSymbolMapping(dbTicker: string, hsmToken: string) {
    this.symbolMappings.set(hsmToken, dbTicker)
    this.reverseMappings.set(dbTicker, hsmToken)
  }

  public connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) return
    
    if (!this.hsmKey && !this.extractHsmKey()) {
      this.emit('auth_failed')
      return
    }

    this.isConnecting = true
    this.emitLog('info', '[FYERS_HSM_STATUS] starting')
    this.emitLog('info', `[FYERS_HSM_CONNECT] Connecting to ${this.hsmUrl}...`)
    
    this.ws = new WebSocket(this.hsmUrl)
    this.ws.binaryType = 'nodebuffer'

    this.ws.on('open', () => {
      this.isConnecting = false
      this.reconnectAttempts = 0
      this.emitLog('info', '[FYERS_HSM_CONNECT] Connected.')
      this.emitLog('info', '[FYERS_HSM_STATUS] connected')
      this.authenticate()
    })

    this.ws.on('message', (data: Buffer) => {
      this.lastMessageTime = Date.now()
      this.parseBinaryMessage(data)
    })

    this.ws.on('close', () => {
      this.isConnecting = false
      this.authenticated = false
      console.log('[FYERS_HSM_CONNECT] Disconnected. Scheduling reconnect...')
      
      // BUG #8 FIX: Re-queue active subscriptions — but do NOT clear symbolMappings!
      // symbolMappings (HSM token -> ticker) must survive reconnect or ticks will be dropped
      // after re-authentication because queueNormalizedTick won't find the dbTicker.
      this.activeSubscriptions.forEach(t => this.pendingSubscriptions.add(t))
      
      // Only trigger reconnect if not already scheduled (prevent double reconnect from watchdog)
      if (!this.reconnectTimer) {
        if (this.activeSubscriptions.size === 0 && this.pendingSubscriptions.size === 0) {
          console.log('[FYERS_HSM_CONNECT] No active subscriptions. Halting reconnect loop until new symbols are added.')
        } else {
          this.triggerReconnect()
        }
      }
    })

    this.ws.on('error', (err) => {
      const msg = err?.message || err?.toString() || 'Unknown error'
      this.emitLog('error', `[FYERS_HSM_CONNECT] Socket error: ${msg}`)
    })

    this.startWatchdog()
  }

  public disconnect() {
    this.stopWatchdog()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.close()
      this.ws = null
    }
    this.isConnecting = false
    this.authenticated = false
  }

  private triggerReconnect() {
    this.stopWatchdog()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts++
    if (this.reconnectAttempts > 10) {
      this.emitLog('error', 'Max reconnect attempts reached.')
      return
    }
    const delay = Math.min(5000 * Math.pow(1.5, this.reconnectAttempts - 1), 60000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private authenticate() {
    this.emitLog('info', '[FYERS_HSM_AUTH] Authenticating binary stream...')
    const hsmKeyBuf = Buffer.from(this.hsmKey, 'utf8')
    const sourceBuf = Buffer.from(this.source, 'utf8')
    const modeBuf = Buffer.from('P', 'utf8')

    const bufferSize = 18 + hsmKeyBuf.length + sourceBuf.length
    const buf = Buffer.alloc(bufferSize + 2) // +2 for initial size field
    
    let offset = 0
    buf.writeUInt16BE(bufferSize - 2, offset); offset += 2
    buf.writeUInt8(1, offset); offset += 1 // Request type = 1
    buf.writeUInt8(4, offset); offset += 1 // Field count = 4

    // Field 1: HSM Key
    buf.writeUInt8(1, offset); offset += 1
    buf.writeUInt16BE(hsmKeyBuf.length, offset); offset += 2
    hsmKeyBuf.copy(buf, offset); offset += hsmKeyBuf.length

    // Field 2: Mode
    buf.writeUInt8(2, offset); offset += 1
    buf.writeUInt16BE(1, offset); offset += 2
    modeBuf.copy(buf, offset); offset += 1

    // Field 3: Unknown flag
    buf.writeUInt8(3, offset); offset += 1
    buf.writeUInt16BE(1, offset); offset += 2
    buf.writeUInt8(1, offset); offset += 1

    // Field 4: Source
    buf.writeUInt8(4, offset); offset += 1
    buf.writeUInt16BE(sourceBuf.length, offset); offset += 2
    sourceBuf.copy(buf, offset); offset += sourceBuf.length

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(buf)
    }
  }

  public subscribe(dbTickers: string[]) {
    // FIX: Track active subscriptions for auto-reconnect
    dbTickers.forEach(t => this.activeSubscriptions.add(t))

    if (!this.authenticated) {
      dbTickers.forEach(t => this.pendingSubscriptions.add(t))
      this.emitLog('info', `[FYERS_HSM_STATUS] queued ${dbTickers.length} symbols pending auth.`)
      
      // Auto-connect if socket was halted due to 0 subscriptions
      if (!this.isConnecting && !this.ws) {
        this.connect()
      }
      return
    }

    const hsmTokens: string[] = []
    for (const t of dbTickers) {
      const hsm = this.reverseMappings.get(t)
      if (hsm) hsmTokens.push(hsm)
    }
    
    if (hsmTokens.length === 0) return

    this.emitLog('info', `[FYERS_HSM_SUBSCRIBE] Subscribing to ${hsmTokens.length} topics...`)
    this.emitLog('info', `[FYERS_HSM_STATUS] subscribed symbols=${dbTickers.join(',')}`)
    
    // Batch into chunks of 50 asynchronously
    const chunkSize = 50
    let currentIndex = 0
    let batchNumber = 1

    const processNextBatch = () => {
      if (currentIndex >= hsmTokens.length || !this.authenticated) return
      
      const chunk = hsmTokens.slice(currentIndex, currentIndex + chunkSize)
      this.submitSubscriptionBatch(chunk, 'S', batchNumber)
      
      currentIndex += chunkSize
      batchNumber++
      
      if (currentIndex < hsmTokens.length) {
        setTimeout(processNextBatch, 50) // Yield event loop
      }
    }
    
    processNextBatch()
  }

  public unsubscribe(dbTickers: string[]) {
    dbTickers.forEach(t => {
      this.activeSubscriptions.delete(t)
      this.pendingSubscriptions.delete(t)
    })
    
    if (this.authenticated) {
      const hsmTokens: string[] = []
      for (const t of dbTickers) {
        const hsm = this.reverseMappings.get(t)
        if (hsm) hsmTokens.push(hsm)
      }
      if (hsmTokens.length > 0) {
        this.submitSubscriptionBatch(hsmTokens, 'U')
      }
    }
  }

  private submitSubscriptionBatch(hsmTokens: string[], type: 'S' | 'U' = 'S', batchNumber: number = 1) {
    const buffers: Buffer[] = []
    let totalLen = 2
    const countBuf = Buffer.alloc(2)
    countBuf.writeUInt16BE(hsmTokens.length, 0)
    buffers.push(countBuf)

    for (const token of hsmTokens) {
      const tBuf = Buffer.from(token, 'ascii')
      const lenBuf = Buffer.alloc(1)
      lenBuf.writeUInt8(tBuf.length, 0)
      buffers.push(lenBuf, tBuf)
      totalLen += 1 + tBuf.length
    }

    const scripsData = Buffer.concat(buffers)
    
    // Payload length = (request type:1) + (field count:1) + (field 1:1) + (field 1 len:2) + scripsData.length + (field 2:1) + (field 2 len:2) + (field 2 val:1)
    // Payload length = 9 + scripsData.length
    const payloadLen = 9 + scripsData.length
    const msgBuf = Buffer.alloc(payloadLen + 2)
    
    let offset = 0
    msgBuf.writeUInt16BE(payloadLen, offset); offset += 2
    msgBuf.writeUInt8(4, offset); offset += 1 // Request type = 4
    msgBuf.writeUInt8(2, offset); offset += 1 // Field count = 2
    
    // Field 1: Symbols
    msgBuf.writeUInt8(1, offset); offset += 1
    msgBuf.writeUInt16BE(scripsData.length, offset); offset += 2
    scripsData.copy(msgBuf, offset); offset += scripsData.length

    // Field 2: Channel
    msgBuf.writeUInt8(2, offset); offset += 1
    msgBuf.writeUInt16BE(1, offset); offset += 2
    msgBuf.writeUInt8(11, offset); offset += 1 // channel 11

    this.emitLog('info', `[HSM_SUB_BATCH] batch=${batchNumber} symbols=${hsmTokens.length} bytes=${scripsData.length}`)
    this.emitLog('info', `[HSM_SUB_SEND] count=${hsmTokens.length} firstToken=${hsmTokens[0]} lastToken=${hsmTokens[hsmTokens.length-1]} packetBytes=${msgBuf.length}`)

    if (this.ws?.readyState === 1) { // 1 = OPEN
      this.ws.send(msgBuf)
    }
  }

  private parseBinaryMessage(data: Buffer) {
    if (data.length < 3) return
    const msgType = data.readUInt8(2)

    if (msgType === 1) {
      this.emitLog('info', '[FYERS_HSM_AUTH] Auth successful.')
      this.emitLog('info', '[FYERS_HSM_STATUS] authenticated')
      this.authenticated = true
      this.emit('connected')
      if (this.pendingSubscriptions.size > 0) {
        const toSub = Array.from(this.pendingSubscriptions)
        this.pendingSubscriptions.clear()
        this.emitLog('info', `[FYERS_HSM_STATUS] Flushing ${toSub.length} pending subscriptions...`)
        this.subscribe(toSub)
      }
    } else if (msgType === 4) {
      this.emitLog('info', `[HSM_SUB_ACK] received status=ACK`)
    } else if (msgType === 6) {
      this.parseDataFeed(data)
    }
  }

  private parseDataFeed(data: Buffer) {
    if (data.length < 9) return
    const scripCount = data.readUInt16BE(7)
    let offset = 9

    for (let i = 0; i < scripCount; i++) {
      if (offset >= data.length) break
      const dataType = data.readUInt8(offset); offset++
      
      if (dataType === 83) { // Snapshot
        offset = this.parseSnapshot(data, offset)
      } else if (dataType === 85) { // Update
        offset = this.parseUpdate(data, offset)
      } else {
        break
      }
    }
  }

  private parseSnapshot(data: Buffer, offset: number): number {
    const startOffset = offset

    if (offset + 3 > data.length) return offset
    const topicId = data.readUInt16BE(offset); offset += 2
    const nameLen = data.readUInt8(offset); offset += 1
    if (offset + nameLen > data.length) return offset
    
    const topicName = data.toString('utf8', offset, offset + nameLen)

    offset += nameLen

    this.subscriptions.set(topicId, topicName)
    
    if (topicName.startsWith('sf|')) {
      return this.parseScripSnapshot(data, offset, topicId, topicName)
    } else if (topicName.startsWith('if|')) {
      return this.parseIndexSnapshot(data, offset, topicId, topicName)
    }
    // skip dp| (depth) - for now just return offset (it would break parser if we don't skip properly,
    // but we only subscribe to sf| and if| so it's fine).
    return offset
  }

  private parseScripSnapshot(data: Buffer, offset: number, topicId: number, topicName: string): number {
    if (offset + 1 > data.length) return offset
    const fieldCount = data.readUInt8(offset); offset += 1

    const scripData: any = { type: 'sf', hsm_token: topicName }
    
    // Check if it's an index
    const dbTicker = this.symbolMappings.get(topicName) || ''
    const isIndex = dbTicker.endsWith('-INDEX')
    const fieldsToParse = isIndex ? INDEX_FIELDS : DATA_FIELDS

    for (let i = 0; i < fieldCount; i++) {
      if (offset + 4 > data.length) break
      const val = data.readInt32BE(offset); offset += 4
      if (val !== -2147483648 && i < fieldsToParse.length) {
        scripData[fieldsToParse[i]] = val
      }
    }

    if (isIndex) {
      this.indexData.set(topicId, scripData)
      this.queueNormalizedTick(scripData, 'snapshot')
      return offset
    }

    // Skip 2 bytes for equities/derivatives
    offset += 2
    if (offset + 3 > data.length) return offset
    scripData.multiplier = data.readUInt16BE(offset); offset += 2
    scripData.precision = data.readUInt8(offset); offset += 1
    
    // Strings
    const stringFields = ["exchange", "exchange_token", "symbol"]
    for (const field of stringFields) {
      if (offset + 1 > data.length) break
      const slen = data.readUInt8(offset); offset += 1
      if (offset + slen > data.length) break
      scripData[field] = data.toString('utf8', offset, offset + slen)
      offset += slen
    }
    
    this.scripsData.set(topicId, scripData)
    this.queueNormalizedTick(scripData, 'snapshot')
    return offset
  }

  private parseIndexSnapshot(data: Buffer, offset: number, topicId: number, topicName: string): number {
    if (offset + 1 > data.length) return offset
    const fieldCount = data.readUInt8(offset); offset += 1

    const indexData: any = { type: 'if', hsm_token: topicName }
    for (let i = 0; i < fieldCount; i++) {
      if (offset + 4 > data.length) break
      const val = data.readInt32BE(offset); offset += 4
      if (val !== -2147483648 && i < INDEX_FIELDS.length) {
        indexData[INDEX_FIELDS[i]] = val
      }
    }
    
    this.indexData.set(topicId, indexData)
    this.queueNormalizedTick(indexData, 'snapshot')
    return offset
  }

  private parseUpdate(data: Buffer, offset: number): number {
    const startOffset = offset
    if (offset + 3 > data.length) return offset
    const topicId = data.readUInt16BE(offset); offset += 2
    const fieldCount = data.readUInt8(offset); offset += 1
    
    const topicName = this.subscriptions.get(topicId)
    const dbTicker = topicName ? (this.symbolMappings.get(topicName) || 'UNKNOWN') : 'UNKNOWN'

    if (!topicName) return offset // skip unknown

    let store = topicName.startsWith('sf|') ? this.scripsData.get(topicId) : this.indexData.get(topicId)
    const fieldNames = topicName.startsWith('sf|') ? DATA_FIELDS : INDEX_FIELDS
    
    if (store) {
      let changed = false
      for (let i = 0; i < fieldCount; i++) {
        if (offset + 4 > data.length) break
        const val = data.readInt32BE(offset); offset += 4
        if (val !== -2147483648 && i < fieldNames.length) {
          if (store[fieldNames[i]] !== val) {
            store[fieldNames[i]] = val
            changed = true
          }
        }
      }
      if (changed) {
        this.queueNormalizedTick(store, 'live')
      }
    }
    return offset
  }

  private queueNormalizedTick(rawData: any, updateType: 'snapshot' | 'live') {
    const dbTicker = this.symbolMappings.get(rawData.hsm_token)
    if (!dbTicker) return // Ignore unmapped

    const hsmSegment = rawData.hsm_token ? rawData.hsm_token.split('|')[1] : '';
    let totalDivisor = 100;
    if (hsmSegment === 'cds_fo' || hsmSegment === 'bcd_fo') {
      totalDivisor = 10000000;
    }

    const ltp = rawData.ltp !== undefined ? rawData.ltp / totalDivisor : undefined
    if (ltp === undefined) return // Ignore ticks without price

    // Handle timestamps
    const rawTs = rawData.exch_feed_time || rawData.last_traded_time || Math.floor(Date.now() / 1000)
    const tsMs = rawTs * 1000

    // Dedup logic
    const dedup = this.lastTickState.get(dbTicker)
    if (dedup && dedup.ltp === ltp && dedup.time === tsMs) {
      return // Duplicate
    }
    this.lastTickState.set(dbTicker, { ltp, time: tsMs })
    
    const stat = this.tickStats.get(dbTicker) || { ticks: 0, lastTime: 0 }
    stat.ticks++
    stat.lastTime = Date.now()
    this.tickStats.set(dbTicker, stat)

    const normalized: HSMMappedTick = {
      instrumentId: dbTicker,
      lastPrice: ltp,
      volume: rawData.last_traded_qty || 0,
      timestamp: tsMs,
      open: rawData.open_price !== undefined ? rawData.open_price / totalDivisor : undefined,
      high: rawData.high_price !== undefined ? rawData.high_price / totalDivisor : undefined,
      low: rawData.low_price !== undefined ? rawData.low_price / totalDivisor : undefined,
      prevClose: rawData.prev_close_price !== undefined ? rawData.prev_close_price / totalDivisor : undefined,
      updateType
    }
    
    this.tickQueue.push(normalized)
    
    if (this.tickQueue.length === 1 && !this.isProcessingQueue) {
      this.isProcessingQueue = true
      setImmediate(() => this.processQueue())
    }
  }

  private processQueue() {
    if (this.tickQueue.length === 0) {
      this.isProcessingQueue = false
      return
    }
    // Process up to 100 ticks per event loop iteration
    const batch = this.tickQueue.splice(0, 100)
    
    for (const tick of batch) {
      this.emit('tick', tick)
      
      const now = Date.now()
      if (tick.updateType === 'live' && now - this.lastTickLogTime > 1000) {
        this.lastTickLogTime = now
        const dateStr = new Date(tick.timestamp).toISOString().split('T')[0]
        const timeStr = new Date(tick.timestamp).toISOString().split('T')[1].split('.')[0]
        console.log(`[Live Tick] ${dateStr} ${timeStr} | ${tick.instrumentId} | ₹ ${tick.lastPrice.toFixed(2)} | Vol: ${tick.volume}`)
      }
    }

    if (this.tickQueue.length > 0) {
      setImmediate(() => this.processQueue())
    } else {
      this.isProcessingQueue = false
    }
  }

  private startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer)
    this.lastMessageTime = Date.now()
    this.watchdogTimer = setInterval(() => {
      const inactive = Date.now() - this.lastMessageTime
      if (this.authenticated && inactive > 300000) { // 5 minutes
        console.log('[FYERS_HSM_CONNECT] No data for 5 minutes (Market is likely closed), forcing socket close for reconnect...')
        this.authenticated = false
        this.isConnecting = false
        if (this.ws) {
          this.ws.removeAllListeners()
          const oldWs = this.ws
          this.ws = null
          try { oldWs.terminate() } catch {}
          
          // Re-queue active subscriptions manually since we removed listeners
          this.activeSubscriptions.forEach(t => this.pendingSubscriptions.add(t))
        }
        this.triggerReconnect()
      }
    }, 60000) // check every 60 seconds
  }

  private stopWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer)
    this.watchdogTimer = null
  }
}
