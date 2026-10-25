#!/usr/bin/env node
/**
 * Runs a command inside the Visual Studio x64 C++ environment (vcvars64.bat).
 *
 * Rust/Tauri needs the MSVC linker + Windows SDK paths. Outside a "Developer
 * Command Prompt", rustc can pick an incomplete VS install (e.g. BuildTools
 * without the SDK -> "LNK1104: cannot open file 'ucrt.lib'"). This finds a full
 * Visual Studio install (Community/Professional/Enterprise preferred) and loads it.
 *
 * Usage: node scripts/with-msvc.cjs <command> [args...]
 */
const { spawnSync, execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const command = process.argv.slice(2).join(' ')
if (!command) {
  console.error('usage: node scripts/with-msvc.cjs <command> [args...]')
  process.exit(1)
}

function run(cmdLine) {
  const res = spawnSync(cmdLine, { stdio: 'inherit', shell: true })
  process.exit(res.status ?? 1)
}

// Not Windows, or already inside a developer prompt: run as-is
if (process.platform !== 'win32' || process.env.VCINSTALLDIR) run(command)

function findVcvars() {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
  let installs = []
  if (fs.existsSync(vswhere)) {
    try {
      const out = execFileSync(vswhere, ['-products', '*', '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath', '-sort'],
        { encoding: 'utf8' })
      installs = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    } catch { /* fall through */ }
  }
  // Full IDE installs first; BuildTools last (often missing SDK pieces)
  installs.sort((a, b) => /BuildTools/i.test(a) - /BuildTools/i.test(b))
  for (const dir of installs) {
    const bat = path.join(dir, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
    if (fs.existsSync(bat)) return { bat, vswhereDir: path.dirname(vswhere) }
  }
  return null
}

const found = findVcvars()
if (!found) {
  console.warn('[with-msvc] Visual Studio C++ tools not found — running without vcvars64.')
  run(command)
}

console.log(`[with-msvc] Using ${found.bat}`)
// vcvars itself calls vswhere; make sure it is on PATH
run(`set "PATH=${found.vswhereDir};%PATH%" && call "${found.bat}" >nul && ${command}`)
