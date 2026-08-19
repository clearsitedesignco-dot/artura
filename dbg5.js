const fs = require("fs");
const f = "src/main/license.js";
let s = fs.readFileSync(f, "utf8");
function logline(msg) {
  return '  try { require("fs").appendFileSync(require("path").join(require("os").homedir(),"artura-debug.txt"), ' + msg + ' + "\\n"); } catch(e) {}';
}
const t1 = "  if (!stored || !st.activated) return { state: 'none', ok: false };";
const t2 = "  if (st.hwid && st.hwid !== hwid()) {";
if (!s.includes(t1)) { console.log("MISSING T1"); process.exit(1); }
if (!s.includes(t2)) { console.log("MISSING T2"); process.exit(1); }
s = s.replace(t1, logline('"A stored=" + (!!stored) + " activated=" + st.activated') + "\n" + t1);
s = s.replace(t2, logline('"B saved=" + st.hwid + " now=" + hwid()') + "\n" + t2);
fs.writeFileSync(f, s);
console.log("OK");
