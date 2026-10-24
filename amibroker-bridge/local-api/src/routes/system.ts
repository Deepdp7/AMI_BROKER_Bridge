import { Router } from 'express'
import { exec } from 'child_process'
import path from 'path'
import { cleanDatabase, fullForceClean } from '../db'

const router = Router()

// GET /api/system/console?limit=2000&after=<seq>
// Recent engine console output for the Live Console page (live lines arrive via WS 'console_lines')
router.get('/console', (req, res) => {
  const { getConsoleLines } = require('../services/ConsoleCapture')
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
router.post('/clean-database', (req, res) => {
  try {
    const { feedSimulator } = require('../services/feedSimulator')
    const { backfillQueue, backfillStatusMap } = require('../services/BackfillQueue')


    console.log('[SystemAPI] Executing Clean Database...')

    // 1. Safely stop active feeds & backfills
    if (feedSimulator.removeAllInstruments) feedSimulator.removeAllInstruments()
    backfillQueue.queue = []
    backfillQueue.activeTickers.clear()
    if (backfillStatusMap) backfillStatusMap.clear()

    // 2. Wipe DB data (symbols, history, mappings, logs)
    cleanDatabase()
    require('../shared/coverageState').clearVerifiedThrough()

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[SystemAPI] Clean Database failed:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/system/full-force-clean
router.post('/full-force-clean', (req, res) => {
  try {
    const { feedSimulator } = require('../services/feedSimulator')
    const { backfillQueue, backfillStatusMap } = require('../services/BackfillQueue')


    console.log('[SystemAPI] Executing Full Force Clean (Factory Reset)...')

    // 1. Safely stop everything
    if (feedSimulator.removeAllInstruments) feedSimulator.removeAllInstruments()
    backfillQueue.queue = []
    backfillQueue.activeTickers.clear()
    if (backfillStatusMap) backfillStatusMap.clear()

    // 2. Factory wipe DB and cache
    fullForceClean()
    require('../shared/coverageState').clearVerifiedThrough()

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
