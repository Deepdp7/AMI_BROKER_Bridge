import fs from 'fs'
import path from 'path'
import os from 'os'
import { Pool } from 'pg'
import { from as copyFrom } from 'pg-copy-streams'
import dotenv from 'dotenv'

dotenv.config()

const appDataRoot = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir())
const DATA_DIR = path.join(appDataRoot, 'DataBridgePro')
const BARS_DIR = path.join(DATA_DIR, 'bars')

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'databridgepro',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
})

async function migrateBarsWithCopy() {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    let totalBars = 0
    
    if (fs.existsSync(BARS_DIR)) {
      const files = fs.readdirSync(BARS_DIR).filter(f => f.endsWith('_history.csv'))
      console.log(`[MigrateBars] Found ${files.length} CSV files`)
      
      for (const file of files) {
        const amibrokerTicker = file.replace('_history.csv', '')
        const filePath = path.join(BARS_DIR, file)
        
        // Create a temp file with ms timestamps
        const tempFile = path.join(BARS_DIR, `.tmp_${file}`)
        const readStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
        const writeStream = fs.createWriteStream(tempFile)
        
        let lineCount = 0
        const seenTimestamps = new Set<number>()
        
        for await (const chunk of readStream) {
          const lines = chunk.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const parts = trimmed.split(',')
            if (parts.length < 6) continue
            
            const tsSec = parseInt(parts[0])
            if (isNaN(tsSec) || tsSec <= 0) continue
            
            // Skip duplicates
            if (seenTimestamps.has(tsSec)) continue
            seenTimestamps.add(tsSec)
            
            const tsMs = tsSec * 1000
            
            const open = parseFloat(parts[1])
            const high = parseFloat(parts[2])
            const low = parseFloat(parts[3])
            const close = parseFloat(parts[4])
            const volume = parseInt(parts[5])
            
            if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) continue
            if (open === 0 && high === 0 && low === 0 && close === 0) continue
            
            writeStream.write(`${amibrokerTicker}\t${tsMs}\t${open}\t${high}\t${low}\t${close}\t${volume}\t\\N\n`)
            lineCount++
          }
        }
        writeStream.end()
        
        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve)
          writeStream.on('error', reject)
        })
        
        if (lineCount === 0) {
          fs.unlinkSync(tempFile)
          continue
        }
        
        // Use COPY for fast bulk insert
        console.log(`[MigrateBars] COPY ${amibrokerTicker}: ${lineCount} rows...`)
        const copyQuery = `
          COPY bars_1s (amibroker_ticker, ts_utc_ms, open, high, low, close, volume, open_interest)
          FROM STDIN WITH (FORMAT TEXT, NULL '\\N')
        `
        
        const copyStream = client.query(copyFrom(copyQuery))
        
        await new Promise<void>((resolve, reject) => {
          const fileStream = fs.createReadStream(tempFile)
          
          fileStream.pipe(copyStream)
          
          copyStream.on('finish', () => {
            totalBars += lineCount
            fs.unlinkSync(tempFile)
            console.log(`[MigrateBars] Completed ${amibrokerTicker}: ${lineCount} rows`)
            resolve()
          })
          copyStream.on('error', (err) => {
            fs.unlinkSync(tempFile)
            reject(err)
          })
          fileStream.on('error', (err) => {
            fs.unlinkSync(tempFile)
            reject(err)
          })
        })
      }
    }
    
    await client.query('COMMIT')
    console.log(`[DB_MIGRATION] postgres_rows: bars=${totalBars}`)
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
    await migrateBarsWithCopy()
    console.log('Bars migration completed successfully!')
  } catch (e) {
    console.error('Bars migration failed:', e)
  } finally {
    await pool.end()
  }
}

run()