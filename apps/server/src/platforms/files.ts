/**
 * Where the platform connectors ship (they are copied from here into each platform), and the
 * folder DataBridge writes its files for the user into.
 *
 *   installed app:  <app folder>\connectors\<file>        (staged by scripts/stage-release.cjs)
 *   development:    <repo>\plugins\<platform>\<file>
 */
import fs from 'fs'
import path from 'path'
import { documentsDir } from './windows'

const DEV_FOLDERS: Record<string, string> = {
  'DataBridgePro.dll': 'amibroker',
  'DataBridgeRtd64.dll': 'excel',
  'DataBridgeRtd32.dll': 'excel',
  'DataBridge.mq5': 'metatrader5',
}

/** The shipped copy of a connector file, or null when it isn't there */
export function connectorSource(file: string): string | null {
  const dev = DEV_FOLDERS[file] || ''
  const candidates = [
    path.join(path.dirname(process.execPath), 'connectors', file),
    path.resolve(process.cwd(), '..', '..', 'plugins', dev, file),
    path.resolve(process.cwd(), 'plugins', dev, file),
    path.resolve(__dirname, '..', '..', '..', '..', 'plugins', dev, file),
  ]
  return candidates.find(p => { try { return fs.statSync(p).isFile() } catch { return false } }) || null
}

/** Documents\DataBridge Pro\<sub> (created) */
export async function userFolder(sub = ''): Promise<string> {
  const dir = path.join(await documentsDir(), 'DataBridge Pro', sub)
  await fs.promises.mkdir(dir, { recursive: true })
  return dir
}

/** Characters Windows doesn't allow in a file name */
export const safeFileName = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'symbol'
