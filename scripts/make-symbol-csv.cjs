#!/usr/bin/env node
/**
 * Makes the ready-to-import symbol lists in symbols/ (Symbol Setup → Import CSV):
 *
 *   symbols/indices.csv    the main NSE / BSE indices
 *   symbols/nifty50.csv    Nifty 50 shares
 *   symbols/nifty500.csv   Nifty 500 shares (includes the Nifty 50)
 *
 * Format of every line: ticker,exchange,type  (the same as Export CSV writes).
 *
 * The share lists come from NSE's own index files, and each share is checked against
 * Zerodha's public instrument list so every ticker is a real, current NSE equity; names that
 * are not found are reported and left out. Run again whenever the indices change (NSE
 * rebalances them twice a year):
 *
 *   node scripts/make-symbol-csv.cjs
 */
const fs = require('fs')
const path = require('path')

const OUT = path.resolve(__dirname, '..', 'symbols')
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }

// Plain index names the app resolves for every broker (see brokers/adapters/symbolKey.ts)
const INDICES = [
  ['NIFTY', 'NSE'], ['BANKNIFTY', 'NSE'], ['FINNIFTY', 'NSE'], ['MIDCPNIFTY', 'NSE'],
  ['NIFTYNXT50', 'NSE'], ['INDIAVIX', 'NSE'], ['SENSEX', 'BSE'], ['BANKEX', 'BSE'],
]

async function get(url) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

/** Minimal CSV line reader (quotes, commas inside quotes) */
function fields(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function column(rows, name) {
  const i = fields(rows[0]).map(h => h.trim().toLowerCase()).indexOf(name)
  if (i < 0) throw new Error(`No "${name}" column in: ${rows[0]}`)
  return rows.slice(1).map(r => fields(r)[i]?.trim()).filter(Boolean)
}

const lines = text => text.split(/\r?\n/).filter(l => l.trim())

function write(file, header, rows) {
  const body = rows.map(r => r.join(',')).join('\n')
  fs.writeFileSync(path.join(OUT, file), `# ${header}\nticker,exchange,type\n${body}\n`)
  console.log(`  ${file}: ${rows.length} symbols`)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  console.log('Downloading the index lists and the instrument list…')
  const [n50, n500, kite] = await Promise.all([
    get('https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv'),
    get('https://www.niftyindices.com/IndexConstituent/ind_nifty500list.csv'),
    get('https://api.kite.trade/instruments'),
  ])

  // NSE equities Zerodha lists today
  const kl = lines(kite)
  const head = fields(kl[0])
  const [iSym, iType, iExch] = ['tradingsymbol', 'instrument_type', 'exchange'].map(h => head.indexOf(h))
  const listed = new Set()
  for (const l of kl.slice(1)) {
    const f = fields(l)
    if (f[iExch] === 'NSE' && f[iType] === 'EQ') listed.add(f[iSym])
  }
  console.log(`  ${listed.size} NSE equities in the instrument list`)

  const shares = (text, label) => {
    const names = [...new Set(column(lines(text), 'symbol'))]
    const missing = names.filter(s => !listed.has(s))
    if (missing.length) console.log(`  ${label}: not in the instrument list, left out: ${missing.join(', ')}`)
    return names.filter(s => listed.has(s)).sort()
  }
  const set50 = shares(n50, 'Nifty 50')
  const set500 = shares(n500, 'Nifty 500')

  const stamp = new Date().toISOString().slice(0, 10)
  console.log('Writing symbols/')
  write('indices.csv', `Main indices — made ${stamp}`, INDICES.map(([t, e]) => [t, e, 'INDEX']))
  write('nifty50.csv', `Nifty 50 shares — made ${stamp}`, set50.map(s => [s, 'NSE', 'EQ']))
  write('nifty500.csv', `Nifty 500 shares — made ${stamp}`, set500.map(s => [s, 'NSE', 'EQ']))
}

main().catch(e => {
  console.error(e.message)
  process.exit(1)
})
