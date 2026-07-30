#!/usr/bin/env node
'use strict';
/* Confirms the project extracted correctly before anyone builds anything.
   Checks every file exists, is the right size, and has the right contents.
   Run:  node verify.js  */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'MANIFEST.json'), 'utf8'));
let missing = [], wrong = [], ok = 0;

for (const f of m.files) {
  const p = path.join(__dirname, f.path);
  if (!fs.existsSync(p)) { missing.push(f.path); continue; }
  const b = fs.readFileSync(p);
  const h = crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
  if (h !== f.sha256) wrong.push(`${f.path}  (expected ${f.bytes} bytes, found ${b.length})`);
  else ok++;
}

console.log(`\n  ArturaLabs — project check\n  ==========================\n`);
console.log(`  ${ok} of ${m.files.length} files correct`);

if (missing.length) {
  console.log(`\n  MISSING (${missing.length}):`);
  missing.forEach(x => console.log('    ' + x));
}
if (wrong.length) {
  console.log(`\n  WRONG CONTENTS (${wrong.length}):`);
  wrong.forEach(x => console.log('    ' + x));
}

if (!missing.length && !wrong.length) {
  console.log('\n  Everything is here and intact. Safe to build.\n');
  process.exit(0);
}
console.log(`
  This folder is not a clean copy of the project.

  Most likely the zip was not extracted properly, or the files were
  handed over individually instead of as a folder.

  Fix it this way:
    1. Right-click arturalabs.zip  ->  Extract All
    2. Extract into Documents
    3. Open the resulting artura-app FOLDER directly
    4. Run  node verify.js  again

  Do not upload or drag the files in one by one. That loses the folder
  structure, which is what the file names depend on.
`);
process.exit(1);
