/**
 * Backup.ts — Settings → Backup & restore
 *
 * A backup is one file: a compacted copy of the database (symbols, all history, settings)
 * with the small state files stored inside it, so moving to a new PC needs no re-download.
 * Restoring stages the file next to the database; the engine then restarts and db/restore.ts
 * swaps it in before anything opens the database. Broker logins are locked to the Windows
 * account that saved them, so on another PC the broker is logged in to once more.
 */
import fs from 'fs'
import path from 'path'
import { DATA_DIR, DB_FILE, flushPendingBars, loadSqlite } from '../db'
import { backupDatabaseTo } from '../db/reader'
import { BACKUP_STATE_FILES, pendingRestorePath } from '../db/restore'

const FORMAT = 'databridge-backup'
const FORMAT_VERSION = 1

export interface BackupInfo {
  createdAt: string
  appVersion: string
  symbols: number
  bars: number
  bytes: number
}

function appVersion(): string {
  try {
    // The root package.json (two levels above apps/server) in development; stamped into the exe otherwise
    return process.env.DATABRIDGE_VERSION || require('../../../../package.json').version || ''
  } catch {
    return ''
  }
}

/** Writes a backup to `file` (replacing it). Runs the heavy copy on a reader thread. */
export async function createBackup(file: string): Promise<BackupInfo> {
  if (!file.trim()) throw new Error('No file chosen')
  const target = path.resolve(file)
  if (path.resolve(target) === path.resolve(DB_FILE)) throw new Error('Choose a different file than the live database')
  const part = target + '.part'
  for (const f of [part]) fs.rmSync(f, { force: true })
  flushPendingBars()

  await backupDatabaseTo(part)

  const { DatabaseSync } = loadSqlite()
  const db = new DatabaseSync(part)
  try {
    db.exec('CREATE TABLE backup_meta (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE backup_files (name TEXT PRIMARY KEY, content TEXT);')
    const meta = db.prepare('INSERT INTO backup_meta (key, value) VALUES (?, ?)')
    meta.run('format', FORMAT)
    meta.run('version', String(FORMAT_VERSION))
    meta.run('createdAt', new Date().toISOString())
    meta.run('appVersion', appVersion())
    const files = db.prepare('INSERT INTO backup_files (name, content) VALUES (?, ?)')
    for (const name of BACKUP_STATE_FILES) {
      const src = path.join(DATA_DIR, name)
      if (fs.existsSync(src)) files.run(name, fs.readFileSync(src, 'utf8'))
    }
  } finally {
    db.close()
  }
  fs.rmSync(target, { force: true })
  fs.renameSync(part, target)
  const info = readBackupInfo(target)
  console.log(`[Backup] Saved ${info.symbols} symbol(s), ${info.bars.toLocaleString()} bars to ${target} (${(info.bytes / 1048576).toFixed(1)} MB)`)
  return info
}

/** What a backup file holds; throws a plain-language error for anything that isn't one */
export function readBackupInfo(file: string): BackupInfo {
  if (!fs.existsSync(file)) throw new Error('The backup file was not found')
  const { DatabaseSync } = loadSqlite()
  let db
  try {
    db = new DatabaseSync(file, { readOnly: true })
  } catch {
    throw new Error('This is not a DataBridge Pro backup')
  }
  try {
    const get = (key: string) => {
      try { return (db!.prepare('SELECT value FROM backup_meta WHERE key = ?').get(key) as any)?.value as string | undefined } catch { return undefined }
    }
    if (get('format') !== FORMAT) throw new Error('This is not a DataBridge Pro backup')
    if (Number(get('version')) > FORMAT_VERSION) throw new Error('This backup was made by a newer DataBridge Pro. Update the app first.')
    const count = (sql: string) => Number((db!.prepare(sql).get() as any)?.n || 0)
    return {
      createdAt: get('createdAt') || '',
      appVersion: get('appVersion') || '',
      symbols: count('SELECT COUNT(*) AS n FROM symbols'),
      bars: count('SELECT COUNT(*) AS n FROM bars'),
      bytes: fs.statSync(file).size,
    }
  } finally {
    db.close()
  }
}

/** Checks `file` and stages it; the restore finishes when the engine restarts */
export async function stageRestore(file: string): Promise<BackupInfo> {
  const info = readBackupInfo(file)
  const pending = pendingRestorePath(DB_FILE)
  const part = pending + '.part'
  fs.rmSync(part, { force: true })
  await fs.promises.copyFile(file, part)
  fs.renameSync(part, pending)
  console.log(`[Restore] Backup from ${info.createdAt} staged (${info.symbols} symbol(s)); it is applied when the data service restarts`)
  return info
}
