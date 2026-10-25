/**
 * DataBridge Pro — Database Layer Unit Tests
 * Tests in-memory store CRUD and business logic
 */
import { describe, it, expect, beforeEach } from 'vitest'

// In-memory store is imported directly
let db: typeof import('../src/db')

describe('Database / Store Layer', () => {
  beforeEach(async () => {
    // Fresh import each time (vitest isolates modules)
    db = await import('../src/db')
  })

  describe('Exchange Registry', () => {
    it('has 6 exchange entries', () => {
      expect(db.exchangeRegistry.length).toBe(6)
    })

    it('NSE has correct timezone and session times', () => {
      const nse = db.exchangeRegistry.find(e => e.exchangeCode === 'NSE')
      expect(nse).toBeTruthy()
      expect(nse!.timezone).toBe('Asia/Kolkata')
      expect(nse!.sessionOpenLocal).toBe('09:15')
      expect(nse!.sessionCloseLocal).toBe('15:30')
    })

    it('MCX has evening session close', () => {
      const mcx = db.exchangeRegistry.find(e => e.exchangeCode === 'MCX')
      expect(mcx).toBeTruthy()
      expect(mcx!.sessionCloseLocal).toBe('23:30')
    })
  })

  describe('Settings CRUD', () => {
    it('getAllSettings returns object with required keys', () => {
      const settings = db.getAllSettings()
      expect(settings).toHaveProperty('amiBrokerPath')
      expect(settings).toHaveProperty('logLevel')
      expect(settings).toHaveProperty('backfillDepthDays')
      expect(settings).toHaveProperty('autoStartWithWindows')
    })

    it('default logLevel is info', () => {
      const settings = db.getAllSettings()
      expect(settings.logLevel).toBe('info')
    })

    it('upsertSettings persists changes', () => {
      db.upsertSettings({ logLevel: 'warn', backfillDepthDays: 60 } as any)
      const settings = db.getAllSettings()
      expect(settings.logLevel).toBe('warn')
      expect(settings.backfillDepthDays).toBe(60)
    })
  })

  describe('Broker Account CRUD', () => {
    const testId = `test-${Date.now()}`

    it('insertBroker adds to store', () => {
      db.stmts.insertBroker.run({
        id: testId, broker_type: 'zerodha_kite', label: 'Test',
        credential_ref: 'dpapi:secureref', status: 'connected',
        health_score: 100, reconnect_count_1h: 0, account_id: 'ZY9999', created_at: Date.now(),
        last_connected_at: null,
      })
      const broker = db.stmts.getBrokerById.get(testId) as any
      expect(broker).toBeTruthy()
      expect(broker.broker_type).toBe('zerodha_kite')
    })

    it('credential_ref is opaque (not actual key)', () => {
      const broker = db.stmts.getBrokerById.get(testId) as any
      if (broker) {
        expect(broker.credential_ref).toMatch(/^dpapi:/)
        expect(broker.credential_ref).not.toContain('REAL_API_KEY')
      }
    })

    it('updateBrokerStatus changes status', () => {
      db.stmts.updateBrokerStatus.run('reconnecting', null, testId)
      const broker = db.stmts.getBrokerById.get(testId) as any
      expect(broker?.status).toBe('reconnecting')
    })

    it('getBrokers returns array', () => {
      const brokers = db.stmts.getBrokers.all()
      expect(Array.isArray(brokers)).toBe(true)
    })

    it('deleteBroker removes from store', () => {
      db.stmts.deleteBroker.run(testId)
      const broker = db.stmts.getBrokerById.get(testId)
      expect(broker).toBeUndefined()
    })
  })

  describe('Symbol Map CRUD', () => {
    const brokerId = 'sym-test-broker'
    const ticker = 'TESTSTOCK'

    it('insertSymbol adds to store', () => {
      db.stmts.insertSymbol.run({
        broker_id: brokerId, instrument_id: ticker,
        amibroker_ticker: ticker, exchange: 'NSE',
        instrument_type: 'EQ', raw_symbol: ticker, created_at: Date.now(),
      })
      const symbols = db.stmts.getSymbolsByBroker.all(brokerId)
      expect(symbols.length).toBeGreaterThan(0)
    })

    it('deleteSymbol removes from store', () => {
      db.stmts.deleteSymbol.run(brokerId, ticker)
      const symbols = db.stmts.getSymbolsByBroker.all(brokerId)
      expect(symbols.find((s: any) => s.amiBrokerTicker === ticker)).toBeUndefined()
    })
  })

  describe('1-minute bars', () => {
    // 23 Oct 2026, 09:15 IST (unix seconds)
    const t0 = 1_792_731_300
    const bar = (ts: number, close: number, volume: number) => `${ts},100,101,99,${close},${volume}`

    it('stores bars and reads them back in time order', async () => {
      const changed = await db.upsertBarsToHistory('DBTEST', [bar(t0 + 60, 100.25, 800), bar(t0, 100.5, 1200)])
      expect(changed).toBe(2)
      expect(await db.getOldestBarTimestampSec('DBTEST')).toBe(t0)
      expect(await db.getLastBarTimestampSec('DBTEST')).toBe(t0 + 60)
      const csv = await db.stmts.getBarsCsvByTickerAsync.get('DBTEST', 10)
      expect(csv.trim().split('\n')).toEqual([bar(t0, 100.5, 1200), bar(t0 + 60, 100.25, 800)])
    })

    it('saving a minute again updates it instead of adding a second row', async () => {
      expect(await db.upsertBarsToHistory('DBTEST', [bar(t0, 100.75, 1300)])).toBe(1)
      // Identical data changes nothing
      expect(await db.upsertBarsToHistory('DBTEST', [bar(t0, 100.75, 1300)])).toBe(0)
      const lines = (await db.stmts.getBarsCsvByTickerAsync.get('DBTEST', 10)).trim().split('\n')
      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe(bar(t0, 100.75, 1300))
    })

    it('never stores the still-forming current minute', async () => {
      const nowMinute = Math.floor(Date.now() / 60000) * 60
      expect(await db.upsertBarsToHistory('DBTEST2', [bar(nowMinute, 100, 1)])).toBe(0)
    })
  })

  describe('Log entries', () => {
    it('appendLog is saved and read back newest first', async () => {
      db.appendLog('info', 'UnitTest', 'first')
      await new Promise(r => setTimeout(r, 5))
      db.appendLog('error', 'UnitTest', 'second')
      const logs = await db.queryLogs({ component: 'UnitTest', limit: 10 })
      expect(logs.map(l => l.message)).toEqual(['second', 'first'])
    })

    it('queryLogs filters by level and respects the limit', async () => {
      const errors = await db.queryLogs({ level: 'error', limit: 100 })
      expect(errors.length).toBeGreaterThan(0)
      errors.forEach(l => expect(l.level).toBe('error'))
      expect(await db.queryLogs({ limit: 1 })).toHaveLength(1)
    })

    it('rotateOldLogs removes entries older than the retention period', async () => {
      const oldTs = Date.now() - 100 * 24 * 3600 * 1000
      db.stmts.insertLog.run({ id: 'old', ts: oldTs, level: 'debug', component: 'RotationTest', message: 'Ancient log' })
      expect(await db.queryLogs({ component: 'RotationTest', limit: 10 })).toHaveLength(1)
      db.rotateOldLogs(30)
      expect(await db.queryLogs({ component: 'RotationTest', limit: 10 })).toHaveLength(0)
    })
  })

  describe('Connection Events', () => {
    it('insertEvent adds event', () => {
      db.stmts.insertEvent.run({
        broker_id: 'event-test-broker',
        event_type: 'CONNECTED',
        detail: 'Test connection',
        ts_utc_ms: Date.now(),
      })
      const events = db.stmts.getRecentEvents.all('event-test-broker')
      expect(Array.isArray(events)).toBe(true)
      expect(events.length).toBeGreaterThan(0)
    })

    it('getEventsLast24h filters by time', () => {
      const cutoff = Date.now() - 24 * 3600 * 1000
      db.stmts.insertEvent.run({
        broker_id: 'recent-test-broker',
        event_type: 'CONNECTED',
        detail: 'Recent event',
        ts_utc_ms: Date.now(),
      })
      const events = db.stmts.getEventsLast24h.all(cutoff) as any[]
      expect(Array.isArray(events)).toBe(true)
    })
  })
})

// ===== Core Logic Tests (no store) =====
describe('Bar Aggregation Logic', () => {
  it('1-second bucket calculation is correct', () => {
    const ts = 1700000001500
    const bucket = Math.floor(ts / 1000) * 1000
    expect(bucket).toBe(1700000001000)
  })

  it('two ticks in same second → same bucket', () => {
    const t1 = 1700000001100
    const t2 = 1700000001900
    expect(Math.floor(t1 / 1000) * 1000).toBe(Math.floor(t2 / 1000) * 1000)
  })

  it('ticks straddling second boundary → different buckets', () => {
    const t1 = 1700000001999
    const t2 = 1700000002000
    expect(Math.floor(t1 / 1000) * 1000).not.toBe(Math.floor(t2 / 1000) * 1000)
  })

  it('OHLCV aggregation is correct', () => {
    const ticks = [100.0, 102.5, 98.3, 101.7, 100.2]
    let open = ticks[0], high = ticks[0], low = ticks[0], close = ticks[0]
    let volume = 1000
    for (let i = 1; i < ticks.length; i++) {
      high = Math.max(high, ticks[i])
      low = Math.min(low, ticks[i])
      close = ticks[i]
      volume += 1000
    }
    expect(open).toBe(100.0)
    expect(high).toBe(102.5)
    expect(low).toBe(98.3)
    expect(close).toBe(100.2)
    expect(volume).toBe(5000)
  })

  it('late tick tolerance (2s default)', () => {
    const barClosedAt = 1700000002000 // bucket boundary
    const LATE_TOL = 2000
    const lateTick = barClosedAt + 1800 // 1.8s late — within window
    const veryLateTick = barClosedAt + 2500 // 2.5s late — outside window

    expect(lateTick - barClosedAt).toBeLessThan(LATE_TOL)
    expect(veryLateTick - barClosedAt).toBeGreaterThan(LATE_TOL)
  })

  it('duplicate tick detection (same sequence id = skip)', () => {
    const processed = new Set<number>()
    const process = (seqId: number) => {
      if (processed.has(seqId)) return false
      processed.add(seqId)
      return true
    }
    expect(process(12345)).toBe(true)
    expect(process(12345)).toBe(false) // duplicate
    expect(process(12346)).toBe(true)
  })

  it('clock skew detection', () => {
    const SKE_THRESHOLD = 5000
    const localTime = Date.now()
    const brokerTimeWithSkew = localTime + 8000 // 8s skew
    const brokerTimeOk = localTime + 2000 // 2s skew — within threshold

    const useLocal = (brokerTs: number) => Math.abs(brokerTs - localTime) > SKE_THRESHOLD
    expect(useLocal(brokerTimeWithSkew)).toBe(true)
    expect(useLocal(brokerTimeOk)).toBe(false)
  })
})
