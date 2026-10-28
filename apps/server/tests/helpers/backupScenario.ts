/**
 * Run as its own process by tests/backup.test.ts (a restore only completes across a restart).
 *   make  <backupFile>  data → backup → change the data → stage the backup → print JSON
 *   check               a fresh start (applies the staged backup) → print what is stored
 */
import fs from 'fs'
import path from 'path'

const T = Math.floor(Date.UTC(2026, 9, 20, 4, 30) / 1000) // a past session minute

;(async () => {
  const db = await import('../../src/db')
  await db.syncCachesPromise
  const mode = process.argv[2]

  if (mode === 'make') {
    const file = process.argv[3]
    const Backup = await import('../../src/system/Backup')
    db.stmts.insertSymbol.run({ broker_id: 'fyers-x', instrument_id: 'NSE:AAA-EQ', amibroker_ticker: 'AAA', exchange: 'NSE', instrument_type: 'EQ', raw_symbol: 'NSE:AAA-EQ', created_at: Date.now() })
    await db.upsertBarsToHistory('AAA', [0, 60, 120].map(d => ({ ts: (T + d) * 1000, open: 10, high: 11, low: 9, close: 10.5, volume: 7 })))
    db.upsertSettings({ backfillDepthDays: 730 })
    fs.writeFileSync(path.join(db.DATA_DIR, 'closed_days.json'), '{"NSE":{"closed":{},"traded":["2026-10-21"]}}')
    const made = await Backup.createBackup(file)

    // What happens after the backup: other symbols, other settings
    db.stmts.insertSymbol.run({ broker_id: 'fyers-x', instrument_id: 'NSE:BBB-EQ', amibroker_ticker: 'BBB', exchange: 'NSE', instrument_type: 'EQ', raw_symbol: 'NSE:BBB-EQ', created_at: Date.now() })
    db.upsertSettings({ backfillDepthDays: 365 })
    fs.writeFileSync(path.join(db.DATA_DIR, 'closed_days.json'), '{}')

    const staged = await Backup.stageRestore(file)
    console.log(JSON.stringify({ made, staged }))
    process.exit(0)
  }

  if (mode === 'check') {
    const symbols = (db.stmts.getSymbols.all() as any[]).map(s => s.amiBrokerTicker).sort()
    const csv = await db.stmts.getBarsCsvByTickerAsync.get('AAA', 100)
    const tables = (db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'backup_%'").all() as any[]).map(r => r.name)
    console.log(JSON.stringify({
      symbols,
      aaaBars: csv ? csv.split('\n').length : 0,
      depth: (db.getAllSettings() as any).backfillDepthDays,
      closedDays: fs.readFileSync(path.join(db.DATA_DIR, 'closed_days.json'), 'utf8'),
      previousKept: fs.existsSync(path.join(path.dirname(db.DB_FILE), 'databridge.before-restore.db')),
      backupTablesLeft: tables,
    }))
    process.exit(0)
  }
})()
