import { Router } from 'express'
import { getAllSettings, pool } from '../db'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { LogEntry } from '../types'

const router = Router()

// GET /api/logs?level=info&component=BrokerAdapter&limit=200
router.get('/', async (req, res) => {
  try {
    const level = req.query.level as string | undefined
    const component = req.query.component as string | undefined
    const limit = Math.min(Number(req.query.limit) || 500, 2000)

    let query = 'SELECT * FROM logs WHERE 1=1'
    const values: any[] = []
    let pIdx = 1
    
    if (level) {
      query += ` AND level = $${pIdx++}`
      values.push(level)
    }
    if (component) {
      query += ` AND component = $${pIdx++}`
      values.push(component)
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${pIdx}`
    values.push(limit)

    const dbRes = await pool.query(query, values)
    const entries: LogEntry[] = dbRes.rows.map(r => ({
      id: r.id,
      ts: Number(r.timestamp),
      level: r.level,
      component: r.component,
      message: r.message,
    }))
    res.json(entries)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /api/diagnostics/export — Generate diagnostics bundle
router.post('/export', async (_req, res) => {
  try {
    const settings = getAllSettings()
    const dbRes = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 1000')
    const logs = dbRes.rows

    const bundle = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      // Anonymize sensitive info
      settings: { ...settings, amiBrokerPath: '<redacted>' },
      logCount: logs.length,
      // Only include non-debug logs in bundle
      logs: logs
        .filter((l: any) => l.level !== 'debug')
        .map((l: any) => ({
          ts: new Date(Number(l.timestamp)).toISOString(),
          level: l.level,
          component: l.component,
          // Ensure no credential data leaks
          message: l.message.replace(/token=[^\s&]*/gi, 'token=<redacted>')
            .replace(/apikey=[^\s&]*/gi, 'apikey=<redacted>'),
        })),
    }

    const tmpDir = path.join(os.tmpdir(), 'databridge-diagnostics')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    const filename = `databridge-diagnostics-${Date.now()}.json`
    const filePath = path.join(tmpDir, filename)
    fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2))

    res.json({ filename, message: `Diagnostics bundle generated: ${logs.length} log entries` })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
