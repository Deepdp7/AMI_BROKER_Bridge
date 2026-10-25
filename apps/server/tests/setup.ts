/**
 * Runs in every test worker before its test file: each worker gets its own database file
 * (test files run in parallel). Test files that set DATABRIDGE_DB_PATH themselves override it.
 */
import path from 'path'

process.env.DATABRIDGE_DB_PATH = path.join(process.env.USERPROFILE || process.cwd(), `test-${process.pid}-${process.env.VITEST_WORKER_ID || 0}.db`)
