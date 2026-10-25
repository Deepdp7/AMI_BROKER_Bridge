/**
 * ShoonyaAdapter.ts — Shoonya (Finvasia) API, OAuth login since 2026 (Noren platform).
 *
 * Keys: trade.shoonya.com → profile → API Key shows the Client ID and Secret code; the
 * account's static IP must be registered there too (Shoonya refuses API calls from others).
 * Login: browser → api.shoonya.com/OAuthlogin/authorize/oauth?client_id=… → redirect with
 * ?code=… (single use, short-lived) → POST NorenWClientAPI/GenAcsTok
 * jData={code, checksum: sha256(client_id + secret + code)} → access token.
 *
 * Data: api.shoonya.com/NorenWClientAPI (Bearer header; chart endpoints take jKey), feed
 * NorenWSAPI. Market data REST is about 1 request/second per instrument, history lower.
 */
import crypto from 'crypto'
import type { BrokerCredentials } from '../IBrokerAdapter'
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster, type MasterRecord } from '../InstrumentMaster'
import { NorenAdapter, norenBody, type NorenEndpoints } from '../noren/NorenAdapter'
import { parseNorenInstruments } from '../noren/NorenInstruments'
import { unzipFirstFile } from '../../../lib/unzip'

const API = 'https://api.shoonya.com'
const EXCHANGES = ['NSE', 'BSE', 'NFO', 'MCX']

// Shared by every caller: backfill workers, auto-refresh, startup fetches
const historyLimiter = new RateLimiter(2, 60)

async function downloadShoonyaInstruments(): Promise<MasterRecord[]> {
  const files = await Promise.all(EXCHANGES.map(async ex => {
    const res = await fetch(`${API}/${ex}_symbols.txt.zip`, { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`${ex}: HTTP ${res.status} ${res.statusText}`)
    return unzipFirstFile(Buffer.from(await res.arrayBuffer())).toString('utf8')
  }))
  return parseNorenInstruments(...files)
}

/** One instrument list for every Shoonya account */
export const shoonyaMaster = new InstrumentMaster('shoonya', downloadShoonyaInstruments)

export class ShoonyaAdapter extends NorenAdapter {
  protected readonly label = 'Shoonya'
  protected readonly master = shoonyaMaster
  protected readonly historyLimiter = historyLimiter
  protected readonly endpoints: NorenEndpoints = {
    rest: `${API}/NorenWClientAPI`,
    ws: 'wss://api.shoonya.com/NorenWSAPI/',
    tokenIn: 'bearer',
    sendActid: false,
  }

  static loginUrl(clientId: string): string {
    return `${API}/OAuthlogin/authorize/oauth?client_id=${encodeURIComponent(clientId)}`
  }

  protected async login(credentials: BrokerCredentials) {
    const clientId = (credentials.apiKey || '').trim()
    const secret = (credentials.apiSecret || '').trim()
    const code = credentials.requestToken || ''
    if (!clientId || !secret) throw new Error(`Shoonya login missing parameters. Client ID: ${!!clientId}, Secret code: ${!!secret}`)
    const res = await fetch(`${API}/NorenWClientAPI/GenAcsTok`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: norenBody({ code, checksum: crypto.createHash('sha256').update(`${clientId}${secret}${code}`).digest('hex') }),
      signal: AbortSignal.timeout(30_000),
    })
    const body: any = await res.json().catch(() => null)
    const token = body?.susertoken || body?.access_token
    if (body?.stat !== 'Ok' || !token) {
      // A wrong Client ID / Secret code, or a code already used, answers "no data"
      const reason = /no data/i.test(body?.emsg || '')
        ? 'the Client ID, Secret code or login code was not accepted (codes work once and expire quickly; log in again)'
        : body?.emsg || `HTTP ${res.status}`
      const hint = /\bip\b|whitelist/i.test(reason) ? ' — register this PC\'s internet (static) IP address under API Key on trade.shoonya.com' : ''
      throw new Error(`Shoonya login failed: ${reason}${hint}`)
    }
    return { accessToken: String(token), uid: String(body.uid || body.actid || credentials.clientId || '').trim().toUpperCase() }
  }
}
