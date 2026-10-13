/**
 * ConsoleCapture.ts
 *
 * Mirrors everything written via console.* into an in-memory ring buffer so the
 * desktop app's Live Console page can show the engine's output (and the AI
 * assistant can report recent errors). Output still goes to stdout,
 * which the desktop app redirects to %APPDATA%\DataBridgePro\logs\backend.log.
 *
 * Must be imported before anything else in server.ts so startup lines are captured.
 */
import util from 'util'
import { EventEmitter } from 'events'

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface ConsoleLine {
  seq: number
  ts: number
  level: ConsoleLevel
  text: string
}

const MAX_LINES = 5000
const buffer: ConsoleLine[] = []
let seq = 0

export const consoleEvents = new EventEmitter()

for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = console[level].bind(console)
  console[level] = (...args: unknown[]) => {
    original(...args)
    const line: ConsoleLine = { seq: ++seq, ts: Date.now(), level, text: util.format(...args) }
    buffer.push(line)
    if (buffer.length > MAX_LINES) buffer.shift()
    consoleEvents.emit('line', line)
  }
}

/** Most recent `limit` lines, optionally only those after `afterSeq`. */
export function getConsoleLines(limit = 1000, afterSeq = 0): ConsoleLine[] {
  const lines = afterSeq > 0 ? buffer.filter(l => l.seq > afterSeq) : buffer
  return lines.slice(-Math.max(1, Math.min(limit, MAX_LINES)))
}
