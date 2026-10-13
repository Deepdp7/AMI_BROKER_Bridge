/**
 * news.ts — business / market news for the AI assistant (no API keys needed).
 *
 * Sources, merged and de-duplicated:
 *  - Google News search (India edition): widest coverage, headlines only (its links can't be opened)
 *  - Bing News search: links point at the publisher, so the article can be read
 *  - Business-portal market feeds (Economic Times, Livemint, Business Standard, CNBC-TV18):
 *    the latest market stories — "stocks to watch", results, brokerage calls, IPOs …
 * Each headline gets an id; read_article(id) fetches that story's full text.
 */
import { createHash } from 'crypto'
import { istString } from './marketData'
import { fnoUnderlyings } from './fno'
import { newsTerms } from './companyNames'

export interface NewsItem {
  id: string
  title: string
  source: string
  publishedIST: string
  hoursAgo: number
  summary?: string
  canRead: boolean
  /** F&O scope: the F&O stocks this story mentions */
  fnoStocks?: string[]
}

interface StoredItem extends NewsItem { url: string; publishedMs: number }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const SEARCH_CACHE_MS = 2 * 60_000
const FEED_CACHE_MS = 3 * 60_000
const ARTICLE_MAX_CHARS = 3000

const PORTAL_FEEDS = [
  { source: 'Economic Times', url: 'https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2146842.cms' },
  { source: 'Economic Times', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { source: 'Livemint', url: 'https://www.livemint.com/rss/markets' },
  { source: 'Business Standard', url: 'https://www.business-standard.com/rss/markets-106.rss' },
  { source: 'CNBC-TV18', url: 'https://www.cnbctv18.com/commonfeeds/v1/cne/rss/market.xml' },
]

// Every headline handed to the model, so read_article only opens URLs that came from a news feed
const byId = new Map<string, StoredItem>()
const searchCache = new Map<string, { at: number; items: StoredItem[] }>()
let feedCache: { at: number; items: StoredItem[] } | null = null

// ===== parsing helpers =====
const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&')
  .trim()

const stripTags = (s: string) => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml)
  return m ? decode(m[1]) : ''
}

const fingerprint = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 8).join(' ')

function remember(partial: Omit<StoredItem, 'id' | 'hoursAgo' | 'publishedIST'>): StoredItem {
  const id = createHash('sha1').update(partial.url || partial.title).digest('hex').slice(0, 10)
  const item: StoredItem = {
    ...partial,
    id,
    publishedIST: istString(partial.publishedMs),
    hoursAgo: Math.round(Math.max(0, (Date.now() - partial.publishedMs) / 3_600_000) * 10) / 10,
  }
  byId.set(id, item)
  if (byId.size > 3000) byId.delete(byId.keys().next().value!)
  return item
}

async function getText(url: string, timeoutMs = 10_000): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

const items = (xml: string) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1])

// ===== sources =====
async function googleNews(query: string, hours: number): Promise<StoredItem[]> {
  const window = hours <= 48 ? `${hours}h` : `${Math.ceil(hours / 24)}d`
  const xml = await getText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${window}`)}&hl=en-IN&gl=IN&ceid=IN:en`)
  return items(xml).flatMap(raw => {
    const source = tag(raw, 'source')
    let title = tag(raw, 'title')
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3))
    const publishedMs = Date.parse(tag(raw, 'pubDate'))
    if (!title || !Number.isFinite(publishedMs)) return []
    // Google's links are opaque redirects; headline only
    return [remember({ title, source, publishedMs, url: '', canRead: false })]
  })
}

async function bingNews(query: string): Promise<StoredItem[]> {
  const xml = await getText(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setmkt=en-IN&qft=sortbydate%3d%221%22`)
  return items(xml).flatMap(raw => {
    const title = tag(raw, 'title')
    const publishedMs = Date.parse(tag(raw, 'pubDate'))
    if (!title || !Number.isFinite(publishedMs)) return []
    let url = tag(raw, 'link')
    try { url = new URL(url).searchParams.get('url') || url } catch { /* keep as-is */ }
    const source = tag(raw, 'News:Source').replace(/ on MSN$/, '')
    const summary = stripTags(tag(raw, 'description')).slice(0, 160) || undefined
    return [remember({ title, source, publishedMs, url, summary, canRead: /^https?:\/\//.test(url) })]
  })
}

async function portalFeeds(): Promise<StoredItem[]> {
  if (feedCache && Date.now() - feedCache.at < FEED_CACHE_MS) return feedCache.items
  const results = await Promise.allSettled(PORTAL_FEEDS.map(async feed => {
    const xml = await getText(feed.url)
    return items(xml).flatMap(raw => {
      const title = stripTags(tag(raw, 'title'))
      const publishedMs = Date.parse(tag(raw, 'pubDate'))
      const url = stripTags(tag(raw, 'link'))
      if (!title || !Number.isFinite(publishedMs)) return []
      const summary = stripTags(tag(raw, 'description')).slice(0, 160) || undefined
      return [remember({ title, source: feed.source, publishedMs, url, summary, canRead: /^https?:\/\//.test(url) })]
    })
  }))
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  if (all.length === 0) throw new Error('No business news feed could be reached')
  feedCache = { at: Date.now(), items: all }
  return all
}

// ===== public API =====

/**
 * Headlines from the last `hours` hours, newest first.
 * With a query: matching stories from all sources. Without: the latest market news from the portals.
 */
export type NewsScope = 'all' | 'fno' | 'intraday'

const FNO_WORDS = /\b(f&o|fno|futures?|options?|open interest|derivatives?|expiry|long build|short build|short covering|long unwinding|nifty|bank ?nifty|pcr|india vix)\b/i
let fnoMatchers: { ticker: string; match: RegExp[] }[] | null = null
const matchersForFno = () => (fnoMatchers ||= fnoUnderlyings().filter(u => !u.isIndex).map(u => ({ ticker: u.underlying, match: newsTerms(u.underlying).match })))

/** F&O stocks named in a headline (by company name, or by ticker when written in capitals). */
function fnoStocksIn(text: string): string[] {
  const hits: string[] = []
  for (const m of matchersForFno()) if (m.match.some(re => re.test(text))) hits.push(m.ticker)
  return hits
}

export async function fetchNews(query: string | undefined, hours = 24, limit = 15, scope: NewsScope = 'all'): Promise<NewsItem[]> {
  let h = Math.min(Math.max(Math.round(hours), 1), 24 * 30)
  let q = (query || '').trim()
  // Intraday: today's trading-day stories (picks, buzzing stocks, volume/price movers)
  if (scope === 'intraday') { h = Math.min(h, 14); q = q ? `${q} intraday` : 'intraday stocks buzzing stocks' }
  const key = `${scope}|${q.toLowerCase()}|${h}`
  const hit = searchCache.get(key)
  let pool: StoredItem[]

  if (hit && Date.now() - hit.at < SEARCH_CACHE_MS) {
    pool = hit.items
  } else {
    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const tasks: Promise<StoredItem[]>[] = [
      portalFeeds().then(all => words.length === 0 ? all : all.filter(it => {
        const text = `${it.title} ${it.summary || ''}`.toLowerCase()
        return words.every(w => text.includes(w))
      })),
    ]
    if (q) tasks.push(bingNews(q), googleNews(q, h))
    // F&O with no search: also pull derivatives-specific stories (OI build-up, F&O ban, expiry)
    if (scope === 'fno' && !q) tasks.push(bingNews('F&O stocks long buildup short buildup open interest'), googleNews('F&O stocks open interest build-up', h))
    const settled = await Promise.allSettled(tasks)
    pool = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
    if (pool.length === 0 && settled.every(r => r.status === 'rejected')) {
      throw (settled[0] as PromiseRejectedResult).reason
    }
    searchCache.set(key, { at: Date.now(), items: pool })
  }

  // F&O scope: keep stories about F&O stocks or derivatives/index topics
  const scoped = scope !== 'fno' ? pool : pool.flatMap(it => {
    const text = `${it.title} ${it.summary || ''}`
    const stocks = fnoStocksIn(text)
    return stocks.length || FNO_WORDS.test(text) ? [{ ...it, fnoStocks: stocks }] : []
  })

  // Newest first; the same story from several outlets once (prefer a copy that can be read)
  const fresh = scoped
    .filter(it => (Date.now() - it.publishedMs) / 3_600_000 <= h + 1)
    .sort((a, b) => b.publishedMs - a.publishedMs || Number(b.canRead) - Number(a.canRead))
  const seen = new Map<string, StoredItem & { fnoStocks?: string[] }>()
  for (const it of fresh) {
    const fp = fingerprint(it.title)
    const prev = seen.get(fp)
    if (!prev || (!prev.canRead && it.canRead)) seen.set(fp, it)
  }
  // Up to half the slots go to stories that can be opened with read_article (Google's
  // fresher headlines would otherwise crowd them out), the rest to the newest of any kind
  const unique = [...seen.values()].sort((a, b) => b.publishedMs - a.publishedMs)
  const picked = new Set(unique.filter(it => it.canRead).slice(0, Math.ceil(limit / 2)))
  for (const it of unique) { if (picked.size >= limit) break; picked.add(it) }
  return [...picked]
    .sort((a, b) => b.publishedMs - a.publishedMs)
    .map(({ url: _url, publishedMs: _p, fnoStocks, ...pub }) => ({ ...pub, ...(scope === 'fno' ? { fnoStocks } : {}), hoursAgo: Math.round(Math.max(0, (Date.now() - _p) / 3_600_000) * 10) / 10 }))
}

/** Full text of a headline previously returned by fetchNews (by its id). */
export async function readArticle(id: string): Promise<{ title: string; source: string; publishedIST: string; url: string; text: string; truncated: boolean }> {
  const item = byId.get(id)
  if (!item) throw new Error('Unknown article id — call get_news first and use an id from its results')
  if (!item.canRead || !item.url) throw new Error('This headline has no readable link; pick one with canRead: true')
  const host = new URL(item.url).hostname
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw new Error('Refusing to open a local address')

  const html = await getText(item.url, 12_000)
  let text = ''
  // Most news sites publish the full body as JSON-LD (schema.org NewsArticle.articleBody)
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findArticleBody(JSON.parse(m[1].trim()))
      if (found && found.length > text.length) text = found
    } catch { /* malformed block */ }
  }
  if (text.length < 300) {
    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => stripTags(m[1]))
      .filter(p => p.length > 60 && !/cookie|subscribe|sign in|download the app|all rights reserved/i.test(p))
    const joined = paragraphs.join('\n')
    if (joined.length > text.length) text = joined
  }
  text = stripTags(text).replace(/\s+/g, ' ').trim()
  if (text.length < 120) throw new Error('Could not extract the article text (the site may require JavaScript or a subscription)')
  return {
    title: item.title,
    source: item.source,
    publishedIST: item.publishedIST,
    url: item.url,
    text: text.slice(0, ARTICLE_MAX_CHARS),
    truncated: text.length > ARTICLE_MAX_CHARS,
  }
}

function findArticleBody(o: unknown): string {
  if (Array.isArray(o)) {
    for (const v of o) { const r = findArticleBody(v); if (r) return r }
  } else if (o && typeof o === 'object') {
    const body = (o as any).articleBody
    if (typeof body === 'string' && body.length > 0) return body
    for (const v of Object.values(o)) { const r = findArticleBody(v); if (r) return r }
  }
  return ''
}

/**
 * News for many companies at once (the user's whole watchlist): Google News searches
 * batched with OR plus the portal feeds, matched back to each ticker. Few requests, so a
 * 50-symbol sweep takes seconds. Returns ticker → newest matching headlines.
 */
export async function fetchWatchlistNews(
  symbols: { ticker: string; query: string; match: RegExp[] }[],
  hours = 24,
  perSymbol = 3,
): Promise<Map<string, NewsItem[]>> {
  const h = Math.min(Math.max(Math.round(hours), 1), 24 * 7)
  const BATCH = 8
  const batches: string[] = []
  for (let i = 0; i < symbols.length; i += BATCH) batches.push(symbols.slice(i, i + BATCH).map(s => s.query).join(' OR '))

  const settled = await Promise.allSettled([portalFeeds(), ...batches.map(q => googleNews(q, h))])
  const pool = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  if (pool.length === 0 && settled.every(r => r.status === 'rejected')) throw (settled[0] as PromiseRejectedResult).reason

  const fresh = pool.filter(it => (Date.now() - it.publishedMs) / 3_600_000 <= h + 1).sort((a, b) => b.publishedMs - a.publishedMs)
  const out = new Map<string, NewsItem[]>()
  for (const sym of symbols) {
    const seen = new Set<string>()
    const hits: NewsItem[] = []
    for (const it of fresh) {
      const text = `${it.title} ${it.summary || ''}`
      if (!sym.match.some(re => re.test(text))) continue
      const fp = fingerprint(it.title)
      if (seen.has(fp)) continue
      seen.add(fp)
      const { url: _u, publishedMs, summary: _s, ...pub } = it
      hits.push({ ...pub, hoursAgo: Math.round(Math.max(0, (Date.now() - publishedMs) / 3_600_000) * 10) / 10 })
      if (hits.length >= perSymbol) break
    }
    if (hits.length) out.set(sym.ticker, hits)
  }
  return out
}
