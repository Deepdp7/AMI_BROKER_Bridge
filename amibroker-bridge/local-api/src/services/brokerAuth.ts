/**
 * brokerAuth.ts
 *
 * Browser login URLs of the brokers that log in through a redirect to this app
 * (http://127.0.0.1:7890/api/callback/<broker type>). Used by "add broker", "re-login",
 * the auto re-open on token expiry and the daily re-login.
 */
import { KiteAdapter } from './adapters/KiteAdapter'
import { DhanAdapter } from './adapters/DhanAdapter'

/** Broker types the engine can connect */
export const LOGIN_BROKERS = new Set(['fyers', 'zerodha_kite', 'dhan'])

export const BROKER_NAMES: Record<string, string> = { fyers: 'Fyers', zerodha_kite: 'Kite', dhan: 'Dhan' }

export function callbackUrl(brokerType: string): string {
  return `http://127.0.0.1:7890/api/callback/${brokerType}`
}

export interface LoginCredentials {
  apiKey: string
  apiSecret: string
  /** Dhan Client ID (Dhan needs it to start a login) */
  clientId?: string | null
}

/** Login page for `brokerId`. Dhan asks its server for a login session first. */
export async function brokerLoginUrl(brokerType: string, brokerId: string, creds: LoginCredentials): Promise<string> {
  switch (brokerType) {
    case 'fyers':
      return `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${encodeURIComponent(creds.apiKey)}&redirect_uri=${encodeURIComponent(callbackUrl('fyers'))}&response_type=code&state=${encodeURIComponent(brokerId)}`
    case 'zerodha_kite':
      return KiteAdapter.loginUrl(creds.apiKey, brokerId)
    case 'dhan':
      return DhanAdapter.loginUrl(creds.clientId || '', creds.apiKey, creds.apiSecret)
    default:
      throw new Error(`${brokerType} is not supported yet`)
  }
}
