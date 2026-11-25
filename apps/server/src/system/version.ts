/**
 * version.ts — the DataBridge Pro version (root package.json, the number stamped on both exes)
 *
 * esbuild inlines the package.json into the bundle, so the packaged engine needs no file on disk.
 */
function readVersion(): string {
  try {
    // The root package.json (two levels above apps/server)
    return process.env.DATABRIDGE_VERSION || require('../../../../package.json').version || ''
  } catch {
    return ''
  }
}

export const APP_VERSION = readVersion()
