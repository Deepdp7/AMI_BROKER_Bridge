/**
 * FlattradeAdapter.ts — Flattrade Pi API (Noren platform).
 *
 * Keys: wall.flattrade.in → Pi → API, create a key with the redirect URL
 * http://127.0.0.1:7890/api/callback/flattrade and the PC's static IP.
 * Login: browser → auth.flattrade.in/?app_key=… → redirect with ?code=…&client=<user id> →
 * POST authapi.flattrade.in/trade/apitoken {api_key, request_code,
 * api_secret: sha256(api_key + code + api_secret)} → token, valid for the trading day.
 *
 * Data: piconnect.flattrade.in/PiConnectAPI (jData + jKey), feed PiConnectWSAPI.
 * Data API limits: 40 requests/second and 200 a minute at most; history is paced well below.
 */
import crypto from 'crypto'
import type { BrokerCredentials } from '../IBrokerAdapter'
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster, type MasterRecord } from '../InstrumentMaster'
import { NorenAdapter, type NorenEndpoints } from '../noren/NorenAdapter'
import { parseNorenInstruments } from '../noren/NorenInstruments'

const SCRIP_MASTER = 'https://flattrade.s3.ap-south-1.amazonaws.com/scripmaster'
const FILES = ['NSE_Equity', 'BSE_Equity', 'Nfo_Equity_Derivatives', 'Nfo_Index_Derivatives', 'Commodity']

// Shared by every caller: backfill workers, auto-refresh, startup fetches
const historyLimiter = new RateLimiter(5, 100)

async function downloadFlattradeInstruments(): Promise<MasterRecord[]> {
  const files = await Promise.all(FILES.map(async name => {
    const res = await fetch(`${SCRIP_MASTER}/${name}.csv`, { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${res.statusText}`)
    return res.text()
  }))
  return parseNorenInstruments(...files)
}

/** One instrument list for every Flattrade account */
export const flattradeMaster = new InstrumentMaster('flattrade', downloadFlattradeInstruments)

export class FlattradeAdapter extends NorenAdapter {
  protected readonly label = 'Flattrade'
  protected readonly master = flattradeMaster
  protected readonly historyLimiter = historyLimiter
  protected readonly endpoints: NorenEndpoints = {
    rest: 'https://piconnect.flattrade.in/PiConnectAPI',
    ws: 'wss://piconnect.flattrade.in/PiConnectWSAPI/',
    tokenIn: 'jKey',
    sendActid: true,
  }

  static loginUrl(apiKey: string): string {
    return `https://auth.flattrade.in/?app_key=${encodeURIComponent(apiKey)}`
  }

  protected async login(credentials: BrokerCredentials) {
    const apiKey = (credentials.apiKey || '').trim()
    const apiSecret = (credentials.apiSecret || '').trim()
    const code = credentials.requestToken || ''
    if (!apiKey || !apiSecret) throw new Error(`Flattrade login missing parameters. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}`)
    const res = await fetch('https://authapi.flattrade.in/trade/apitoken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        request_code: code,
        api_secret: crypto.createHash('sha256').update(`${apiKey}${code}${apiSecret}`).digest('hex'),
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const body: any = await res.json().catch(() => null)
    if (body?.stat !== 'Ok' || !body.token) {
      // Wrong keys or a used code come back as Not_Ok with an empty emsg
      throw new Error(`Flattrade login failed: ${body?.emsg || (res.ok ? 'the API key, secret key or login code was not accepted (check the keys on wall.flattrade.in → Pi)' : `HTTP ${res.status}`)}`)
    }
    return { accessToken: String(body.token), uid: String(body.client || credentials.clientId || '').trim() }
  }
}
