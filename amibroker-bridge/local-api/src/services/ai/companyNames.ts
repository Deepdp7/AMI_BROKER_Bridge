/**
 * companyNames.ts — ticker → company name, from the Fyers master files already on disk
 * (column 1 = name, column 13 = underlying ticker). News is written with company names
 * ("Nazara Technologies"), not tickers ("NAZARA"), so matching headlines needs both.
 */
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '../../db'

let names: Map<string, string> | null = null

// "TATA CONSULTANCY SERV LT" → "Tata Consultancy Serv"; "MAHINDRA & MAHINDRA LTD" → "Mahindra & Mahindra"
function clean(raw: string): string {
  const words = raw.replace(/\s+/g, ' ').trim()
    .replace(/\b(LIMITED|LTD\.?|LT|LIMI|LIMIT|CO\.?|CORP|CORPN|INC|PVT)\s*$/i, '')
    .replace(/\b(LIMITED|LTD\.?)\s*$/i, '')
    .trim()
    .split(' ')
  return words.map(w => w[0] + w.slice(1).toLowerCase()).join(' ')
}

function load(): Map<string, string> {
  if (names) return names
  names = new Map()
  for (const file of ['BSE_CM.csv', 'NSE_CM.csv']) {   // NSE last so it wins
    const p = path.join(DATA_DIR, 'fyers_master', file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const parts = line.split(',')
      if (parts.length < 14 || !parts[9]?.endsWith('-EQ')) continue
      const ticker = parts[13]?.trim()
      const name = parts[1]?.trim()
      if (ticker && name) names.set(ticker.toUpperCase(), clean(name))
    }
  }
  return names
}

export function companyName(ticker: string): string | undefined {
  return load().get(ticker.toUpperCase())
}

// First words that alone would match many unrelated companies
const GENERIC = new Set(['tata', 'hdfc', 'icici', 'bajaj', 'adani', 'state', 'bharat', 'hindustan', 'indian', 'india', 'jsw', 'sbi', 'larsen', 'the', 'national', 'power', 'oil', 'axis', 'kotak', 'mahindra', 'reliance', 'apollo', 'sun', 'ultratech', 'grasim', 'shree', 'eicher', 'hero', 'divis', 'dr', 'tech', 'life'])

/**
 * Phrases a headline about `ticker` is likely to contain: the company name's first two
 * words (e.g. "Nazara Technologies"), its first word when distinctive ("Infosys"), and
 * the ticker itself when it reads like a word (TCS, ITC, LT…).
 */
export function newsTerms(ticker: string): { query: string; match: RegExp[] } {
  const name = companyName(ticker)
  const words = (name || '').split(' ').filter(Boolean)
  const phrases = new Set<string>()
  if (words.length >= 2) phrases.add(words.slice(0, 2).join(' '))
  if (words[0] && !GENERIC.has(words[0].toLowerCase()) && words[0].length >= 4) phrases.add(words[0])
  if (!phrases.size && name) phrases.add(name)
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = [...phrases].map(p => new RegExp(`\\b${esc(p)}\\b`, 'i'))
  if (/^[A-Z&]{2,10}$/.test(ticker)) match.push(new RegExp(`(^|[^A-Za-z])${esc(ticker)}([^A-Za-z]|$)`))   // case-sensitive ticker
  const query = words.length >= 2 ? `"${words.slice(0, 2).join(' ')}"` : `"${name || ticker}"`
  return { query, match }
}
