/**
 * A small JSON state file that is saved in the background.
 *
 * The state files (which symbols are backfilled, how far each is verified, how far back history was
 * asked for) used to be rewritten whole, synchronously, on every change: a catch-up over 500 symbols
 * or an import did that hundreds of times in a row, each time holding the engine's one thread. Now a
 * change only marks the file dirty; one write follows 500 ms later (to a .part file that is then
 * renamed over the real one, so a crash never leaves a half-written file). Whatever is pending is
 * written synchronously when the engine exits, so a normal stop loses nothing. A crash can lose the
 * last half second of changes; these files only save work (the next pass recomputes them).
 */
import fs from 'fs'
import path from 'path'
import { perf } from '../system/perf'

const WRITE_DELAY_MS = 500
const all = new Set<DebouncedFile>()
let exitHooked = false

/** Writes every pending file now (engine exit; tests that simulate a restart) */
export function flushStateFilesSync() {
  for (const f of all) f.flushSync()
}

export class DebouncedFile {
  private timer: NodeJS.Timeout | null = null
  private dirty = false
  private writing: Promise<void> | null = null
  /** Bumped by a synchronous flush: a background write that started before it must not replace the newer file */
  private generation = 0

  /** `serialize` is called when the write happens, so the file always holds the newest state */
  constructor(
    private readonly file: string,
    private readonly serialize: () => string,
    private readonly label = 'State',
    private readonly delayMs = WRITE_DELAY_MS,
  ) {
    all.add(this)
    if (!exitHooked) {
      exitHooked = true
      process.on('exit', flushStateFilesSync)
    }
  }

  /** Something changed: save soon (a burst of changes is one write) */
  schedule() {
    this.dirty = true
    if (!this.timer && !this.writing) this.arm()
  }

  private arm() {
    this.timer = setTimeout(() => { this.timer = null; this.writeInBackground() }, this.delayMs)
    this.timer.unref()
  }

  private writeInBackground() {
    if (!this.dirty || this.writing) return
    this.dirty = false
    const generation = this.generation
    const text = this.serialize()
    const tmp = this.file + '.part'
    this.writing = (async () => {
      try {
        await fs.promises.mkdir(path.dirname(this.file), { recursive: true })
        await fs.promises.writeFile(tmp, text, 'utf8')
        if (generation !== this.generation) { await fs.promises.rm(tmp, { force: true }); return }   // a newer synchronous write won
        try {
          await fs.promises.rename(tmp, this.file)
        } catch {
          // Windows can refuse the rename while antivirus holds the file: write it in place instead
          await fs.promises.writeFile(this.file, text, 'utf8')
          await fs.promises.rm(tmp, { force: true }).catch(() => {})
        }
        perf.count('catchup.state_writes')
      } catch (err) {
        console.error(`[${this.label}] Failed to save state:`, err)
      }
    })().finally(() => {
      this.writing = null
      if (this.dirty) this.arm()   // changed while writing
    })
  }

  /** Writes now, on this thread (exit, tests) */
  flushSync() {
    if (!this.dirty && !this.writing) return
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this.generation++
    this.dirty = false
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, this.serialize(), 'utf8')
      perf.count('catchup.state_writes')
    } catch (err) {
      console.error(`[${this.label}] Failed to save state:`, err)
    }
  }
}
