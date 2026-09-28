import { Router } from 'express'
import { exec } from 'child_process'
import path from 'path'

const router = Router()

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
    const { cleanDatabase } = require('../db')

    console.log('[SystemAPI] Executing Clean Database...')

    // 1. Safely stop active feeds & backfills
    if (feedSimulator.removeAllInstruments) feedSimulator.removeAllInstruments()
    backfillQueue.queue = []
    backfillQueue.activeTickers.clear()
    if (backfillStatusMap) backfillStatusMap.clear()

    // 2. Wipe DB data (symbols, history, mappings, logs)
    cleanDatabase()

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
    const { fullForceClean } = require('../db')

    console.log('[SystemAPI] Executing Full Force Clean (Factory Reset)...')

    // 1. Safely stop everything
    if (feedSimulator.removeAllInstruments) feedSimulator.removeAllInstruments()
    backfillQueue.queue = []
    backfillQueue.activeTickers.clear()
    if (backfillStatusMap) backfillStatusMap.clear()

    // 2. Factory wipe DB and cache
    fullForceClean()

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
