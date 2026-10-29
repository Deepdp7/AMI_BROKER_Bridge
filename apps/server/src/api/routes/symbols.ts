import { Router } from 'express'
import { stmts } from '../../db'
import { computeHealth, invalidateHealth, healthAgeMs } from '../../market/DataHealth'
import { repairHistory } from '../../brokers/BrokerLifecycle'
import { symbolDetailsCached } from '../../amibroker/symbolDetails'
import { logoFor, LogoUnavailable } from '../../lib/logos'

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

// GET /api/symbols/details: lot size, tick size, name and expiry of every symbol, from its broker's list
router.get('/details', async (_req, res) => {
  try {
    const rows = await symbolDetailsCached()
    res.json(rows.filter(r => r.details).map(r => ({ ticker: r.ticker, ...r.details })))
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) })
  }
})

// GET /api/symbols/logo/:ticker: the company's logo; 404 (final) for an index, a commodity or a
// company with none, 503 (try again) while NSE's list or the logo servers can't be reached
router.get('/logo/:ticker', async (req, res) => {
  try {
    const logo = await logoFor(req.params.ticker)
    if (!logo) { res.status(404).end(); return }
    res.set({ 'Content-Type': logo.type, 'Cache-Control': 'public, max-age=604800' }).send(logo.data)
  } catch (err: any) {
    // Not ready yet (just started, offline): the app asks again; a 404 above is final
    if (err instanceof LogoUnavailable) { res.status(503).set('Retry-After', '10').end(); return }
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
