const fs = require('fs');
const f = 'src/main/license.js';
let s = fs.readFileSync(f, 'utf8');
const a = "async function status({ force = false } = {}) {";
const b = "async function status({ force = false } = {}) {\n  const _log = (m) => { try { require('fs').appendFileSync(require('path').join(require('os').homedir(),'artura-debug.txt'), new Date().toISOString()+' '+m+'\\n'); } catch(e){} };";
if (!s.includes(a)) { console.log('NOT FOUND'); process.exit(1); }
s = s.replace(a, b);
s = s.replace("  if (!stored || !st.activated) return { state: 'none', ok: false };",
  "  _log('storedKey='+(!!stored)+' activated='+st.activated+' savedHwid='+st.hwid+' nowHwid='+hwid());\n  if (!stored || !st.activated) return { state: 'none', ok: false };");
fs.writeFileSync(f, s);
console.log('LOGGING ADDED');
