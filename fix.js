const fs = require("fs");
const f = "src/main/license.js";
let s = fs.readFileSync(f, "utf8");
const bad = "  const stored = await keys.get('whopLicenseKey').catch(() => null);";
const good = "  let stored = null;\n  try { stored = keys.get('whopLicenseKey'); } catch (e) { stored = null; }";
if (!s.includes(bad)) { console.log("PATTERN NOT FOUND"); process.exit(1); }
s = s.replace(bad, good);
s = s.replace("  await keys.set('whopLicenseKey', clean);", "  keys.set('whopLicenseKey', clean);");
s = s.replace("  await keys.remove('whopLicenseKey').catch(() => {});", "  try { keys.remove('whopLicenseKey'); } catch (e) {}");
fs.writeFileSync(f, s);
console.log("FIXED");
