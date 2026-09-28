import { IBrokerAdapter, BrokerCredentials, SessionInfo } from './adapters/IBrokerAdapter'
import { FyersAdapter } from './adapters/FyersAdapter'
import { stmts } from '../db'
import type { LogEntry } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'

export class BrokerManager extends EventEmitter {
  private activeAdapters = new Map<string, IBrokerAdapter>()

  constructor() {
    super()
  }

  getAdapter(brokerId: string): IBrokerAdapter | undefined {
    return this.activeAdapters.get(brokerId)
  }

  getAllAdapters(): IBrokerAdapter[] {
    return Array.from(this.activeAdapters.values())
  }

  private _emitLog(level: 'info' | 'debug' | 'warn' | 'error', component: string, message: string) {
    const entry: LogEntry = {
      id: uuidv4(),
      ts: Date.now(),
      level,
      component,
      message,
    }
    try {
      stmts.insertLog.run(entry)
    } catch { /* ignore duplicate ids */ }
    this.emit('log_entry', entry)
  }

  async connectBroker(brokerId: string, brokerType: string, credentials: BrokerCredentials): Promise<SessionInfo> {
    if (this.activeAdapters.has(brokerId)) {
      await this.disconnectBroker(brokerId)
    }

    let adapter: IBrokerAdapter

    switch (brokerType) {
      case 'fyers':
        adapter = new FyersAdapter()
        break
      default:
        throw new Error(`Unsupported broker type: ${brokerType}`)
    }

    adapter.on('tick', (tick) => {
      this.emit('tick', { ...tick, brokerId })
    })

    adapter.on('log_entry', (entry) => {
      this._emitLog(entry.level, entry.component, entry.message)
    })

    adapter.on('auth_failed', () => {
      this.emit('auth_required', brokerId)
    })

    adapter.on('connection_state', (state) => {
      const normalizedState = state.toLowerCase()
      this.emit('broker_status', { brokerId, status: normalizedState })
      stmts.updateBrokerStatus.run(normalizedState, normalizedState === 'connected' ? Date.now() : null, brokerId)
      this._emitLog('info', 'BrokerManager', `Broker ${brokerId} state changed to ${state}`)
      // Emit dedicated auth_required event so server.ts can auto-open browser
      if (normalizedState === 'auth_required') {
        this.emit('auth_required', brokerId)
      }
    })

    // Forward master contract sync events to UI
    adapter.on('master_sync_progress', (data) => this.emit('master_sync_progress', data))
    adapter.on('master_sync_complete', (data) => this.emit('master_sync_complete', data))
    adapter.on('master_sync_error', (data) => this.emit('master_sync_error', data))
    adapter.on('symbol_resolved', (data) => this.emit('symbol_resolved', { ...data, brokerId }))

    try {
      this._emitLog('info', 'BrokerManager', `Connecting to broker ${brokerId} (${brokerType})...`)
      const session = await adapter.connect(credentials)
      this.activeAdapters.set(brokerId, adapter)
      
      this._emitLog('info', 'BrokerManager', `Successfully connected to broker ${brokerId}`)
      
      return session
    } catch (err: any) {
      stmts.updateBrokerStatus.run('ERROR', null, brokerId)
      this._emitLog('error', 'BrokerManager', `Failed to connect broker ${brokerId}: ${err.message}`)
      throw err
    }
  }

  async disconnectBroker(brokerId: string) {
    const adapter = this.activeAdapters.get(brokerId)
    if (adapter) {
      await adapter.disconnect()
      this.activeAdapters.delete(brokerId)
      stmts.updateBrokerStatus.run('DISCONNECTED', null, brokerId)
      this._emitLog('info', 'BrokerManager', `Disconnected broker ${brokerId}`)
    }
  }

  async subscribe(brokerId: string, instruments: string[]) {
    const adapter = this.activeAdapters.get(brokerId)
    if (adapter) {
      await adapter.subscribe(instruments)
    }
  }

  async unsubscribe(brokerId: string, instruments: string[]) {
    const adapter = this.activeAdapters.get(brokerId)
    if (adapter) {
      await adapter.unsubscribe(instruments)
    }
  }
}

export const brokerManager = new BrokerManager()
