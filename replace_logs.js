const fs = require('fs');
const file = 'amibroker-bridge/local-api/src/services/BackfillQueue.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/console\.log\(\\[BackfillQueue\] Enqueued backfill for \$\{ticker\} \(\$\{brokerId\}\), depth=\$\{depthDays\}d\\)/g, 
  "console.log([Backfill]  : Queued for backfill ( days))");

code = code.replace(/console\.log\(\\[BackfillQueue\] Fetching \$\{task\.ticker\} \(\$\{task\.brokerToken\}\) \\\[\$\{this\.queue\.length\} in queue\\\] from \$\{fromStr\} to \$\{toStr\}\.\.\.\\)/g, 
  "console.log([Backfill]  : Fetching data from  to  ( in queue))");

code = code.replace(/console\.log\(\\[BackfillQueue\] Saved \$\{csvLines\.length\} bars for \$\{task\.ticker\} \(\$\{fromStr\} to \$\{toStr\}\)\\)/g, 
  "// console.log([Backfill] Saved  bars for  ( to ))");

code = code.replace(/console\.log\(\\[BackfillQueue\] \$\{depthLabel\} for \$\{task\.ticker\} completed successfully!\\)/g, 
  "console.log([Backfill]  :  Completed Successfully!)");

code = code.replace(/console\.error\(\\[BackfillQueue\] Task FAILED for \$\{task\.ticker\}: \$\{error\}\\)/g, 
  "console.error([Error]  : Failed to fetch data. Reason: )");

code = code.replace(/console\.error\(\\[BackfillQueue\]/g, "console.error([Error] ");
code = code.replace(/console\.warn\(\\[BackfillQueue\]/g, "console.warn([Warning] ");

fs.writeFileSync(file, code);
console.log('BackfillQueue logs updated.');
