/**
 * The little Windows knowledge the platform finder needs: the registry (read with reg.exe, which
 * every Windows has, so nothing native is loaded into the engine) and the user's Documents folder.
 */
import { execFile } from 'child_process'
import path from 'path'
import os from 'os'

export interface RegValues { [name: string]: string }
/** key path → its values ('(Default)' for the unnamed one) */
export type RegTree = Map<string, RegValues>

/** Output of `reg query <key> [/s]` → key path → values */
export function parseRegQuery(text: string): RegTree {
  const tree: RegTree = new Map()
  let current: RegValues | null = null
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    if (/^HKEY_/.test(raw)) {
      current = {}
      tree.set(raw.trim(), current)
      continue
    }
    // "    DisplayName    REG_SZ    AmiBroker 6.20.1"
    const m = /^\s{2,}(.*?)\s{4}(REG_[A-Z_]+)(?:\s{4}(.*))?$/.exec(raw)
    if (m && current) current[m[1] === '(Default)' || m[1] === '(Standard)' ? '(Default)' : m[1]] = (m[3] ?? '').trim()
  }
  return tree
}

export type RegReader = (key: string, recursive?: boolean) => Promise<RegTree>

/** Reads a registry key (and its subkeys when `recursive`); empty when it doesn't exist */
export const readRegistry: RegReader = (key, recursive = false) => new Promise(resolve => {
  if (process.platform !== 'win32') return resolve(new Map())
  execFile('reg.exe', ['query', key, ...(recursive ? ['/s'] : [])], { windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 20_000 },
    (err, stdout) => resolve(err && !stdout ? new Map() : parseRegQuery(String(stdout))))
})

/** %VAR% expanded from the environment */
export function expandEnv(text: string, env: NodeJS.ProcessEnv = process.env): string {
  return text.replace(/%([^%]+)%/g, (whole, name) => env[name] ?? env[Object.keys(env).find(k => k.toLowerCase() === String(name).toLowerCase()) || ''] ?? whole)
}

/** Programs Windows lists as installed (all three uninstall lists), by display name */
export async function installedPrograms(read: RegReader = readRegistry): Promise<Array<RegValues & { key: string }>> {
  const roots = [
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ]
  const out: Array<RegValues & { key: string }> = []
  for (const tree of await Promise.all(roots.map(r => read(r, true)))) {
    for (const [key, values] of tree) if (values.DisplayName) out.push({ ...values, key })
  }
  return out
}

/** The user's Documents folder (it may have been moved, e.g. into OneDrive) */
export async function documentsDir(read: RegReader = readRegistry): Promise<string> {
  const tree = await read('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders')
  const values = [...tree.values()][0]
  const personal = values?.Personal
  return personal ? expandEnv(personal) : path.join(os.homedir(), 'Documents')
}

/** Folder of an exe path from DisplayIcon ("C:\\…\\Broker.exe,0", quoted or not) */
export function exeFromIcon(icon: string | undefined): string | undefined {
  if (!icon) return undefined
  const t = icon.trim()
  // "\"C:\…\Broker.exe\",0" (quoted) or "C:\…\Broker.exe,0"
  const clean = t.startsWith('"') ? t.slice(1, t.indexOf('"', 1) > 0 ? t.indexOf('"', 1) : undefined) : t.replace(/,\s*-?\d+$/, '')
  return /\.exe$/i.test(clean) ? clean : undefined
}
