/**
 * Shared in-memory state for backfilled tickers.
 * Exported so both server.ts (feed/bars endpoint) and brokers.ts (delete route)
 * can read and mutate the same Set — preventing stale entries after symbol deletion.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

const DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'DataBridgePro')
const STATE_FILE = path.join(DATA_DIR, 'backfill_state.json')

class PersistedSet extends Set<string> {
  constructor() {
    super()
    this.load()
  }

  add(value: string) {
    super.add(value)
    this.save()
    return this
  }

  delete(value: string) {
    const res = super.delete(value)
    if (res) this.save()
    return res
  }

  clear() {
    super.clear()
    this.save()
  }

  private load() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf8')
        const arr = JSON.parse(data)
        if (Array.isArray(arr)) {
          for (const item of arr) super.add(item)
        }
      }
    } catch (err) {
      console.error('[BackfillState] Failed to load state:', err)
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(STATE_FILE, JSON.stringify(Array.from(this)), 'utf8')
    } catch (err) {
      console.error('[BackfillState] Failed to save state:', err)
    }
  }
}

export const backfilledTickers = new PersistedSet()
