/**
 * Runs in every test worker before its test file: each worker gets its own database file
 * (test files run in parallel). Test files that set DATABRIDGE_DB_PATH themselves override it.
 */
import path from 'path'

process.env.DATABRIDGE_DB_PATH = path.join(process.env.USERPROFILE || process.cwd(), `test-${process.pid}-${process.env.VITEST_WORKER_ID || 0}.db`)

// A throwaway key for the credential encryption (src/lib/secretBox.ts): tests never touch the
// real %APPDATA%\DataBridgePro\secret.key or start PowerShell. Test files may set their own.
if (process.env.DATABRIDGE_SECRET_KEY === undefined) {
  process.env.DATABRIDGE_SECRET_KEY = require('crypto').randomBytes(32).toString('hex')
}
