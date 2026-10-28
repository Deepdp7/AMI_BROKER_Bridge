/**
 * NorenOAuthAdapter.ts
 *
 * The Noren brokers that log in the same way (Shoonya, Zebu, TradeSmart): the browser opens
 * <host>/OAuthlogin/authorize/oauth?client_id=…, the broker redirects back with ?code=… (single
 * use, short-lived), and POST <rest>/GenAcsTok jData={code, checksum: sha256(client id + secret
 * + code)} returns the day's access token. A wrong id / secret, or a code already used, answers
 * stat "Not_Ok" with emsg 'Error Occurred : 5 "no data"' (checked on all three, Oct 2026).
 *
 * Each also publishes its symbol lists the same way: <host>/{NSE,BSE,NFO,MCX}_symbols.txt.zip.
 */
import crypto from 'crypto'
import type { BrokerCredentials } from '../IBrokerAdapter'
import type { MasterRecord } from '../InstrumentMaster'
import { NorenAdapter, norenBody } from './NorenAdapter'
import { parseNorenInstruments } from './NorenInstruments'
import { unzipFirstFile } from '../../../lib/unzip'

export interface NorenOAuthSite {
  /** Where the symbol lists and the login page live, e.g. https://go.mynt.in */
  host: string
  /** Where on the broker's site the API key, redirect URL and static IP are set */
  keysWhere: string
}

/** The broker's browser login page */
export function norenOAuthLoginUrl(host: string, clientId: string): string {
  return `${host}/OAuthlogin/authorize/oauth?client_id=${encodeURIComponent(clientId)}`
}

/** Downloads <host>/{NSE,BSE,NFO,MCX}_symbols.txt.zip and reads them into one list */
export async function downloadNorenSymbolZips(host: string): Promise<MasterRecord[]> {
  const files = await Promise.all(['NSE', 'BSE', 'NFO', 'MCX'].map(async ex => {
    const res = await fetch(`${host}/${ex}_symbols.txt.zip`, { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`${ex}: HTTP ${res.status} ${res.statusText}`)
    return unzipFirstFile(Buffer.from(await res.arrayBuffer())).toString('utf8')
  }))
  return parseNorenInstruments(...files)
}

export abstract class NorenOAuthAdapter extends NorenAdapter {
  protected abstract readonly site: NorenOAuthSite

  protected async login(credentials: BrokerCredentials) {
    const clientId = (credentials.apiKey || '').trim()
    const secret = (credentials.apiSecret || '').trim()
    const code = credentials.requestToken || ''
    if (!clientId || !secret) throw new Error(`${this.label} login missing parameters. Client ID: ${!!clientId}, Secret code: ${!!secret}`)
    const res = await fetch(`${this.endpoints.rest}/GenAcsTok`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: norenBody({ code, checksum: crypto.createHash('sha256').update(`${clientId}${secret}${code}`).digest('hex') }),
      signal: AbortSignal.timeout(30_000),
    })
    const body: any = await res.json().catch(() => null)
    const token = body?.susertoken || body?.access_token || body?.accesstoken
    if (body?.stat !== 'Ok' || !token) {
      const reason = /no data/i.test(body?.emsg || '')
        ? 'the Client ID, Secret code or login code was not accepted (codes work once and expire quickly; log in again)'
        : body?.emsg || `HTTP ${res.status}`
      const hint = /\bip\b|whitelist/i.test(reason) ? ` — register this PC's internet (static) IP address ${this.site.keysWhere}` : ''
      throw new Error(`${this.label} login failed: ${reason}${hint}`)
    }
    // Not every broker names the user in the answer: the user ID typed when adding the broker then
    return { accessToken: String(token), uid: String(body.uid || body.actid || credentials.clientId || '').trim().toUpperCase() }
  }
}
