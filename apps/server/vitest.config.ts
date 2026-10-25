import { defineConfig } from 'vitest/config'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Tests never touch the real %APPDATA%\DataBridgePro (database, coverage state) and never
// import from a PostgreSQL configured in .env
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-vitest-'))
process.on('exit', () => {
  try { fs.rmSync(testHome, { recursive: true, force: true }) } catch { /* still open */ }
})

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    reporter: 'verbose',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    env: {
      USERPROFILE: testHome,
      HOME: testHome,
      DATABRIDGE_NO_PG_IMPORT: '1',
    },
  },
})
