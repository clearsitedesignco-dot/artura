const fs = require("fs");
const f = "src/renderer/app.js";
let s = fs.readFileSync(f, "utf8");
const t = "    const lic = await API.license.status();";
if (!s.includes(t)) { console.log("MISS"); process.exit(1); }
s = s.replace(t, t + "\n    document.title = 'LIC:' + JSON.stringify(lic);");
fs.writeFileSync(f, s);
console.log("OK");
