const fs = require('fs');
const f = 'src/main/license.js';
let s = fs.readFileSync(f, 'utf8');
const L = "  try { require('fs').appendFileSync(require('path').join(require('os').homedir(),'artura-debug.txt'), 'MARK\\n'); } catch(e) {}";
let n = 0;
s = s.replace("  if (!stored || !st.activated) return { state: 'none', ok: false };",
  L.replace('MARK', "'A stored=' + (!!stored) + ' activated=' + st.activated) ; } catch(e) {}") + "\n  if (!stored || !st.activated) return { state: 'none', ok: false };");
s = s.replace("  if (st.hwid && st.hwid !== hwid()) {",
  L.replace('MARK', "'B saved=' + st.hwid + ' now=' + hwid()) ; } catch(e) {}") + "\n  if (st.hwid && st.hwid !== hwid()) {");
fs.writeFileSync(f, s);
console.log('OK');
