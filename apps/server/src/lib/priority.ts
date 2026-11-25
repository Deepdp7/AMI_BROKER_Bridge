/**
 * How urgent a broker history request is. The rate limiter of a broker reads it when a request asks
 * for its turn, so a chart's missing minutes or an auto-refresh don't wait behind a download of
 * years of history. It follows the request through every `await` (AsyncLocalStorage), so no adapter
 * needs to know about it.
 *
 *   interactive  a symbol AmiBroker is showing, or a "refresh today" someone asked for
 *   refresh      the periodic refresh of the symbols (the default)
 *   bulk         downloading years of history
 */
import { AsyncLocalStorage } from 'async_hooks'

export type Priority = 'interactive' | 'refresh' | 'bulk'

const store = new AsyncLocalStorage<Priority>()

/** Runs `fn`; history requests it makes ask for their turn with this priority */
export function withPriority<T>(priority: Priority, fn: () => Promise<T>): Promise<T> {
  return store.run(priority, fn)
}

/** Priority of the request being made now */
export function currentPriority(): Priority {
  return store.getStore() ?? 'refresh'
}

let enabled: () => boolean = () => true

/**
 * The setting `historyPriorities` (default on) lives in the database; the app registers how to read it
 * here. Off: every request counts as `refresh`, so the limiter serves them in the order they came.
 */
export function setPrioritiesEnabled(read: () => boolean) {
  enabled = read
}

/** The priority the limiter uses for a request made now */
export function effectivePriority(): Priority {
  let on = true
  try { on = enabled() } catch { /* settings not readable: keep the priorities */ }
  return on ? currentPriority() : 'refresh'
}
