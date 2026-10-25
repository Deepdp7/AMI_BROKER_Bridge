/**
 * pgImport.ts — one-time copy of an older PostgreSQL install into the local SQLite store
 *
 * Runs at startup only while the SQLite database is still empty and PostgreSQL credentials
 * are configured (PGHOST / PGDATABASE / PGPASSWORD in .env). Copies brokers, symbols,
 * settings and every bar; logs and connection events are not carried over. PostgreSQL is
 * only read, never changed, so it stays as a fallback copy.
 */
import { Pool } from 'pg'
import type { DatabaseSync } from 'node:sqlite'

const BATCH = 50_000
const PRICE_SCALE = 10000

function tx(db: DatabaseSync, fn: () => void) {
  db.exec('BEGIN')
  try { fn(); db.exec('COMMIT') } catch (err) { db.exec('ROLLBACK'); throw err }
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

/** Returns true if data was imported (the caller reloads its caches). */
export async function importFromPostgresIfNeeded(db: DatabaseSync): Promise<boolean> {
  if (process.env.DATABRIDGE_NO_PG_IMPORT === '1') return false
  if (!process.env.PGPASSWORD && !process.env.PGDATABASE) return false
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'pgImportedAt'").get()) return false
  // An interrupted import resumes (every insert ignores rows already copied)
  const resuming = !!db.prepare("SELECT 1 FROM settings WHERE key = 'pgImportStartedAt'").get()
  const local = db.prepare('SELECT (SELECT count(*) FROM brokers) + (SELECT count(*) FROM symbols) + EXISTS (SELECT 1 FROM bars) AS n').get() as any
  if (!resuming && Number(local.n) > 0) return false

  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'AMI_BROKER-Bridge',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    max: 2,
    connectionTimeoutMillis: 3000,
  })
  pool.on('error', () => {}) // idle-client errors must not crash the engine
  try {
    try {
      await pool.query('SELECT 1 FROM bars_1s LIMIT 1')
    } catch (err: any) {
      console.log(`[Import] No PostgreSQL data to import (${err?.code || err?.message})`)
      return false
    }

    const started = Date.now()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('pgImportStartedAt', String(started))
    console.log(`[Import] ${resuming ? 'Resuming the' : 'Copying'} data from the old PostgreSQL database into the local database (one time)...`)

    const brokers = (await pool.query('SELECT * FROM brokers')).rows
    const symbols = (await pool.query('SELECT * FROM symbols')).rows
    const settings = (await pool.query('SELECT * FROM settings')).rows
    tx(db, () => {
      const b = db.prepare(`INSERT OR REPLACE INTO brokers (id, broker_type, label, credential_ref, api_key, api_secret, access_token, status, health_score, reconnect_count_1h, account_id, created_at, last_connected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      for (const r of brokers) {
        b.run(r.id, r.broker_type ?? null, r.label ?? null, r.credential_ref ?? null, r.api_key ?? null, r.api_secret ?? null, r.access_token ?? null,
          r.status ?? null, num(r.health_score), num(r.reconnect_count_1h), r.account_id ?? null, num(r.created_at), num(r.last_connected_at))
      }
      const s = db.prepare(`INSERT OR IGNORE INTO symbols (instrument_id, broker_id, amibroker_ticker, exchange, instrument_type, raw_symbol, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
      for (const r of symbols) s.run(r.instrument_id ?? null, r.broker_id ?? null, r.amibroker_ticker ?? null, r.exchange ?? null, r.instrument_type ?? null, r.raw_symbol ?? null, num(r.created_at))
      const st = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      for (const r of settings) st.run(r.key, r.value ?? null)
    })

    const tickers = (await pool.query('SELECT DISTINCT amibroker_ticker AS t FROM bars_1s')).rows.map((r: any) => r.t as string)
    const insTicker = db.prepare('INSERT OR IGNORE INTO tickers (name) VALUES (?)')
    const getTid = db.prepare('SELECT id FROM tickers WHERE name = ?')
    const insBar = db.prepare('INSERT OR IGNORE INTO bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const px = (v: unknown) => Math.round(Number(v) * PRICE_SCALE)
    let total = 0

    for (const [i, ticker] of tickers.entries()) {
      insTicker.run(ticker)
      const tid = Number((getTid.get(ticker) as any).id)
      let afterMs = -1
      for (;;) {
        const { rows } = await pool.query(
          'SELECT ts_utc_ms, open, high, low, close, volume, open_interest FROM bars_1s WHERE amibroker_ticker = $1 AND ts_utc_ms > $2 ORDER BY ts_utc_ms LIMIT $3',
          [ticker, afterMs, BATCH],
        )
        if (rows.length === 0) break
        tx(db, () => {
          for (const r of rows) {
            insBar.run(tid, Math.floor(Number(r.ts_utc_ms) / 1000), px(r.open), px(r.high), px(r.low), px(r.close),
              Math.round(Number(r.volume) || 0), r.open_interest == null ? null : Math.round(Number(r.open_interest)))
          }
        })
        total += rows.length
        afterMs = Number(rows[rows.length - 1].ts_utc_ms)
        if (rows.length < BATCH) break
      }
      if ((i + 1) % 10 === 0 || i === tickers.length - 1) {
        console.log(`[Import] ${i + 1}/${tickers.length} symbols, ${total.toLocaleString()} bars copied`)
      }
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('pgImportedAt', String(Date.now()))
    console.log(`[Import] Done: ${brokers.length} broker(s), ${symbols.length} symbol(s), ${total.toLocaleString()} bars in ${((Date.now() - started) / 1000).toFixed(1)}s. PostgreSQL is no longer needed.`)
    return true
  } finally {
    await pool.end().catch(() => {})
  }
}
