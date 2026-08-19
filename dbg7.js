const fs = require("fs");
const f = "src/main/license.js";
let s = fs.readFileSync(f, "utf8");
const P = "require('path').join(require('os').homedir(),'artura-debug.txt')";
const W = function(m){ return "  try { require('fs').appendFileSync(" + P + ", " + m + " + '\\n'); } catch(e) {}"; };
const t1 = "  db.logEvent('key', 'Licence activated');";
const t2 = "  const st = readState();";
if (!s.includes(t1) || !s.includes(t2)) { console.log("MISS"); process.exit(1); }
s = s.replace(t1, W("'ACTIVATED wrote=' + JSON.stringify(readState()) + ' keyBack=' + (keys.get('whopLicenseKey') ? 'YES' : 'NO')") + "\n" + t1);
s = s.replace(t2, t2 + "\n" + W("'BOOT read=' + JSON.stringify(readState()) + ' key=' + (keys.get('whopLicenseKey') ? 'YES' : 'NO')"));
fs.writeFileSync(f, s);
console.log("OK");
