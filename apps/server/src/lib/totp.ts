/**
 * totp.ts — the 6-digit codes of an authenticator app (RFC 6238: HMAC-SHA1, 30 s, 6 digits), made
 * from the app's secret key, so a login that asks for a code each day can run by itself.
 */
import { createHmac } from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Base32 text (spaces, dashes and lower case allowed, "=" padding ignored) → bytes; null if it isn't base32 */
export function base32Decode(text: string): Buffer | null {
  const clean = text.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (!clean || /[^A-Z2-7]/.test(clean)) return null
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch)
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8 }
  }
  return Buffer.from(out)
}

/** The code for `secret` (base32) at `nowMs` */
export function totpCode(secret: string, nowMs = Date.now(), digits = 6, stepSec = 30): string {
  const key = base32Decode(secret)
  if (!key || !key.length) throw new Error('The authenticator secret key is not valid (it should be letters and the digits 2-7)')
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / stepSec)))
  const h = createHmac('sha1', key).update(counter).digest()
  const o = h[h.length - 1] & 0xf
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

/** Seconds left before the current code changes */
export function totpSecondsLeft(nowMs = Date.now(), stepSec = 30): number {
  return stepSec - (Math.floor(nowMs / 1000) % stepSec)
}
