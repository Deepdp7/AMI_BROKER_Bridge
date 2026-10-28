import { Router } from 'express'
import { stmts } from '../../db'
import { computeHealth, invalidateHealth, healthAgeMs } from '../../market/DataHealth'
import { repairHistory } from '../../brokers/BrokerLifecycle'

const router = Router()

// GET /api/symbols: every mapped symbol
router.get('/', (_req, res) => {
  const rows = stmts.getSymbols.all()
  res.json(rows)
})

// GET /api/symbols/health: per symbol, is its history complete / missing days / downloading
router.get('/health', async (_req, res) => {
  try {
    const symbols = await computeHealth()
    // fresh: false means an older answer was sent for speed; the page asks again a moment later
    res.json({ symbols, fresh: healthAgeMs() < 30_000 })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) })
  }
})

// POST /api/symbols/repair { tickers?: string[] }: re-check these symbols' whole history and
// download what is missing; without tickers, every symbol that isn't complete
router.post('/repair', async (req, res) => {
  try {
    let tickers: string[] | undefined = Array.isArray(req.body?.tickers) ? req.body.tickers.map(String) : undefined
    if (!tickers) {
      tickers = (await computeHealth(true)).filter(h => h.status === 'missing' || h.status === 'empty').map(h => h.ticker)
    }
    const result = await repairHistory(tickers)
    invalidateHealth()
    res.json({ ok: true, checked: tickers.length, ...result })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) })
  }
})

export default router
