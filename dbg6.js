const fs = require("fs");
const f = "src/main/license.js";
let s = fs.readFileSync(f, "utf8");
const marker = "module.exports = { activate, status, signOut, hwid, isConfigured: cfg.isConfigured };";
if (!s.includes(marker)) { console.log("MISSING"); process.exit(1); }
const wrapper = [
  "const _origStatus = status;",
  "async function _loggedStatus(o) {",
  "  const p = require('path').join(require('os').homedir(), 'artura-debug.txt');",
  "  const w = (m) => { try { require('fs').appendFileSync(p, m + '\\n'); } catch(e) {} };",
  "  try {",
  "    const st = JSON.parse(require('./store').getSetting('license') || '{}');",
  "    const k = await require('./keys').get('whopLicenseKey').catch(function(e){ return 'KEYERR:' + e.message; });",
  "    w('state=' + JSON.stringify(st) + ' key=' + (k ? 'YES' : 'NO') + ' hwid=' + hwid());",
  "    const r = await _origStatus(o);",
  "    w('result=' + JSON.stringify(r));",
  "    return r;",
  "  } catch (e) { w('THREW: ' + e.message + ' | ' + e.stack); throw e; }",
  "}",
  "module.exports = { activate, status: _loggedStatus, signOut, hwid, isConfigured: cfg.isConfigured };"
].join("\n");
s = s.replace(marker, wrapper);
fs.writeFileSync(f, s);
console.log("OK");
