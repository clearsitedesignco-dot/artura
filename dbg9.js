const fs = require("fs");
const f = "src/renderer/app.js";
let s = fs.readFileSync(f, "utf8");
s = s.replace("    document.title = 'LIC:' + JSON.stringify(lic);", "");
const t = "(async function boot(){";
if (!s.includes(t)) { console.log("MISS"); process.exit(1); }
s = s.replace(t, t + "\n  window.addEventListener('error', e => { document.title = 'ERR: ' + e.message + ' @' + e.lineno; });\n  window.addEventListener('unhandledrejection', e => { document.title = 'REJ: ' + (e.reason && (e.reason.message || e.reason)); });");
fs.writeFileSync(f, s);
console.log("OK");
