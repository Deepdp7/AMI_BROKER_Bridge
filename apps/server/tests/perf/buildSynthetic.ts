/**
 * Child process of syntheticDb.ts: fills a new database with the synthetic history and moves it to
 * the path given. Run in its own isolated data folder, like everything in this harness.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const target = process.argv[2]
if (!target) { console.error('usage: buildSynthetic.ts <target.db>'); process.exit(2) }

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-harness-synth-'))
  process.env.USERPROFILE = tmp
  process.env.HOME = tmp
  process.env.APPDATA = path.join(tmp, 'AppData', 'Roaming')
  process.env.DATABRIDGE_DB_PATH = path.join(tmp, 'build.db')
  process.env.DATABRIDGE_NO_PG_IMPORT = '1'
  process.env.DATABRIDGE_SECRET_KEY = require('crypto').randomBytes(32).toString('hex')
  process.chdir(tmp)

  const { SYNTH, synthTicker } = await import('./syntheticDb')
  const { sqlite, stmts } = await import('../../src/db')

  const DAY_MS = 86_400_000
  const lastDay = Math.floor(Date.now() / DAY_MS) - 1
  const days: number[] = []
  for (let d = lastDay; days.length < SYNTH.days; d--) {
    const wd = new Date(d * DAY_MS).getUTCDay()
    if (wd !== 0 && wd !== 6) days.unshift(d)
  }

  const insertTicker = sqlite.prepare('INSERT OR IGNORE INTO tickers (name) VALUES (?)')
  const tickerId = sqlite.prepare('SELECT id FROM tickers WHERE name = ?')
  const insertBar = sqlite.prepare('INSERT OR REPLACE INTO bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)')
  const started = Date.now()
  for (let t = 0; t < SYNTH.tickers; t++) {
    const name = synthTicker(t)
    stmts.insertSymbol.run({ broker_id: 'sim-1', instrument_id: name, amibroker_ticker: name, exchange: 'NSE', instrument_type: 'EQ', raw_symbol: name, created_at: Date.now() })
    insertTicker.run(name)
    const tid = Number((tickerId.get(name) as any).id)
    sqlite.exec('BEGIN')
    let price = 100 + t
    for (const day of days) {
      for (let m = 0; m < SYNTH.barsPerDay; m++) {
        const ts = Math.floor((day * DAY_MS + (3 * 60 + 45 + m) * 60_000) / 1000)
        const open = price
        price = Math.max(1, Math.round((price + (Math.random() - 0.5) * 0.4) * 100) / 100)
        insertBar.run(tid, ts, Math.round(open * 1e4), Math.round(Math.max(open, price) * 1e4), Math.round(Math.min(open, price) * 1e4), Math.round(price * 1e4), 100 + (m % 50))
      }
    }
    sqlite.exec('COMMIT')
    if ((t + 1) % 10 === 0) console.log(`[perf-harness]   ${t + 1}/${SYNTH.tickers} tickers (${((Date.now() - started) / 1000).toFixed(0)} s)`)
  }
  sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  sqlite.close()
  fs.copyFileSync(path.join(tmp, 'build.db'), target + '.part')
  fs.renameSync(target + '.part', target)
  // The database is still open here (Windows will not delete an open file): a detached helper removes the folder after exit
  try {
    require('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => { try { require("fs").rmSync(process.argv[1], { recursive: true, force: true }) } catch {} }, 2500)', tmp], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  } catch { /* the folder stays in the temp directory */ }
  console.log(`[perf-harness] Synthetic database ready: ${(fs.statSync(target).size / 1048576).toFixed(0)} MB`)
  process.exit(0)
}
main().catch(err => { console.error(err); process.exit(1) })
