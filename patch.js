const fs = require('fs');
const f = 'src/renderer/app.js';
let s = fs.readFileSync(f, 'utf8');
const a = "setTimeout(() => { $('lock').hidden = true; $('lockKey').value = ''; }, 600);";
const b = "setTimeout(() => location.reload(), 600);";
if (!s.includes(a)) { console.log('PATTERN NOT FOUND'); process.exit(1); }
fs.writeFileSync(f, s.replace(a, b));
console.log('PATCHED');
