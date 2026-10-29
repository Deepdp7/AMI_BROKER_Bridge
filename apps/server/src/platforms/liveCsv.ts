/**
 * CSV files kept up to date: Documents\DataBridge Pro\CSV\<SYMBOL>.csv, one per tracked symbol
 * ("Date,Time,Open,High,Low,Close,Volume,OI", 1-minute bars, India time). Once switched on
 * (setting "csvLive"), every minute the bars stored since a file's last line are added to its end,
 * so any program that reads files (Python, Investar, a spreadsheet) has history and the minute
 * that just closed. A new symbol gets its whole history first.
 */
import fs from 'fs'
import path from 'path'
import { getAllSettings, upsertSettings } from '../db'
import { readBarsCsv } from '../db/reader'
import { csvLines, storedSymbols } from './exports'
import { userFolder, safeFileName } from './files'

const IST_MS = 19_800_000
const EVERY_MS = 60_000
const MAX_BARS = 2_000_000

/** Unix seconds of a file's last bar ("2026-10-29,09:15:00,…" in India time), or 0 */
export function lastBarSec(tail: string): number {
  const lines = tail.split(/\r?\n/).filter(l => /^\d{4}-\d{2}-\d{2},\d{2}:\d{2}:\d{2},/.test(l))
  const last = lines[lines.length - 1]
  if (!last) return 0
  const [d, t] = last.split(',')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm, ss] = t.split(':').map(Number)
  return Math.floor((Date.UTC(y, m - 1, day, hh, mm, ss) - IST_MS) / 1000)
}

async function readTail(file: string, bytes = 512): Promise<string | null> {
  let fh: fs.promises.FileHandle | null = null
  try {
    fh = await fs.promises.open(file, 'r')
    const size = (await fh.stat()).size
    const len = Math.min(bytes, size)
    const buf = Buffer.alloc(len)
    await fh.read(buf, 0, len, size - len)
    return buf.toString('utf8')
  } catch {
    return null
  } finally {
    await fh?.close().catch(() => {})
  }
}

const lastSec = new Map<string, number>()   // ticker → newest bar in its file
let timer: NodeJS.Timeout | null = null
let running: Promise<void> | null = null

/** Brings every symbol's file up to date; returns the folder and how many bars were added */
export async function updateCsvFiles(into?: string): Promise<{ folder: string; added: number }> {
  const folder = into || await userFolder('CSV')
  let added = 0
  for (const s of storedSymbols()) {
    const file = path.join(folder, `${safeFileName(s.ticker)}.csv`)
    let since = lastSec.get(s.ticker)
    if (since === undefined) {
      const tail = await readTail(file)
      since = tail === null ? -1 : lastBarSec(tail)
    }
    if (since <= 0) {
      // No file yet (or an empty one): its whole history
      const csv = await readBarsCsv(s.ticker, 0, MAX_BARS).catch(() => '')
      if (!csv) continue
      await fs.promises.writeFile(file, csvLines(csv) + '\n')
      added += csv.split('\n').filter(Boolean).length
      lastSec.set(s.ticker, Number(csv.trimEnd().split('\n').pop()!.split(',')[0]) || 0)
      continue
    }
    const csv = await readBarsCsv(s.ticker, since, MAX_BARS).catch(() => '')
    if (!csv.trim()) { lastSec.set(s.ticker, since); continue }
    const rows = csvLines(csv).split('\n').slice(1)   // without the header
    try {
      await fs.promises.appendFile(file, rows.join('\n') + '\n')
    } catch {
      continue   // open in a program that locks it: tried again next minute
    }
    added += rows.length
    lastSec.set(s.ticker, Number(csv.trimEnd().split('\n').pop()!.split(',')[0]) || since)
  }
  return { folder, added }
}

function tick() {
  if (running) return
  running = updateCsvFiles()
    .catch(err => { console.warn(`[CSV] ${err?.message || err}`) })
    .then(() => {})
    .finally(() => { running = null })
}

export function liveCsvOn(): boolean {
  const v = (getAllSettings() as any).csvLive
  return v === true || v === 'true'
}

/** Switches the minute-by-minute updates on or off (remembered across restarts) */
export function setLiveCsv(on: boolean) {
  upsertSettings({ csvLive: on } as any)
  if (on) startLiveCsv()
  else if (timer) { clearInterval(timer); timer = null }
}

/** At engine start, and when switched on */
export function startLiveCsv() {
  if (!liveCsvOn() || timer) return
  timer = setInterval(tick, EVERY_MS)
  timer.unref()
  tick()
}
