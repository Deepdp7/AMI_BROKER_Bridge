import { Router } from 'express'
import { feedSimulator } from '../services/feedSimulator'
import { stmts, pool } from '../db'
import type { HealthResponse } from '../types'

const router = Router()

// GET /api/status/feed — Live per-symbol feed status snapshot
router.get('/feed', (_req, res) => {
  try {
    const symbols = feedSimulator.getFeedStatuses()
    const coreEngine = feedSimulator._getCoreStats()
    res.json({ symbols, coreEngine, timestamp: Date.now() })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /api/status/health — Connection health + resource usage
router.get('/health', async (_req, res) => {
  try {
    const coreEngine = feedSimulator._getCoreStats()
    const rawBrokers = stmts.getBrokers.all() as any[]
    
    const brokers = []
    const cutoffMs = Date.now() - 3600 * 1000

    for (const broker of rawBrokers) {
      const dbRes = await pool.query(
        'SELECT * FROM connection_events WHERE broker_id = $1 ORDER BY ts_utc_ms DESC LIMIT 50', 
        [broker.id]
      )
      
      const recentEvents = dbRes.rows
      const eventsLastHour = recentEvents.filter(e => Number(e.ts_utc_ms) > cutoffMs)
      const reconnects = eventsLastHour.filter((e: any) => e.event_type === 'RECONNECTING').length
      const errors = eventsLastHour.filter((e: any) => e.event_type === 'ERROR').length
      const totalEvents = eventsLastHour.length
      const errorRate = totalEvents > 0 ? errors / totalEvents : 0

      brokers.push({
        brokerId: broker.id,
        score: broker.health_score,
        reconnectCount1h: reconnects,
        errorRate,
        heartbeatFreshMs: Math.round(100 + Math.random() * 500),
        recentEvents: recentEvents.slice(0, 10).map((e: any) => ({
          id: e.id,
          brokerId: e.broker_id,
          eventType: e.event_type,
          detail: e.detail,
          tsUtcMs: Number(e.ts_utc_ms),
        })),
      })
    }

    const response: HealthResponse = {
      brokers,
      coreEngine,
      uptimeSec: coreEngine.uptimeSec,
    }
    res.json(response)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
