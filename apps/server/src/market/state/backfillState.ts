/**
 * Shared in-memory state for backfilled tickers.
 * Exported so both server.ts (feed/bars endpoint) and brokers.ts (delete route)
 * can read and mutate the same Set — preventing stale entries after symbol deletion.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DebouncedFile } from '../../lib/DebouncedFile'

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

  // Saved in the background, 500 ms after the last change (see DebouncedFile): a catch-up or an
  // import changes this once per symbol, and each change used to rewrite the whole file on the spot
  private file = new DebouncedFile(STATE_FILE, () => JSON.stringify(Array.from(this)), 'BackfillState')

  private save() {
    this.file.schedule()
  }
}

export const backfilledTickers = new PersistedSet()
