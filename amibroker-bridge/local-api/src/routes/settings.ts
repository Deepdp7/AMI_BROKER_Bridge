import { Router } from 'express'
import { getAllSettings, upsertSettings } from '../db'
import { refreshDailyReloginScheduler } from '../services/DailyReloginService'
import type { AppSettings } from '../types'

const router = Router()

// GET /api/settings
router.get('/', (_req, res) => {
  try {
    const settings = getAllSettings()
    res.json(settings)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /api/settings
router.put('/', (req, res) => {
  try {
    const updates = req.body as Partial<AppSettings> | null
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid settings payload: must be a JSON object' })
    }
    upsertSettings(updates)
    // Notify the daily relogin scheduler of any time/enabled changes
    refreshDailyReloginScheduler()
    const updated = getAllSettings()
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
