const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = path.resolve(__dirname, '../../desktop/src-tauri/bin');
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


console.log('4. Injecting blob into executable');
execSync(`npx postject "${OUT_EXE}" NODE_SEA_BLOB "${BLOB_FILE}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`, { stdio: 'inherit' });

// After injecting: postject can't read the file once resedit has rewritten its resources
console.log('5. Branding the executable (icon and file details, instead of Node.js)');
brandExecutable(OUT_EXE);

console.log('Build SEA completed successfully!');

/**
 * The copied node.exe still says "Node.js" (icon, Task Manager name, file properties).
 * Replaces its icon with the app icon and its version details with DataBridge Pro's.
 * Runs after the blob is injected (the blob is a resource too and is kept as is); Node's
 * signature is dropped, since it no longer matches.
 */
function brandExecutable(file) {
  const ResEdit = require('resedit');
  const ICON = path.resolve(__dirname, '../../desktop/src-tauri/icons/icon.ico');
  const version = require('../../../package.json').version;
  const [major, minor, patch] = version.split('.').map(n => parseInt(n, 10) || 0);

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  const icons = ResEdit.Data.IconFile.from(fs.readFileSync(ICON)).icons.map(i => i.data);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (groups.length === 0) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, icons);
  }
  for (const g of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, icons);
  }

  const [info] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const details = {
    CompanyName: 'DataBridge Pro',
    FileDescription: 'DataBridge Pro Data Engine',
    ProductName: 'DataBridge Pro',
    InternalName: 'local-api',
    OriginalFilename: 'local-api.exe',
    LegalCopyright: `Copyright © ${new Date().getFullYear()} DataBridge Pro`,
    FileVersion: version,
    ProductVersion: version,
  };
  const langs = info.getAllLanguagesForStringValues();
  for (const lang of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) {
    info.setStringValues(lang, details);
    info.setFileVersion(major, minor, patch, 0, lang.lang);
    info.setProductVersion(major, minor, patch, 0, lang.lang);
  }
  info.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(file, Buffer.from(exe.generate()));
}
