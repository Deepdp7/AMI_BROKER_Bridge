/**
 * brokerAuth.ts
 *
 * Every broker the engine can connect, in one table: its name, how its adapter is made, its
 * browser login page (the broker redirects back to http://127.0.0.1:7890/api/callback/<type>)
 * and whether the account's user ID has to be typed in. Used by "add broker", "re-login", the
 * auto re-open on token expiry, the daily re-login, symbol search and BrokerManager.
 */
import type { IBrokerAdapter } from './adapters/IBrokerAdapter'
import { FyersAdapter } from './adapters/fyers/FyersAdapter'
import { KiteAdapter } from './adapters/kite/KiteAdapter'
import { DhanAdapter } from './adapters/dhan/DhanAdapter'
import { FlattradeAdapter } from './adapters/flattrade/FlattradeAdapter'
import { ShoonyaAdapter } from './adapters/shoonya/ShoonyaAdapter'
import { ZebuAdapter } from './adapters/zebu/ZebuAdapter'
import { TradeSmartAdapter } from './adapters/tradesmart/TradeSmartAdapter'
import { UpstoxAdapter } from './adapters/upstox/UpstoxAdapter'
import { AngelAdapter } from './adapters/angel/AngelAdapter'
import { XTS_SITES, createXtsAdapter } from './adapters/xts/XtsAdapter'

export function callbackUrl(brokerType: string): string {
  return `http://127.0.0.1:7890/api/callback/${brokerType}`
}

export interface LoginCredentials {
  apiKey: string
  apiSecret: string
  /** The account's user ID (Dhan needs it to start a login; Noren brokers use it for every call) */
  clientId?: string | null
}

export interface BrokerDef {
  /** For logs and messages */
  name: string
  create: () => IBrokerAdapter
  /** Login page for the account `brokerId`. Dhan asks its server for a login session first.
   *  Absent for brokers that log in with their keys alone (`direct`). */
  loginUrl?: (brokerId: string, creds: LoginCredentials) => string | Promise<string>
  /** Logs in with the saved keys, no browser page (XTS market data): the engine does it by itself */
  direct?: boolean
  /** The account's user ID must be given when adding it ("Dhan Client ID", "Zebu User ID") */
  userId?: { label: string; upperCase?: boolean }
}

export const BROKERS: Record<string, BrokerDef> = {
  fyers: {
    name: 'Fyers',
    create: () => new FyersAdapter(),
    loginUrl: (brokerId, c) => `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${encodeURIComponent(c.apiKey)}&redirect_uri=${encodeURIComponent(callbackUrl('fyers'))}&response_type=code&state=${encodeURIComponent(brokerId)}`,
  },
  zerodha_kite: { name: 'Kite', create: () => new KiteAdapter(), loginUrl: (brokerId, c) => KiteAdapter.loginUrl(c.apiKey, brokerId) },
  dhan: {
    name: 'Dhan',
    create: () => new DhanAdapter(),
    loginUrl: (_id, c) => DhanAdapter.loginUrl(c.clientId || '', c.apiKey, c.apiSecret),
    userId: { label: 'Dhan Client ID' },
  },
  flattrade: { name: 'Flattrade', create: () => new FlattradeAdapter(), loginUrl: (_id, c) => FlattradeAdapter.loginUrl(c.apiKey) },
  shoonya: { name: 'Shoonya', create: () => new ShoonyaAdapter(), loginUrl: (_id, c) => ShoonyaAdapter.loginUrl(c.apiKey), userId: { label: 'Shoonya User ID', upperCase: true } },
  zebu: { name: 'Zebu', create: () => new ZebuAdapter(), loginUrl: (_id, c) => ZebuAdapter.loginUrl(c.apiKey), userId: { label: 'Zebu User ID', upperCase: true } },
  tradesmart: { name: 'TradeSmart', create: () => new TradeSmartAdapter(), loginUrl: (_id, c) => TradeSmartAdapter.loginUrl(c.apiKey), userId: { label: 'TradeSmart User ID', upperCase: true } },
  upstox: { name: 'Upstox', create: () => new UpstoxAdapter(), loginUrl: (brokerId, c) => UpstoxAdapter.loginUrl(c.apiKey, brokerId) },
  angel_one: { name: 'Angel One', create: () => new AngelAdapter(), loginUrl: (brokerId, c) => AngelAdapter.loginUrl(c.apiKey, brokerId) },
  ...Object.fromEntries(XTS_SITES.map(site => [site.type, { name: site.label, create: () => createXtsAdapter(site.type), direct: true } satisfies BrokerDef])),
}

/** True for a broker that logs in with its keys alone (no browser) */
export const isDirectLogin = (brokerType: string) => !!BROKERS[brokerType]?.direct

/** Broker types the engine can connect */
export const LOGIN_BROKERS = new Set(Object.keys(BROKERS))

export const BROKER_NAMES: Record<string, string> = Object.fromEntries(Object.entries(BROKERS).map(([type, b]) => [type, b.name]))

/** Login page for `brokerId` */
export async function brokerLoginUrl(brokerType: string, brokerId: string, creds: LoginCredentials): Promise<string> {
  const def = BROKERS[brokerType]
  if (!def) throw new Error(`${brokerType} is not supported yet`)
  if (!def.loginUrl) throw new Error(`${def.name} logs in with its keys; there is no login page`)
  return def.loginUrl(brokerId, creds)
}
