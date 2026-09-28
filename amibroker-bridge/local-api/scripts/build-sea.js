const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = path.resolve(__dirname, '../../gui-app/src-tauri/bin');
const OUT_EXE = path.join(OUT_DIR, 'local-api-x86_64-pc-windows-msvc.exe');
const CONFIG_FILE = path.resolve(__dirname, '../sea-config.json');
const BLOB_FILE = path.resolve(__dirname, '../sea-prep.blob');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('1. Writing sea-config.json');
fs.writeFileSync(CONFIG_FILE, JSON.stringify({
  main: 'dist/bundle.js',
  output: 'sea-prep.blob',
  disableExperimentalSEAWarning: true
}, null, 2));

console.log('2. Generating sea-prep.blob');
execSync(`node --experimental-sea-config "${CONFIG_FILE}"`, { stdio: 'inherit' });

console.log('3. Copying node executable');
fs.copyFileSync(process.execPath, OUT_EXE);


console.log('4. Removing signature (if any)');
try {
  // Try using signtool if available, or just rely on postject overwrite
} catch (e) {}

console.log('5. Injecting blob into executable');
execSync(`npx postject "${OUT_EXE}" NODE_SEA_BLOB "${BLOB_FILE}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`, { stdio: 'inherit' });

console.log('Build SEA completed successfully!');
