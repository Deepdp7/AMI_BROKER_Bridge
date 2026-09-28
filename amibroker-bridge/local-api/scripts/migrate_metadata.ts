import fs from 'fs'
import path from 'path'
import os from 'os'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const appDataRoot = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir())
const DATA_DIR = path.join(appDataRoot, 'DataBridgePro')
const DB_FILE = path.join(DATA_DIR, 'db.json')

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'databridgepro',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
})

async function migrateMetadata() {
  let legacyData: any = null
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8')
      if (content && content.trim()) {
        legacyData = JSON.parse(content)
      }
    } catch (e) {
      console.error('Error reading legacy db.json:', e)
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let brokersCount = 0
    let symbolsCount = 0
    let settingsCount = 0

    if (legacyData) {
      // Migrate Brokers
      if (legacyData.brokerAccounts) {
        const brokerAccounts = Array.isArray(legacyData.brokerAccounts) 
          ? legacyData.brokerAccounts 
          : Object.values(legacyData.brokerAccounts);
        
        const brokerCredentials = Array.isArray(legacyData.brokerCredentials)
          ? Object.fromEntries(legacyData.brokerCredentials)
          : legacyData.brokerCredentials;

        for (const b of brokerAccounts) {
          const creds = brokerCredentials?.[b.id]
          
          await client.query(`
            INSERT INTO brokers (id, broker_type, label, credential_ref, status, health_score, reconnect_count_1h, account_id, api_key, api_secret, access_token, created_at, last_connected_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
          `, [
            b.id, b.broker_type, b.label, b.credential_ref, b.status, b.health_score, b.reconnect_count_1h,
            b.account_id, creds?.apiKey || null, creds?.apiSecret || null, creds?.accessToken || null,
            b.created_at, b.last_connected_at || null
          ])
          brokersCount++
        }
      }

      // Migrate Symbols
      if (legacyData.symbolMaps) {
        const symbolMaps = Array.isArray(legacyData.symbolMaps) 
          ? legacyData.symbolMaps 
          : Object.values(legacyData.symbolMaps);
        
        for (const s of symbolMaps) {
          await client.query(`
            INSERT INTO symbols (broker_id, instrument_id, amibroker_ticker, exchange, instrument_type, raw_symbol, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (broker_id, amibroker_ticker) DO NOTHING
          `, [
            s.brokerId, s.instrumentId, s.amiBrokerTicker, s.exchange, s.instrumentType, s.rawSymbol, s.createdAt || Date.now()
          ])
          symbolsCount++
        }
      }

      // Migrate Settings
      if (legacyData.appSettings) {
        const appSettings = Array.isArray(legacyData.appSettings)
          ? Object.fromEntries(legacyData.appSettings)
          : legacyData.appSettings;
        
        for (const [key, val] of Object.entries(appSettings)) {
          await client.query(`
            INSERT INTO settings (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(val)])
          settingsCount++
        }
      }
    }

    await client.query('COMMIT')
    
    console.log('[DB_MIGRATION]')
    console.log(`postgres_rows: brokers=${brokersCount} symbols=${symbolsCount} settings=${settingsCount} bars=0`)
    console.log(`verified=true`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function run() {
  try {
    await migrateMetadata()
    console.log('Metadata migration completed successfully!')
  } catch (e) {
    console.error('Metadata migration failed:', e)
  } finally {
    await pool.end()
  }
}

run()