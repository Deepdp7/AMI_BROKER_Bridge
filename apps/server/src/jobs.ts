/**
 * Background jobs: the 08:30 IST instrument-list refresh, log rotation, and the parent watchdog.
 * (Missing-bar checks run in BrokerLifecycle.startPeriodicCatchUp.)
 */
import { getAllSettings, rotateOldLogs, stmts } from './db'
import { brokerManager } from './brokers/BrokerManager'

export function startBackgroundJobs() {
  // Daily instrument-list refresh at 08:30 IST (exchanges publish new contracts every morning)
  setInterval(() => {
    try {
      const now = new Date()
      const ist = new Date(now.getTime() + 5.5 * 3600 * 1000)
      if (ist.getUTCHours() === 8 && ist.getUTCMinutes() === 30) {
        console.log('[Cron] Triggering daily master symbol sync at 08:30 AM IST...')
        const brokers = stmts.getBrokers.all() as any[]
        for (const b of brokers) {
          const adapter = brokerManager.getAdapter(b.id) as any
          if (adapter && typeof adapter.downloadMasterContracts === 'function') {
            adapter.downloadMasterContracts()
          }
        }
      }
    } catch { /* ignore */ }
  }, 60 * 1000).unref() // Check every minute

  // The desktop app runs this engine as a hidden background process and passes its PID.
  // If the app is killed (Task Manager, crash) shut down too instead of lingering invisibly.
  const parentPid = Number(process.env.DATABRIDGE_PARENT_PID) || 0
  if (parentPid > 0) {
    setInterval(() => {
      try {
        process.kill(parentPid, 0)
      } catch (err: any) {
        if (err?.code === 'EPERM') return // process exists, just not signalable
        console.log('[Server] DataBridge Pro app is no longer running — stopping data engine.')
        process.exit(0)
      }
    }, 5000).unref()
  }

  // Log rotation: at start, then hourly
  const rotateLogs = () => {
    try {
      const settings = getAllSettings() as any
      const retentionDays = Number(settings?.logRetentionDays) || 14
      rotateOldLogs(retentionDays)
    } catch (err) {
      console.error('[Cron Error] Failed to rotate old logs:', err)
    }
  }
  rotateLogs()
  setInterval(rotateLogs, 60 * 60 * 1000).unref()
}
