/**
 * activity.ts
 * Turns the data engine's console lines into plain-language events for the Activity page.
 * Lines nobody needs to read (price ticks, request logs, internal bookkeeping) become nothing;
 * repeats of the same thing within a few minutes are merged into one event with a count.
 */
import type { ConsoleLine } from '../api/apiClient'

export type Tone = 'good' | 'info' | 'warn' | 'bad'
export type ActivityIcon = 'power' | 'plug' | 'wifi' | 'download' | 'check' | 'clock' | 'alert' | 'key' | 'chart' | 'plus' | 'pause' | 'stop' | 'calendar' | 'list' | 'zap'
/** Where the "fix it" button on an event leads */
export type ActivityFix = 'broker'

export interface ActivityEvent {
  id: number
  /** Time of the latest occurrence (UTC ms) */
  ts: number
  tone: Tone
  icon: ActivityIcon
  title: string
  detail?: string
  fix?: ActivityFix
  /** How many times this happened in a row (merged) */
  count: number
  /** A problem that a later event fixed (e.g. a login that has since worked): when (UTC ms) */
  fixedAt?: number
  /** What fixed it, in words ("You logged in again") */
  fixedBy?: string
}

interface View { title: string; detail?: string; tone?: Tone }

interface Rule<D = any> {
  match: RegExp
  key: string
  tone: Tone
  icon: ActivityIcon
  fix?: ActivityFix
  /** Same-key occurrences closer together than this (ms) become one event */
  window?: number
  /** The title already carries the totals ("5 symbols"), so no "×N" counter */
  hideCount?: boolean
  data?: (m: RegExpMatchArray, l: ConsoleLine) => D
  merge?: (prev: D, next: D) => D
  view: (d: D, count: number) => View
  /** Earlier problems (by key) this event fixes, and how to say so */
  fixes?: { keys: string[]; by: string }
}

/** Every login or connection problem; any successful login afterwards fixes them */
const LOGIN_PROBLEMS = ['login', 'login-stopped', 'login-failed', 'connect-failed', 'secret-missing']
const FIXED_BY_LOGIN = { keys: LOGIN_PROBLEMS, by: 'Your broker is connected again' }

const MIN = 60_000
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`
const dateLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
const sample = (names: Iterable<string>, n = 4) => {
  const all = [...names]
  return all.slice(0, n).join(', ') + (all.length > n ? ` and ${all.length - n} more` : '')
}

const RULES: Rule[] = [
  { match: /^\[IPC\] AmiBroker TCP Server listening/, key: 'started', tone: 'good', icon: 'power',
    view: () => ({ title: 'DataBridge Pro started', detail: 'The background service is ready.' }) },

  { match: /^\[Init\] Auto-connecting broker/, key: 'connecting', tone: 'info', icon: 'plug', window: 10 * MIN,
    view: () => ({ title: 'Logging in to your broker' }) },

  { match: /^\[Broker\] \S+: connected and ready/, key: 'logged-in', tone: 'good', icon: 'check', window: 10 * MIN, fixes: FIXED_BY_LOGIN,
    view: () => ({ title: 'Connected to your broker' }) },

  // These also mean the login works (and are all an older engine prints after a login)
  { match: /^\[Broker\] \S+: subscribed (\d+) symbols for live ticks/, key: 'live-started', tone: 'good', icon: 'zap', hideCount: true, window: 10 * MIN, fixes: FIXED_BY_LOGIN,
    data: m => Number(m[1]), merge: (_a, b) => b,
    view: n => ({ title: `Live prices started for ${plural(n, 'symbol')}` }) },

  { match: /^\[FYERS_HSM_AUTH\] Auth successful/, key: 'live-conn', tone: 'good', icon: 'wifi', window: 60 * MIN, fixes: FIXED_BY_LOGIN,
    view: (_d, c) => ({ title: 'Connected to the live price feed', detail: c > 1 ? `Reconnected ${plural(c - 1, 'time')}. This is normal while the market is closed.` : undefined }) },

  // ----- login problems -----
  { match: /Token permanently invalid|Auth permanently failed/, key: 'login-stopped', tone: 'bad', icon: 'key', fix: 'broker', window: 30 * MIN,
    view: () => ({ title: 'History downloads stopped: login needed', detail: 'Log in to your broker again to continue.' }) },
  { match: /API Secret is missing/, key: 'secret-missing', tone: 'bad', icon: 'key', fix: 'broker', window: 30 * MIN,
    view: () => ({ title: 'Broker setup is incomplete', detail: 'Remove the broker and add it again with its API key and secret.' }) },
  { match: /Access token expired|\[Auth\] .* Opening .* login in the browser|Token appears invalid/, key: 'login', tone: 'warn', icon: 'key', fix: 'broker', window: 30 * MIN,
    view: () => ({ title: 'Your broker login has expired', detail: 'A login page may have opened in your browser. Log in again to keep live prices and downloads going.' }) },
  { match: /^\[OAuth\] Broker connection failed/, key: 'login-failed', tone: 'bad', icon: 'key', fix: 'broker', window: 10 * MIN,
    view: () => ({ title: 'Broker login failed', detail: 'Try logging in again. If it keeps failing, check the API key and secret.' }) },
  { match: /^\[Init\] Failed to auto-connect broker|\[BrokerManager\] Failed to connect broker/, key: 'connect-failed', tone: 'bad', icon: 'plug', fix: 'broker', window: 10 * MIN,
    view: () => ({ title: "Couldn't connect to your broker", detail: 'Check your internet connection, then log in again.' }) },

  // ----- history -----
  { match: /^\[CatchUp\] \S+: (\d+) symbol\(s\) with missing bars queued, (\d+) full download\(s\), (\d+) up to date(?:, (\d+) cancelled by the user)?/,
    key: 'catchup', tone: 'info', icon: 'check', window: 20 * MIN,
    data: m => ({ gaps: Number(m[1]), full: Number(m[2]), ok: Number(m[3]), skipped: Number(m[4] || 0) }), merge: (_a, b) => b,
    view: d => {
      const parts = [
        d.gaps ? `${plural(d.gaps, 'symbol')} with missing bars` : '',
        d.full ? `${plural(d.full, 'symbol')} new to download` : '',
        d.ok ? `${plural(d.ok, 'symbol')} up to date` : '',
        d.skipped ? `${plural(d.skipped, 'symbol')} skipped (you cancelled their history)` : '',
      ].filter(Boolean)
      return d.gaps + d.full === 0
        ? { title: 'Your history is up to date', detail: parts.join(' · '), tone: 'good' }
        : { title: 'Checked your history', detail: parts.join(' · ') }
    } },
  { match: /^\[BackfillQueue\] Saved (\d+) bars for (\S+)/, key: 'history', tone: 'info', icon: 'download', hideCount: true, window: 15 * MIN,
    data: m => ({ bars: Number(m[1]), tickers: new Set([m[2]]), last: m[2] }),
    merge: (a, b) => ({ bars: a.bars + b.bars, tickers: new Set([...a.tickers, ...b.tickers]), last: b.last }),
    view: d => ({ title: `Downloaded history for ${plural(d.tickers.size, 'symbol')}`, detail: `${plural(d.bars, 'bar')} saved · latest: ${d.last}` }) },
  { match: /^\[BackfillQueue\] (Error backfilling|Max retries|Rate-limit retries exhausted)|FAILED\/SKIPPED|^\[Error\] \S+ : Failed to fetch/,
    key: 'history-fail', tone: 'warn', icon: 'alert', window: 15 * MIN,
    view: (_d, c) => ({ title: "Couldn't download part of the history", detail: `${plural(c, 'problem')} so far. DataBridge tries again later by itself.` }) },
  { match: /Rate limit reached|Rate limit \/ timeout/, key: 'ratelimit', tone: 'warn', icon: 'clock', window: 20 * MIN,
    view: () => ({ title: 'Your broker is slowing downloads down', detail: 'Brokers limit how fast an account can download. DataBridge slows down by itself and carries on, so there is nothing for you to do.' }) },
  { match: /^\[AutoRefresh\] Checked (\d+) symbol\(s\) against the broker in [\d.]+s — (\d+) bar\(s\) corrected/, key: 'refresh', tone: 'info', icon: 'check', hideCount: true, window: 30 * MIN,
    data: m => ({ n: Number(m[1]), fixed: Number(m[2]) }), merge: (a, b) => ({ n: b.n, fixed: a.fixed + b.fixed }),
    view: (d, c) => ({ title: `Checked today's data against your broker${c > 1 ? ` (${c} times)` : ''}`, detail: `${plural(d.n, 'symbol')} checked · ${plural(d.fixed, 'bar')} corrected` }) },

  // ----- the download card's buttons -----
  { match: /^\[BackfillQueue\] Paused by the user \((\d+) queued\)/, key: 'paused', tone: 'info', icon: 'pause',
    data: m => Number(m[1]), view: n => ({ title: 'Downloads paused', detail: `${plural(n, 'download')} waiting. Press Resume on the download card to continue.` }) },
  { match: /^\[BackfillQueue\] Resumed by the user/, key: 'resumed', tone: 'good', icon: 'download',
    view: () => ({ title: 'Downloads resumed' }) },
  { match: /^\[BackfillQueue\] Cancelled (\d+) queued download/, key: 'cancelled', tone: 'info', icon: 'stop',
    data: m => Number(m[1]), view: n => ({ title: 'Downloads cancelled', detail: `${plural(n, 'waiting download')} stopped. Those symbols keep live prices; press Download now in Symbol Setup to get their history later.` }) },
  { match: /^\[BackfillQueue\] History downloads allowed again for (\d+)/, key: 'allowed', tone: 'info', icon: 'download',
    data: m => Number(m[1]), view: n => ({ title: 'History downloads turned back on', detail: `${plural(n, 'symbol')} will download their history.` }) },

  // ----- symbols -----
  { match: /^\[ADD_SYMBOL\] "([^"]+)" backfill queued|^\[IPC_AUTO_REG\] "([^"]+)" .* registered, subscribed/, key: 'added', tone: 'good', icon: 'plus', hideCount: true, window: 10 * MIN,
    data: m => new Set([m[1] || m[2]]), merge: (a, b) => new Set([...a, ...b]),
    view: s => ({ title: s.size === 1 ? `Added ${[...s][0]}` : `Added ${plural(s.size, 'symbol')}`, detail: 'Its history downloads in the background.' }) },
  { match: /^\[Init\] Invalid symbol \(expired\?\): (\S+)/, key: 'invalid', tone: 'warn', icon: 'alert', hideCount: true, window: 10 * MIN,
    data: m => new Set([m[1]]), merge: (a, b) => new Set([...a, ...b]),
    view: s => ({ title: 'Some symbols are no longer valid', detail: `For example ${sample(s)}. Expired contracts can be removed in Symbol Setup.` }) },
  { match: /^\[HSM_MAPPING\] (\d+) symbols could not be mapped/, key: 'unmapped', tone: 'warn', icon: 'alert', window: 30 * MIN,
    data: m => Number(m[1]), view: n => ({ title: "Some symbols can't get live prices", detail: `${plural(n, 'symbol')} aren't available on your broker's live feed.` }) },
  { match: /^\[Warning\] No Live Data for: (.*)/, key: 'nolive', tone: 'warn', icon: 'alert', hideCount: true, window: 15 * MIN,
    data: m => m[1].replace(/\.\.\.$/, '').split(',').filter(Boolean), merge: (_a, b) => b,
    view: names => ({ title: "Some symbols aren't getting live prices", detail: `For example ${sample(names)}. This is normal while the market is closed.` }) },
  { match: /^\[FyersAdapter\] Master CSV cache loaded with (\d+) symbols/, key: 'symbol-list', tone: 'info', icon: 'list', window: 30 * MIN,
    data: m => Number(m[1]), view: n => ({ title: 'Symbol list loaded', detail: `${plural(n, 'symbol')} are available to search.` }) },
  { match: /Failed to download (\w+) contracts/, key: 'symbol-list-fail', tone: 'warn', icon: 'list', window: 30 * MIN,
    data: m => m[1], view: ex => ({ title: "Couldn't update the symbol list", detail: `The ${ex} list could not be downloaded. DataBridge tries again by itself.` }) },

  // ----- other -----
  { match: /^\[IPC_CONNECT\] AmiBroker connected/, key: 'amibroker', tone: 'good', icon: 'chart', window: 10 * MIN,
    view: () => ({ title: 'AmiBroker connected', detail: 'Your charts are receiving data.' }) },
  { match: /^\[MarketCalendar\] Learned (\w+) closed day (\S+)/, key: 'holiday', tone: 'info', icon: 'calendar', window: 0,
    data: m => ({ cal: m[1], date: m[2] }), view: d => ({ title: 'Market holiday learned', detail: `${d.cal} was closed on ${dateLabel(d.date)}, so no data is expected for that day.` }) },
  { match: /^\[MorningBrief\] Brief for (\S+) ready/, key: 'brief', tone: 'info', icon: 'chart',
    view: () => ({ title: 'Your morning brief is ready', detail: 'Open AI Assistant to read it.' }) },
]

/** Lines that are never worth a client's attention, even when the engine marks them as errors */
const NOISE = /^◇|^\{"ts"|^\[(HSM_|FYERS_HSM|LIVE_BACKFILL|System Status|Live Tick|IPC_LIVE_BAR|IPC_GAP_PUSH|Secrets|Init\] Log level)/

const ERROR_LINE = /\b(ERROR|FAILED|Uncaught)\b|^\[[^\]]*(Error)[^\]]*\]/

function cleanDetail(text: string): string {
  // The engine's own tag ("[Server Error]") means nothing to a client
  const t = text.replace(/^(\[[^\]]*\]\s*)+/, '').replace(/\s+/g, ' ').trim()
  return t.length > 160 ? t.slice(0, 157) + '…' : t
}

/** Plain-language events from engine lines (oldest first, in the order they happened) */
export function buildActivity(lines: ConsoleLine[]): ActivityEvent[] {
  const events: Array<ActivityEvent & { key: string; data?: any; rule?: Rule }> = []
  const lastByKey = new Map<string, (typeof events)[number]>()
  let nextId = 1

  for (const l of lines) {
    let rule: Rule | undefined
    let m: RegExpMatchArray | null = null
    for (const r of RULES) {
      m = l.text.match(r.match)
      if (m) { rule = r; break }
    }

    if (!rule) {
      if (NOISE.test(l.text)) continue
      if (l.level !== 'error' && !ERROR_LINE.test(l.text)) continue
      // An error nobody wrote a sentence for: say so, keep the original text as the detail
      rule = {
        match: /./, key: 'error', tone: 'bad', icon: 'alert', window: 2 * MIN,
        view: () => ({ title: 'Something went wrong', detail: `${cleanDetail(l.text)} (more in the Technical tab)` }),
      }
    }

    // A login that works marks the earlier login problems as fixed. They stay in the list (they
    // happened), but no longer look like something to act on, and a new problem starts afresh.
    if (rule.fixes) {
      for (const ev of events) {
        if (ev.fixedAt === undefined && rule.fixes.keys.includes(ev.key)) {
          ev.fixedAt = l.ts
          ev.fixedBy = rule.fixes.by
        }
      }
      for (const k of rule.fixes.keys) lastByKey.delete(k)
    }

    const data = rule.data ? rule.data(m!, l) : undefined
    const last = lastByKey.get(rule.key)
    if (last && rule.window && l.ts - last.ts <= rule.window) {
      last.count++
      last.ts = l.ts
      last.data = rule.merge && data !== undefined ? rule.merge(last.data, data) : data !== undefined ? data : last.data
      continue
    }
    const ev: (typeof events)[number] = { id: nextId++, ts: l.ts, tone: rule.tone, icon: rule.icon, fix: rule.fix, title: '', count: 1, key: rule.key, data, rule }
    events.push(ev)
    lastByKey.set(rule.key, ev)
  }

  return events.map(({ key: _k, data, rule, ...ev }) => {
    // The error fallback shows each line's own text, so it is rendered from the stored rule view
    const v = rule!.view(data, ev.count)
    return {
      ...ev, count: rule!.hideCount ? 1 : ev.count, title: v.title, detail: v.detail, tone: v.tone ?? ev.tone,
      // Nothing left to fix
      fix: ev.fixedAt !== undefined ? undefined : ev.fix,
    }
  })
}
