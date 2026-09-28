const fs = require('fs');
const file = 'amibroker-bridge/local-api/src/services/adapters/FyersHSMClient.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/console\.log\(\\\\[LIVE_TICK\\\] \$\{tick\.instrumentId\.padEnd\(20\)\} ---- \$\{timeStr\} ----- ?\$\{tick\.lastPrice\.toFixed\(2\)\}\\)/g, 
  "const dateStr = new Date(tick.timestamp).toISOString().split('T')[0];\n        console.log([Live Tick]   |  | ?  | Vol: )");

code = code.replace(/this\.lastTickLogTime > 2000/g, "this.lastTickLogTime > 1000");

code = code.replace(/console\.log\(\\\\[HSM_SYMBOL_STATS\\\] subscribed=\$\{subbed\.length\} receiving=\$\{receiving\.length\} notReceiving=\$\{notReceiving\.length\}\\)/g,
  "console.log([System Status] Total Symbols Active:  | Receiving Live Ticks: )");

code = code.replace(/console\.log\(\\\\[HSM_SYMBOL_STATS\\\] notReceivingList:/g, "console.log([Warning] No Live Data for:");

code = code.replace(/console\.log\('\\\[FYERS_HSM_CONNECT\\\] No data for 5 minutes/g, "console.error('[Error] No live data for 5 minutes");

fs.writeFileSync(file, code);
console.log('FyersHSMClient logs updated.');
