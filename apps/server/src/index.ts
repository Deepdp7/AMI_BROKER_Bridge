/**
 * DataBridge Pro data engine: entry point.
 *
 *   HTTP + WebSocket API   127.0.0.1:7890   (app.ts, api/)
 *   AmiBroker channel      127.0.0.1:7891   (amibroker/ipcServer.ts)
 *
 * Run by the desktop app as a hidden sidecar (local-api.exe) or by `npm run dev`.
 */
// MUST stay first: captures console output for the in-app Live Console (and the AI assistant)
import './system/ConsoleCapture'
import http = require('http')
import { HOST, HTTP_PORT } from './config'
import { app } from './app'
import { syncCachesPromise } from './db'
import { attachRealtime } from './api/realtime'
import { startAmiBrokerIpc, notifyAmiBrokerHistoryChanged } from './amibroker/ipcServer'
import { wireEngineEvents, startEngine } from './startup'
import { startBackgroundJobs } from './jobs'
import { startPeriodicCatchUp } from './brokers/BrokerLifecycle'
import { autoRefresh } from './market/AutoRefresh'
import { morningBrief } from './ai/MorningBrief'

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception (recovered):', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection (recovered):', reason)
})

const server = http.createServer(app)
attachRealtime(server)
wireEngineEvents()

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[API] Port ${HTTP_PORT} is already in use. Assuming another instance is running and exiting gracefully.`)
    process.exit(0)
  } else {
    console.error('[Server Error]', err)
    process.exit(1)
  }
})

server.listen(HTTP_PORT, HOST, async () => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event: 'server_started',
    host: HOST,
    port: HTTP_PORT,
    endpoints: [
      `http://${HOST}:${HTTP_PORT}/api/brokers`,
      `http://${HOST}:${HTTP_PORT}/api/status/feed`,
      `http://${HOST}:${HTTP_PORT}/api/status/health`,
      `http://${HOST}:${HTTP_PORT}/api/settings`,
      `http://${HOST}:${HTTP_PORT}/api/logs`,
      `ws://${HOST}:${HTTP_PORT}/api/status/stream`,
    ],
  }))
  await syncCachesPromise
  startEngine()
  startPeriodicCatchUp()
  // Automatic "Refresh All Today" while the market is open (settings are loaded by now)
  autoRefresh.start(notifyAmiBrokerHistoryChanged)
  morningBrief.start()
})

startAmiBrokerIpc()
startBackgroundJobs()

export { server }
