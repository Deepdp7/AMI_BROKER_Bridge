import { Router } from 'express'
import { exec } from 'child_process'
import { cleanDatabase, fullForceClean, appendLog } from '../../db'
import { getConsoleLines } from '../../system/ConsoleCapture'
import { liveFeed } from '../../market/liveFeed'
import { backfillQueue } from '../../market/BackfillQueue'
import { clearVerifiedThrough } from '../../market/state/coverageState'
import { createBackup, readBackupInfo, stageRestore } from '../../system/Backup'

const router = Router()

// ===== Backup & restore (Settings) =====

// POST /api/system/backup { path }: one file with symbols, history, settings
router.post('/backup', async (req, res) => {
  try {
    res.json({ ok: true, ...(await createBackup(String(req.body?.path || ''))) })
  } catch (err: any) {
    console.error('[Backup] Failed:', err?.message || err)
    res.status(400).json({ error: err?.message || String(err) })
  }
})

// POST /api/system/restore/check { path }: what a backup file holds
router.post('/restore/check', (req, res) => {
  try {
    res.json({ ok: true, ...readBackupInfo(String(req.body?.path || '')) })
  } catch (err: any) {
    res.status(400).json({ error: err?.message || String(err) })
  }
})

// POST /api/system/restore { path }: stages the backup, then the engine saves, exits and is
// started again by the desktop app, which swaps the backup in before opening the database
router.post('/restore', async (req, res) => {
  try {
    const info = await stageRestore(String(req.body?.path || ''))
    const supervised = process.env.DATABRIDGE_SUPERVISED === '1'
    res.json({ ok: true, restarting: supervised, ...info })
    if (supervised) setTimeout(() => process.exit(0), 300)
  } catch (err: any) {
    console.error('[Restore] Failed:', err?.message || err)
    res.status(400).json({ error: err?.message || String(err) })
  }
})

// GET /api/system/console?limit=2000&after=<seq>
// Recent engine console output for the Live Console page (live lines arrive via WS 'console_lines')
router.get('/console', (req, res) => {
  const limit = Number(req.query.limit) || 2000
  const after = Number(req.query.after) || 0
  res.json({ lines: getConsoleLines(limit, after) })
})

// GET /api/system/pick-folder
router.get('/pick-folder', (req, res) => {
  const psScript = `
    Add-Type -AssemblyName System.windows.forms
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.Description = "Select AmiBroker Installation Folder"
    $f.ShowNewFolderButton = $false
    $form = New-Object System.Windows.Forms.Form
    $form.TopMost = $true
    $form.ShowInTaskbar = $false
    $form.WindowState = 'Minimized'
    $form.Show()
    $form.BringToFront()
    $result = $f.ShowDialog($form)
    if ($result -eq 'OK') { Write-Output $f.SelectedPath }
    $form.Dispose()
  `;
  // Encode as Base64 to avoid quote escaping hell in node child_process
  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  const cmd = `powershell.exe -ExecutionPolicy Bypass -NoProfile -EncodedCommand ${encoded}`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error('Folder picker error:', error)
      return res.status(500).json({ error: 'Failed to open folder picker' })
    }
    
    const selectedPath = stdout.trim()
    if (selectedPath) {
      res.json({ path: selectedPath })
    } else {
      res.json({ path: null }) // User cancelled
    }
  })
})

// POST /api/system/clean-database
// POST /api/system/shutdown — the desktop app calls this when its window is closed. Exiting
// runs db.ts's exit handler (buffered live bars and logs written, database closed) instead
// of the process being killed mid-write. The next start's catch-up fills the closed time.
router.post('/shutdown', (_req, res) => {
  console.log('[SystemAPI] App closed: saving data and stopping the data engine')
  appendLog('info', 'System', 'App closed: data engine stopped')
  res.json({ ok: true })
  setTimeout(() => process.exit(0), 50)
})

router.post('/clean-database', (req, res) => {
  try {
    console.log('[SystemAPI] Executing Clean Database...')

    // 1. Safely stop active feeds & backfills
    liveFeed.removeAllInstruments()
    backfillQueue.cancelAll()

    // 2. Wipe DB data (symbols, history, mappings, logs)
    cleanDatabase()
    clearVerifiedThrough()

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[SystemAPI] Clean Database failed:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/system/full-force-clean
router.post('/full-force-clean', (req, res) => {
  try {
    console.log('[SystemAPI] Executing Full Force Clean (Factory Reset)...')

    // 1. Safely stop everything
    liveFeed.removeAllInstruments()
    backfillQueue.cancelAll()

    // 2. Factory wipe DB and cache
    fullForceClean()
    clearVerifiedThrough()

    // 3. Return success, then kill the process to allow Tauri/Supervisor to restart it empty
    res.json({ ok: true })
    
    setTimeout(() => {
      console.log('[SystemAPI] Exiting process for Factory Reset restart...')
      process.exit(0)
    }, 500)
    
  } catch (err: any) {
    console.error('[SystemAPI] Full Force Clean failed:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
