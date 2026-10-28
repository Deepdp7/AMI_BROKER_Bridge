/**
 * restore.ts — finishing a restore from a backup (Settings → Backup & restore)
 *
 * A restore is staged as a file next to the database while the engine runs, then the engine
 * restarts. At the next start, before the database is opened, the staged backup replaces it:
 * the current database is kept as databridge.before-restore.db, the backup's small state files
 * (coverage, history floor, learned holidays, download state) are written back, and the
 * backup-only tables are dropped. Nothing here imports the rest of the engine.
 */
import fs from 'fs'
import path from 'path'
import type { DatabaseSync } from 'node:sqlite'

/** The staged backup, next to the database */
export const PENDING_RESTORE_NAME = 'restore-pending.dbpbackup'
/** What the previous database is renamed to */
export const BEFORE_RESTORE_NAME = 'databridge.before-restore.db'
/** The only files a backup may carry (a backup file can't write anywhere else) */
export const BACKUP_STATE_FILES = ['coverage_state.json', 'history_floor.json', 'closed_days.json', 'backfill_state.json']

export function pendingRestorePath(dbFile: string): string {
  return path.join(path.dirname(dbFile), PENDING_RESTORE_NAME)
}

/** Swaps a staged backup in; returns true when one was applied. Must run before the database is opened. */
export function applyPendingRestore(dbFile: string, Database: typeof DatabaseSync): boolean {
  const pending = pendingRestorePath(dbFile)
  if (!fs.existsSync(pending)) return false
  const dir = path.dirname(dbFile)
  const previous = path.join(dir, BEFORE_RESTORE_NAME)

  // Keep the current database (and any unsaved WAL pages that belong to it) as one earlier copy
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.rmSync(previous + ext, { force: true }) } catch { /* not there */ }
    if (fs.existsSync(dbFile + ext)) fs.renameSync(dbFile + ext, previous + ext)
  }
  fs.renameSync(pending, dbFile)

  const db = new Database(dbFile)
  try {
    const hasFiles = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'backup_files'").get()
    if (hasFiles) {
      for (const row of db.prepare('SELECT name, content FROM backup_files').all() as Array<{ name: string; content: string }>) {
        if (!BACKUP_STATE_FILES.includes(row.name)) continue
        fs.writeFileSync(path.join(dir, row.name), row.content, 'utf8')
      }
    }
    db.exec('DROP TABLE IF EXISTS backup_files; DROP TABLE IF EXISTS backup_meta;')
  } finally {
    db.close()
  }
  console.log(`[Restore] Backup restored. The previous data was kept as ${BEFORE_RESTORE_NAME}`)
  return true
}
