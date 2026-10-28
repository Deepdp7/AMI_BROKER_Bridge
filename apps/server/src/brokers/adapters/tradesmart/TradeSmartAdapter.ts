/**
 * TradeSmartAdapter.ts — TradeSmart API v2 (Noren platform), OAuth login.
 *
 * Keys: TradeSmart API dashboard → create an app with the redirect URL
 * http://127.0.0.1:7890/api/callback/tradesmart and the PC's static IP; copy its App ID
 * (the OAuth Client ID) and Secret key.
 * Login: see NorenOAuthAdapter (v2api.tradesmartonline.in/OAuthlogin → ?code= → GenAcsTok).
 *
 * Data: v2api.tradesmartonline.in/NorenWClientAPIv2 with the Bearer header on every call, no
 * jKey (checked: a fake token answers "Session Expired"); feed .../NorenWSAPI/.
 * Limits: 10 requests a second and 120 a minute per user ("… exceeds Limit 120 for user").
 */
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster } from '../InstrumentMaster'
import type { NorenEndpoints } from '../noren/NorenAdapter'
import { NorenOAuthAdapter, norenOAuthLoginUrl, downloadNorenSymbolZips, type NorenOAuthSite } from '../noren/NorenOAuthAdapter'

const HOST = 'https://v2api.tradesmartonline.in'

const historyLimiter = new RateLimiter(5, 100)

/** One instrument list for every TradeSmart account */
export const tradesmartMaster = new InstrumentMaster('tradesmart', () => downloadNorenSymbolZips(HOST))

export class TradeSmartAdapter extends NorenOAuthAdapter {
  protected readonly label = 'TradeSmart'
  protected readonly master = tradesmartMaster
  protected readonly historyLimiter = historyLimiter
  protected readonly site: NorenOAuthSite = { host: HOST, keysWhere: 'in your TradeSmart API app' }
  protected readonly endpoints: NorenEndpoints = {
    rest: `${HOST}/NorenWClientAPIv2`,
    ws: 'wss://v2api.tradesmartonline.in/NorenWSAPI/',
    tokenIn: 'bearer',
    chartTokenIn: 'bearer',
    sendActid: false,
  }

  static loginUrl(clientId: string): string {
    return norenOAuthLoginUrl(HOST, clientId)
  }
}
