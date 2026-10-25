#!/usr/bin/env node
/**
 * Collects what a DataBridge Pro client install needs into release/, the folders the
 * Installer Studio project (branding/installer/DataBridge Pro.isproj) packs:
 *
 *   release/DataBridge Pro/DataBridge Pro.exe   desktop app (Tauri release build)
 *   release/DataBridge Pro/local-api.exe        data engine (npm run build:server); the app
 *                                               starts it from its own folder
 *   release/plugin/DataBridgePro.dll            AmiBroker plugin (npm run build:plugin)
 *
 * Run by `npm run build:files` after both builds.
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const out = path.join(root, 'release')
const files = [
  ['apps/desktop/src-tauri/target/release/app.exe', 'DataBridge Pro/DataBridge Pro.exe'],
  ['apps/desktop/src-tauri/bin/local-api-x86_64-pc-windows-msvc.exe', 'DataBridge Pro/local-api.exe'],
  ['plugins/amibroker/DataBridgePro.dll', 'plugin/DataBridgePro.dll'],
]

const missing = files.filter(([from]) => !fs.existsSync(path.join(root, from)))
if (missing.length) {
  console.error('Not built yet:\n' + missing.map(([from]) => `  ${from}`).join('\n'))
  process.exit(1)
}

// Start clean, so a file dropped from the app doesn't linger in the installer
fs.rmSync(path.join(out, 'DataBridge Pro'), { recursive: true, force: true })
for (const [from, to] of files) {
  const dest = path.join(out, to)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(path.join(root, from), dest)
  console.log(`  ${to}  ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`)
}
console.log(`Release files ready in ${out}`)
