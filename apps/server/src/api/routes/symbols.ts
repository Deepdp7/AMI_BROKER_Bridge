import { Router } from 'express'
import { stmts } from '../../db'

const router = Router()

// GET /api/symbols: every mapped symbol
router.get('/', (_req, res) => {
  const rows = stmts.getSymbols.all()
  res.json(rows)
})

export default router
