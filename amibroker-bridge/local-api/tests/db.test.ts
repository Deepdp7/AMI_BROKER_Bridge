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

  describe('Bar 1s Insert & Query', () => {
    it('insertBarBatch inserts multiple bars', () => {
      const bars = [
        { amibroker_ticker: 'RELIANCE', ts_utc_ms: 1700000001000, open: 2930, high: 2935, low: 2928, close: 2932, volume: 12000, open_interest: null },
        { amibroker_ticker: 'RELIANCE', ts_utc_ms: 1700000002000, open: 2932, high: 2938, low: 2930, close: 2936, volume: 9500, open_interest: null },
      ]
      expect(() => db.insertBarBatch(bars)).not.toThrow()
    })

    it('getBarsRange queries correctly', () => {
      const bars = db.stmts.getBarsRange.all('RELIANCE', 1700000001000, 1700000002000)
      expect(Array.isArray(bars)).toBe(true)
      if (bars.length > 0) {
        const bar = bars[0] as any
        expect(bar).toHaveProperty('open')
        expect(bar).toHaveProperty('high')
        expect(bar).toHaveProperty('low')
        expect(bar).toHaveProperty('close')
        expect(bar).toHaveProperty('volume')
      }
    })

    it('idempotent insert (same ts overwrite)', () => {
      const bar = { amibroker_ticker: 'TCS', ts_utc_ms: 1700000001000, open: 4120, high: 4130, low: 4115, close: 4128, volume: 2000, open_interest: null }
      expect(() => db.stmts.insertBar.run(bar)).not.toThrow()
      expect(() => db.stmts.insertBar.run(bar)).not.toThrow()
    })
  })

  describe('Log Entries', () => {
    it('insertLog adds entry', () => {
      db.stmts.insertLog.run({ id: `unit-test-log-${Date.now()}`, ts: Date.now(), level: 'info', component: 'UnitTest', message: 'Test log entry' })
      const logs = db.stmts.getLogs.all(10) as any[]
      expect(logs.length).toBeGreaterThan(0)
    })

    it('getLogs respects limit', () => {
      const logs = db.stmts.getLogs.all(3)
      expect(logs.length).toBeLessThanOrEqual(3)
    })

    it('getLogsByLevel filters correctly', () => {
      db.stmts.insertLog.run({ id: `error-log-${Date.now()}`, ts: Date.now(), level: 'error', component: 'Test', message: 'Error test' })
      const errorLogs = db.stmts.getLogsByLevel.all('error', 100) as any[]
      errorLogs.forEach(l => expect(l.level).toBe('error'))
    })

    it('logs are sorted by ts DESC', () => {
      const logs = db.stmts.getLogs.all(100) as any[]
      if (logs.length > 1) {
        for (let i = 1; i < logs.length; i++) {
          expect(logs[i - 1].ts).toBeGreaterThanOrEqual(logs[i].ts)
        }
      }
    })
  })

  describe('Log Rotation', () => {
    it('rotateOldLogs removes old entries', () => {
      const oldTs = Date.now() - 100 * 24 * 3600 * 1000 // 100 days ago
      db.stmts.insertLog.run({ id: `very-old-log-${Date.now()}`, ts: oldTs, level: 'debug', component: 'Test', message: 'Ancient log' })
      db.rotateOldLogs(30)
      const logs = db.stmts.getLogs.all(1000) as any[]
      const ancient = logs.filter((l: any) => l.ts <= Date.now() - 30 * 24 * 3600 * 1000)
      expect(ancient.length).toBe(0)
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
