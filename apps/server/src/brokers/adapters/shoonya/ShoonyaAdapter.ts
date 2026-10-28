/**
 * ShoonyaAdapter.ts — Shoonya (Finvasia) API, OAuth login since 2026 (Noren platform).
 *
 * Keys: trade.shoonya.com → profile → API Key shows the Client ID and Secret code; the
 * account's static IP must be registered there too (Shoonya refuses API calls from others).
 * Login: see NorenOAuthAdapter (api.shoonya.com/OAuthlogin → ?code= → GenAcsTok).
 *
 * Data: api.shoonya.com/NorenWClientAPI (Bearer header; chart endpoints take jKey), feed
 * NorenWSAPI. Market data REST is about 1 request/second per instrument, history lower.
 */
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster } from '../InstrumentMaster'
import type { NorenEndpoints } from '../noren/NorenAdapter'
import { NorenOAuthAdapter, norenOAuthLoginUrl, downloadNorenSymbolZips, type NorenOAuthSite } from '../noren/NorenOAuthAdapter'

const API = 'https://api.shoonya.com'

// Shared by every caller: backfill workers, auto-refresh, startup fetches
const historyLimiter = new RateLimiter(2, 60)

/** One instrument list for every Shoonya account */
export const shoonyaMaster = new InstrumentMaster('shoonya', () => downloadNorenSymbolZips(API))

export class ShoonyaAdapter extends NorenOAuthAdapter {
  protected readonly label = 'Shoonya'
  protected readonly master = shoonyaMaster
  protected readonly historyLimiter = historyLimiter
  protected readonly site: NorenOAuthSite = { host: API, keysWhere: 'under API Key on trade.shoonya.com' }
  protected readonly endpoints: NorenEndpoints = {
    rest: `${API}/NorenWClientAPI`,
    ws: 'wss://api.shoonya.com/NorenWSAPI/',
    tokenIn: 'bearer',
    sendActid: false,
  }

  static loginUrl(clientId: string): string {
    return norenOAuthLoginUrl(API, clientId)
  }
}
