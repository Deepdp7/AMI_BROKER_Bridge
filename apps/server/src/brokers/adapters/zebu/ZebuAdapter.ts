/**
 * ZebuAdapter.ts — Zebu MYNT API (Noren platform), OAuth login.
 *
 * Keys: in the MYNT app / go.mynt.in → API, create an app with the redirect URL
 * http://127.0.0.1:7890/api/callback/zebu and the PC's static IP (mandatory); it shows the
 * OAuth Client ID (your user ID followed by "_U") and the Secret key.
 * Login: see NorenOAuthAdapter (go.mynt.in/OAuthlogin → ?code= → GenAcsTok).
 *
 * Data: go.mynt.in/NorenWClientAPI with the Bearer header on every call, TPSeries included
 * (checked: a fake token there answers "Session Expired"); feed wss://go.mynt.in/NorenWSAPI/.
 * Zebu allows about 10 requests a second per user; history is paced well below that.
 */
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster } from '../InstrumentMaster'
import type { NorenEndpoints } from '../noren/NorenAdapter'
import { NorenOAuthAdapter, norenOAuthLoginUrl, downloadNorenSymbolZips, type NorenOAuthSite } from '../noren/NorenOAuthAdapter'

const HOST = 'https://go.mynt.in'

const historyLimiter = new RateLimiter(4, 90)

/** One instrument list for every Zebu account */
export const zebuMaster = new InstrumentMaster('zebu', () => downloadNorenSymbolZips(HOST))

export class ZebuAdapter extends NorenOAuthAdapter {
  protected readonly label = 'Zebu'
  protected readonly master = zebuMaster
  protected readonly historyLimiter = historyLimiter
  protected readonly site: NorenOAuthSite = { host: HOST, keysWhere: 'in your Zebu MYNT API app' }
  protected readonly endpoints: NorenEndpoints = {
    rest: `${HOST}/NorenWClientAPI`,
    ws: 'wss://go.mynt.in/NorenWSAPI/',
    tokenIn: 'bearer',
    chartTokenIn: 'bearer',
    sendActid: false,
  }

  static loginUrl(clientId: string): string {
    return norenOAuthLoginUrl(HOST, clientId)
  }
}
