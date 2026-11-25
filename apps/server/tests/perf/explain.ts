/**
 * How SQLite will run each query the engine uses: which index it reads, or whether it scans the whole
 * table. The statements are copies of the ones in src/db/index.ts (the `q` list) and src/db/reader.ts
 * (the worker's source text), so keep them in step when those change. Used for Stage 4d.
 */
interface Q { name: string; sql: string; params: Array<number | string> }

const QUERIES: Q[] = [
  // src/db/index.ts: writes
  { name: 'insertLiveBar', sql: 'INSERT OR IGNORE INTO bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params: [1, 1, 1, 1, 1, 1, 1, 1] },
  {
    name: 'upsertHistoryBar',
    sql: `INSERT INTO bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (tid, ts) DO UPDATE SET
      open = excluded.open, high = excluded.high, low = excluded.low, close = excluded.close, volume = excluded.volume,
      oi = COALESCE(excluded.oi, bars.oi)
    WHERE (bars.open, bars.high, bars.low, bars.close, bars.volume, bars.oi) IS NOT
          (excluded.open, excluded.high, excluded.low, excluded.close, excluded.volume, COALESCE(excluded.oi, bars.oi))`,
    params: [1, 1, 1, 1, 1, 1, 1, 1],
  },
  { name: 'deleteTickerBars', sql: 'DELETE FROM bars WHERE tid = ?', params: [1] },
  // src/db/index.ts: small reads
  { name: 'getTickerId', sql: 'SELECT id FROM tickers WHERE name = ?', params: ['X'] },
  { name: 'lastBarTs', sql: 'SELECT ts FROM bars WHERE tid = ? ORDER BY ts DESC LIMIT 1', params: [1] },
  { name: 'oldestBarTs', sql: 'SELECT ts FROM bars WHERE tid = ? ORDER BY ts ASC LIMIT 1', params: [1] },
  { name: 'dailyBefore', sql: 'SELECT ts, open, high, low, close, volume FROM daily_bars WHERE tid = ? AND ts < ? ORDER BY ts', params: [1, 1] },
  { name: 'recentEvents', sql: 'SELECT * FROM connection_events WHERE broker_id = ? ORDER BY ts_utc_ms DESC LIMIT ?', params: ['x', 10] },
  // src/db/reader.ts: the worker's statements
  { name: 'reader.rawBars (bars for AmiBroker)', sql: 'SELECT ts, open, high, low, close, volume, oi FROM bars WHERE tid = ? AND ts > ? AND ts <= ? ORDER BY ts DESC LIMIT ?', params: [1, 0, 9e15, 100000] },
  {
    name: 'reader.gapPairs',
    sql: 'SELECT prev, ts FROM (SELECT ts, LAG(ts) OVER (ORDER BY ts) AS prev FROM bars WHERE tid = ? AND ts >= ? AND ts <= ?) WHERE prev IS NOT NULL AND ts - prev > ? ORDER BY ts',
    params: [1, 0, 2e9, 60],
  },
  { name: 'reader.bounds', sql: 'SELECT MIN(ts) AS first, MAX(ts) AS last FROM bars WHERE tid = ? AND ts >= ? AND ts <= ?', params: [1, 0, 2e9] },
  { name: 'reader.rangeRows (candles)', sql: 'SELECT ts, open, high, low, close, volume FROM bars WHERE tid = ? AND ts >= ? ORDER BY ts', params: [1, 0] },
  { name: 'reader.hiLo', sql: 'SELECT MAX(high) AS hi, MIN(low) AS lo FROM bars WHERE tid = ? AND ts >= ?', params: [1, 0] },
  {
    name: 'reader.dayRange (history health, since Stage 4c: one ticker, a range of days)',
    sql: 'SELECT (ts + 19800) / 86400 AS d, COUNT(*) AS n FROM bars WHERE tid = ? AND ts >= ? AND ts < ? GROUP BY d',
    params: [1, 0, 2e9],
  },
  {
    name: 'reader.dayRows (history health before Stage 4c: every ticker, removed)',
    sql: 'SELECT t.name AS ticker, (b.ts + 19800) / 86400 AS d, COUNT(*) AS n FROM bars b JOIN tickers t ON t.id = b.tid WHERE b.ts >= ? GROUP BY b.tid, d',
    params: [0],
  },
  { name: 'reader.tidOf', sql: 'SELECT id FROM tickers WHERE name = ?', params: ['X'] },
]

/** One block of text: each query and the plan SQLite picks for it */
export function explainAll(sqlite: { prepare(sql: string): { all(...p: any[]): any[] } }): string {
  const out: string[] = []
  for (const q of QUERIES) {
    let plan: string
    try {
      const rows = sqlite.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all(...q.params)
      plan = rows.length ? rows.map(r => `    ${r.detail}`).join('\n') : '    (no plan: a plain insert)'
    } catch (err: any) {
      plan = `    could not explain: ${err?.message || err}`
    }
    out.push(`${q.name}\n${plan}`)
  }
  return out.join('\n\n')
}
