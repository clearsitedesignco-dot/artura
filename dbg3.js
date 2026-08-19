const fs = require('fs');
const f = 'src/main/license.js';
let s = fs.readFileSync(f, 'utf8');
const marker = "async function status({ force = false } = {}) {";
if (!s.includes(marker)) { console.log('NOT FOUND'); process.exit(1); }
const inject = marker + "\n  try { require('fs').appendFileSync(require('path').join(require('os').homedir(),'artura-debug.txt'), 'STATUS CALLED configured=' + cfg.isConfigured() + ' url=' + cfg.LICENSE_PROXY_URL + '\\n'); } catch(e) {}";
s = s.replace(marker, inject);
fs.writeFileSync(f, s);
console.log('OK');
