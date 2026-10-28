/**
 * Opening AmiBroker from the app (the sidebar button, Settings, "Open AmiBroker automatically").
 * The desktop shell finds AmiBroker anywhere on the PC the first time and remembers it, so later
 * clicks open it at once; an AmiBroker that is already open is brought to the front.
 * When it was found somewhere other than the folder in Settings, Settings is updated to match.
 */
import { invoke } from '@tauri-apps/api/core'
import { api } from '../api/apiClient'
import { useAppStore } from '../store/appStore'

export interface AmiBrokerResult {
  message: string
  /** Broker.exe */
  path: string | null
  alreadyOpen: boolean
  /** The DataBridge plugin is in that copy's Plugins folder */
  pluginInstalled: boolean
}

export const canOpenAmiBroker = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Folder of a Broker.exe path */
export const folderOf = (exe: string) => exe.replace(/[\\/][^\\/]+$/, '')

/** Keeps Settings → AmiBroker folder in step with where AmiBroker really is */
async function rememberFolder(exe: string | null) {
  if (!exe) return
  const folder = folderOf(exe)
  const current = useAppStore.getState().settings.amiBrokerPath || ''
  if (current.replace(/[\\/]+$/, '').toLowerCase() === folder.toLowerCase()) return
  useAppStore.getState().updateSettings({ amiBrokerPath: folder })
  try { await api.updateSettings({ amiBrokerPath: folder }) } catch { /* engine offline: kept on screen, saved next time */ }
}

/** Opens AmiBroker (or brings it to the front). Rejects with a plain-words reason. */
export async function openAmiBroker(): Promise<AmiBrokerResult> {
  const hint = useAppStore.getState().settings.amiBrokerPath || null
  const result = await invoke<AmiBrokerResult>('start_amibroker', { path: hint })
  rememberFolder(result.path)
  return result
}

/** Finds AmiBroker without opening it (Settings "Find automatically") */
export async function locateAmiBroker(): Promise<string | null> {
  const hint = useAppStore.getState().settings.amiBrokerPath || null
  const exe = await invoke<string | null>('locate_amibroker', { path: hint, deep: true })
  await rememberFolder(exe)
  return exe
}
