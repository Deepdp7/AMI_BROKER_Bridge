/**
 * A database the size of a client's, to time what a big table costs (the history-health scan reads all
 * of it): 100 tickers x 250 trading days x 375 one-minute bars = 9.4 million rows, about 400 MB.
 * Built once by buildSynthetic.ts in a child process, kept in tests/perf/cache, copied into each run.
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

export const SYNTH = { tickers: 100, days: 250, barsPerDay: 375 }
export const synthTicker = (i: number) => `HS${String(i + 1).padStart(4, '0')}`

export function syntheticCachePath(): string {
  return path.join(__dirname, 'cache', `synthetic-${SYNTH.tickers}x${SYNTH.days}x${SYNTH.barsPerDay}.db`)
}

/** Builds the database when it is not in the cache yet (a minute or two, once) and returns its path */
export function ensureSyntheticDb(): string {
  const target = syntheticCachePath()
  if (fs.existsSync(target)) return target
  fs.mkdirSync(path.dirname(target), { recursive: true })
  console.log(`[perf-harness] Building the synthetic database (${SYNTH.tickers} tickers x ${SYNTH.days} days): once, about a minute...`)
  const r = spawnSync(process.execPath, [require.resolve('tsx/cli'), path.join(__dirname, 'buildSynthetic.ts'), target], { stdio: 'inherit' })
  if (r.status !== 0 || !fs.existsSync(target)) throw new Error('could not build the synthetic database')
  return target
}
