/**
 * Encryption for the broker secrets kept in the database (API key, API secret, login token).
 *
 * Values are sealed with AES-256-GCM under one random 32-byte key. That key lives in
 * %APPDATA%\DataBridgePro\secret.key, itself locked with Windows DPAPI for the current user:
 * a copy of the database (or of the whole folder) is useless on another PC or Windows account.
 *
 * Where the key comes from:
 *   - DATABRIDGE_SECRET_KEY (hex), set by the desktop app, which unlocks secret.key natively.
 *     Set but empty: the app could not unlock it; secrets are then stored as before (plain).
 *   - Not set at all (`npm run dev`, no app around it): unlocked here through PowerShell.
 *
 * Stored form: "enc1:" + base64(iv 12 bytes | tag 16 bytes | ciphertext). Values without the
 * prefix are plain text from older versions; they are still read, and sealed on next start.
 */
import crypto from 'crypto'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const PREFIX = 'enc1:'
/** %APPDATA% first, as the desktop app looks it up */
export const SECRET_KEY_FILE = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'DataBridgePro', 'secret.key')
/** Must match the desktop app's (src-tauri/src/secret_key.rs) */
const DPAPI_ENTROPY = 'DataBridgePro secret key v1'

function keyFromPowerShell(): Buffer | null {
  if (process.platform !== 'win32') return null
  // Unlocks secret.key, or creates it; a file DPAPI can't open (other PC/account) is set aside
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$f = $env:DBP_KEY_FILE
$e = [Text.Encoding]::UTF8.GetBytes($env:DBP_KEY_ENTROPY)
$k = $null
if (Test-Path -LiteralPath $f) {
  try { $k = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($f), $e, 'CurrentUser') }
  catch { Move-Item -LiteralPath $f -Destination ($f + '.unreadable-' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -Force }
}
if ($null -eq $k -or $k.Length -ne 32) {
  $k = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($k)
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $f) | Out-Null
  [IO.File]::WriteAllBytes($f, [Security.Cryptography.ProtectedData]::Protect($k, $e, 'CurrentUser'))
}
[BitConverter]::ToString($k).Replace('-', '')`
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    env: { ...process.env, DBP_KEY_FILE: SECRET_KEY_FILE, DBP_KEY_ENTROPY: DPAPI_ENTROPY },
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  })
  const hex = (r.stdout || '').trim()
  return /^[0-9A-Fa-f]{64}$/.test(hex) ? Buffer.from(hex, 'hex') : null
}

function loadKey(): Buffer | null {
  const fromApp = process.env.DATABRIDGE_SECRET_KEY
  // Not passed on to anything this process starts
  delete process.env.DATABRIDGE_SECRET_KEY
  if (fromApp !== undefined) return /^[0-9A-Fa-f]{64}$/.test(fromApp) ? Buffer.from(fromApp, 'hex') : null
  try {
    return keyFromPowerShell()
  } catch {
    return null
  }
}

const key = loadKey()
console.log(key ? '[Secrets] Broker credentials are encrypted (Windows DPAPI)' : '[Secrets] WARNING: no encryption key, broker credentials are stored unencrypted')

export const secretsEncrypted = () => key !== null

export function isSealed(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/** Encrypts a value for the database. Null stays null; without a key the value is kept as is. */
export function seal(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null
  if (!key || isSealed(value)) return value
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}

/**
 * Decrypts a value from the database. Plain (older) values pass through. Null when it can't
 * be decrypted (no key, or the key changed): the account then simply needs a new login.
 */
export function open(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (!isSealed(value)) return value
  if (!key) return null
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
