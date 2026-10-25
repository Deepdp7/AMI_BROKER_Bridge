import { Router } from 'express'
import { getAllSettings, upsertSettings } from '../../db'
import { refreshDailyReloginScheduler } from '../../brokers/DailyReloginService'
import { backfillQueue, MAX_HISTORY_DAYS } from '../../market/BackfillQueue'
import type { AppSettings } from '../../types'

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
    const prevDepth = Number((getAllSettings() as any).backfillDepthDays) || 365
    if (updates.backfillDepthDays !== undefined) {
      updates.backfillDepthDays = Math.max(1, Math.min(Math.round(Number(updates.backfillDepthDays) || 365), MAX_HISTORY_DAYS))
    }
    upsertSettings(updates)
    // Deeper history requested: fetch just the older years that are missing, in the background
    if (updates.backfillDepthDays && updates.backfillDepthDays > prevDepth) {
      backfillQueue.extendAllHistory(updates.backfillDepthDays).catch(err => console.error('[Settings] History extension failed:', err))
    }
    // Notify the daily relogin scheduler of any time/enabled changes
    refreshDailyReloginScheduler()
    const updated = getAllSettings()
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
