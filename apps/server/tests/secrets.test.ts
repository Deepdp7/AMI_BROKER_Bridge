/**
 * DataBridge Pro — broker credentials are encrypted in the database (src/lib/secretBox.ts)
 * Runs against its own SQLite file in a temp home folder, with a test key.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-secrets-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'secrets.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'
process.env.DATABRIDGE_SECRET_KEY = crypto.randomBytes(32).toString('hex')

// A database saved by an older version: credentials in plain text
{
  const { DatabaseSync } = require('node:sqlite')
  const old = new DatabaseSync(process.env.DATABRIDGE_DB_PATH)
  old.exec(`CREATE TABLE brokers (id TEXT PRIMARY KEY, broker_type TEXT, label TEXT, credential_ref TEXT, api_key TEXT,
    api_secret TEXT, access_token TEXT, status TEXT, health_score INTEGER, reconnect_count_1h INTEGER, account_id TEXT,
    created_at INTEGER, last_connected_at INTEGER)`)
  old.prepare('INSERT INTO brokers (id, broker_type, label, api_key, api_secret, access_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('fyers-old', 'fyers', 'Fyers', 'APPID-100', 'plain-secret', 'plain-token', 1)
  old.close()
}

let db: typeof import('../src/db')
let box: typeof import('../src/lib/secretBox')
const onDisk = (id: string) => db.sqlite.prepare('SELECT api_key, api_secret, access_token FROM brokers WHERE id = ?').get(id) as any

beforeAll(async () => {
  box = await import('../src/lib/secretBox')
  db = await import('../src/db')
  await db.syncCachesPromise
})

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

describe('secretBox', () => {
  it('takes the key from the app and hides it from child processes', () => {
    expect(box.secretsEncrypted()).toBe(true)
    expect(process.env.DATABRIDGE_SECRET_KEY).toBeUndefined()
  })

  it('round-trips, and seals the same value differently each time', () => {
    const a = box.seal('my-api-secret')!
    const b = box.seal('my-api-secret')!
    expect(a.startsWith('enc1:')).toBe(true)
    expect(a).not.toBe(b)
    expect(a).not.toContain('my-api-secret')
    expect(box.open(a)).toBe('my-api-secret')
    expect(box.open(b)).toBe('my-api-secret')
  })

  it('passes plain (older) values and nulls through', () => {
    expect(box.open('plain')).toBe('plain')
    expect(box.open(null)).toBeNull()
    expect(box.seal(null)).toBeNull()
    expect(box.seal('')).toBe('')
  })

  it('refuses a tampered or foreign value instead of returning garbage', () => {
    const sealed = box.seal('token-123')!
    const raw = Buffer.from(sealed.slice(5), 'base64')
    raw[raw.length - 1] ^= 1
    expect(box.open('enc1:' + raw.toString('base64'))).toBeNull()
    expect(box.open('enc1:AAAA')).toBeNull()
  })
})

describe('Database', () => {
  it('encrypts credentials saved by an older version on start, and still reads them', () => {
    const row = onDisk('fyers-old')
    for (const v of [row.api_key, row.api_secret, row.access_token]) expect(v.startsWith('enc1:')).toBe(true)
    expect(db.stmts.getCredentials.get('fyers-old')).toEqual({ apiKey: 'APPID-100', apiSecret: 'plain-secret', accessToken: 'plain-token' })
  })

  it('stores new credentials encrypted, and keeps them plain only in memory', () => {
    db.stmts.insertBroker.run({ id: 'kite-new', broker_type: 'kite', label: 'Kite', credential_ref: 'x', status: 'auth_required', health_score: 100, reconnect_count_1h: 0, account_id: null, created_at: 2, last_connected_at: null })
    db.stmts.upsertCredentials.run('kite-new', { apiKey: 'kite-key', apiSecret: 'kite-secret', accessToken: 'kite-token' })
    const row = onDisk('kite-new')
    expect(JSON.stringify(row)).not.toMatch(/kite-(key|secret|token)/)
    expect(db.stmts.getCredentials.get('kite-new')).toEqual({ apiKey: 'kite-key', apiSecret: 'kite-secret', accessToken: 'kite-token' })
  })

  it('leaves no credential readable anywhere in the database file', () => {
    db.sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    const file = fs.readFileSync(process.env.DATABRIDGE_DB_PATH!).toString('latin1')
    for (const s of ['plain-secret', 'plain-token', 'kite-secret', 'kite-token']) expect(file).not.toContain(s)
  })
})
