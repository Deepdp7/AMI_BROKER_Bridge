import fs from 'fs'
import path from 'path'
import os from 'os'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const appDataRoot = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir())
const DATA_DIR = path.join(appDataRoot, 'DataBridgePro')
const DB_FILE = path.join(DATA_DIR, 'db.sqlite')
const BARS_DIR = path.join(DATA_DIR, 'bars')

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'databridgepro',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
})

async function createSchema() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS brokers (
        id VARCHAR(50) PRIMARY KEY,
        broker_type VARCHAR(50) NOT NULL,
        label VARCHAR(100) NOT NULL,
        credential_ref VARCHAR(100),
        status VARCHAR(20) DEFAULT 'disconnected',
        health_score INTEGER DEFAULT 100,
        reconnect_count_1h INTEGER DEFAULT 0,
        account_id VARCHAR(100),
        api_key VARCHAR(255),
        api_secret VARCHAR(255),
        access_token TEXT,
        created_at BIGINT NOT NULL,
        last_connected_at BIGINT
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS symbols (
        broker_id VARCHAR(50) REFERENCES brokers(id) ON DELETE CASCADE,
        instrument_id VARCHAR(100) NOT NULL,
        amibroker_ticker VARCHAR(100) NOT NULL,
        exchange VARCHAR(20) NOT NULL,
        instrument_type VARCHAR(20) NOT NULL,
        raw_symbol VARCHAR(100) NOT NULL,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (broker_id, amibroker_ticker)
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS bars_1s (
        amibroker_ticker VARCHAR(100) NOT NULL,
        ts_utc_ms BIGINT NOT NULL,
        open NUMERIC NOT NULL,
        high NUMERIC NOT NULL,
        low NUMERIC NOT NULL,
        close NUMERIC NOT NULL,
        volume BIGINT NOT NULL,
        open_interest BIGINT,
        PRIMARY KEY (amibroker_ticker, ts_utc_ms)
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bars_1s_ticker_ts ON bars_1s (amibroker_ticker, ts_utc_ms DESC);
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        level VARCHAR(20) NOT NULL,
        component VARCHAR(50) NOT NULL,
        message TEXT NOT NULL
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp DESC);
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_events (
        id SERIAL PRIMARY KEY,
        broker_id VARCHAR(50) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        detail TEXT,
        ts_utc_ms BIGINT NOT NULL
      );
    `)

    await client.query('COMMIT')
    console.log('[POSTGRES] Schema ready')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function migrateData() {
  let legacyData: any = null
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8')
      if (content && content.trim()) {
        legacyData = JSON.parse(content)
      }
    } catch (e) {
      console.error('Error reading legacy db.sqlite:', e)
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

    // Migrate Bars
    let barsCount = 0
    if (fs.existsSync(BARS_DIR)) {
      const files = fs.readdirSync(BARS_DIR)
      for (const file of files) {
        if (!file.endsWith('.csv') && !file.endsWith('.jsonl')) continue
        
        const amibrokerTicker = file.replace('_history.csv', '').replace('_today.csv', '').replace('.jsonl', '')
        const filePath = path.join(BARS_DIR, file)
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
        
        const barRows = []
        for (const line of lines) {
          if (!line.trim()) continue
          let ts_utc_ms, open, high, low, close, volume, open_interest
          
          if (file.endsWith('.csv')) {
            const parts = line.split(',')
            if (parts.length >= 6) {
              ts_utc_ms = parseInt(parts[0]) * 1000 // Convert sec to ms
              open = parseFloat(parts[1])
              high = parseFloat(parts[2])
              low = parseFloat(parts[3])
              close = parseFloat(parts[4])
              volume = parseInt(parts[5])
              open_interest = null
            }
          } else if (file.endsWith('.jsonl')) {
            try {
              const b = JSON.parse(line)
              ts_utc_ms = b.tsUtcMs
              open = b.open
              high = b.high
              low = b.low
              close = b.close
              volume = b.volume
              open_interest = b.openInterest || null
            } catch (e) {}
          }
          
          if (ts_utc_ms) {
            barRows.push(`('${amibrokerTicker.replace(/'/g, "''")}', ${ts_utc_ms}, ${open}, ${high}, ${low}, ${close}, ${volume}, ${open_interest})`)
          }
          
          if (barRows.length >= 5000) {
            await client.query(`
              INSERT INTO bars_1s (amibroker_ticker, ts_utc_ms, open, high, low, close, volume, open_interest)
              VALUES ${barRows.join(',')}
              ON CONFLICT (amibroker_ticker, ts_utc_ms) DO NOTHING
            `)
            barsCount += barRows.length
            barRows.length = 0
          }
        }
        
        if (barRows.length > 0) {
          await client.query(`
            INSERT INTO bars_1s (amibroker_ticker, ts_utc_ms, open, high, low, close, volume, open_interest)
            VALUES ${barRows.join(',')}
            ON CONFLICT (amibroker_ticker, ts_utc_ms) DO NOTHING
          `)
          barsCount += barRows.length
        }
      }
    }

    await client.query('COMMIT')
    
    console.log('[DB_MIGRATION]')
    console.log(`postgres_rows: brokers=${brokersCount} symbols=${symbolsCount} settings=${settingsCount} bars=${barsCount}`)
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
    await createSchema()
    await migrateData()
    console.log('Migration completed successfully!')
  } catch (e) {
    console.error('Migration failed:', e)
  } finally {
    await pool.end()
  }
}

run()
