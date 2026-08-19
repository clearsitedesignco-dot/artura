#!/usr/bin/env node
'use strict';

/* Swaps the paste-a-licence-key screen for Sign in with Whop.
   Run from inside the artura-app folder:  node apply-oauth.js            */

const fs = require('fs');
const path = require('path');

const say = m => console.log('  ' + m);
const die = m => { console.log('\n  STOPPED: ' + m + '\n'); process.exit(1); };

if (!fs.existsSync('package.json') || !fs.existsSync('src/renderer/app.js')) {
  die('This is not the artura-app folder. cd into it first.');
}

console.log('\n  Applying Sign in with Whop\n  =========================\n');

/* ---------------------------------------------------------------- 1. HTML */
const hp = 'src/renderer/index.html';
let h = fs.readFileSync(hp, 'utf8');

const oldField = h.match(/\s*<div class="lock-field">[\s\S]*?<\/div>\s*<\/div>/);
if (oldField) {
  h = h.replace(oldField[0], '\n      <div class="lock-msg" id="lockMsg"></div>\n');
  say('removed the licence key input');
} else if (h.includes('id="lockMsg"')) {
  say('licence key input already removed');
} else {
  die('could not find the lock screen. Is this the right version?');
}

h = h.replace(
  /<button class="btn pri lg" id="lockGo">[^<]*<\/button>/,
  '<button class="btn pri lg" id="lockGo">Sign in with Whop</button>'
);

/* Rewrite the help text — the old copy talked about finding a key. */
const helpRe = /<details class="lock-help">[\s\S]*?<\/details>/;
if (helpRe.test(h)) {
  h = h.replace(helpRe, `<details class="lock-help">
      <summary>Having trouble signing in?</summary>
      <div>
        <p>Your browser will open so you can sign in to Whop. Use the same
        account you bought ArturaLabs with, then come back here.</p>
        <p>If nothing opens, check that ArturaLabs is not already running in
        another window.</p>
        <p>If you have just bought and it says no membership was found, give it
        a minute and try again.</p>
      </div>
    </details>`);
  say('updated the help text');
}

fs.writeFileSync(hp, h);

/* ------------------------------------------------------------ 2. renderer */
const ap = 'src/renderer/app.js';
let a = fs.readFileSync(ap, 'utf8');
const before = a.length;

/* Replace the whole activate-by-key routine with the sign-in routine. */
const tryUnlockRe = /async function tryUnlock\(\)\{[\s\S]*?\n\}\n/;
if (!tryUnlockRe.test(a)) die('could not find tryUnlock() in app.js');

a = a.replace(tryUnlockRe, `async function tryUnlock(){
  const btn = $('lockGo');
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Waiting for Whop…';
  lockMsg('Your browser is opening. Sign in to Whop, then come back here.', 'busy');

  const res = await API.license.signIn();

  if (res && res.ok){
    lockMsg('You are in. Opening ArturaLabs…', 'ok');
    setTimeout(() => location.reload(), 700);
    return;
  }

  btn.disabled = false;
  btn.textContent = label;
  const friendly = {
    DENIED:         'Sign-in was cancelled. Click the button to try again.',
    TIMEOUT:        'That took too long. Click the button to try again.',
    PORT:           'Close any other copy of ArturaLabs, then try again.',
    NETWORK:        'Could not reach Whop. Check your internet connection and try again.',
    NO_MEMBERSHIP:  'We could not find an active ArturaLabs membership on that Whop account. If you have just bought, give it a minute and try again.',
    BAD_TOKEN:      'That sign-in expired before it finished. Please try again.',
    BAD_STATE:      'The sign-in did not complete safely. Please try again.',
    SERVER_UNCONFIGURED: 'The membership server is not set up yet. This is not a problem with your account — contact support.',
    NOT_CONFIGURED: 'This build is not set up for sign-in.'
  };
  lockMsg(friendly[res && res.code] || (res && res.message) || 'Sign-in did not complete. Please try again.', 'err');
}
`);
say('replaced key entry with the sign-in flow');

/* The lock screen no longer has a key field, so drop anything touching it. */
a = a.replace(/\s*const f = \$\('lockKey'\);\s*\n\s*if \(f\) f\.addEventListener\([\s\S]*?\}\);\n/, '\n');
a = a.replace(/\s*setTimeout\(\(\) => \{ const f = \$\('lockKey'\); if \(f\) f\.focus\(\); \}, 60\);\n/, '\n');
a = a.replace(/\$\('lockKey'\)\.value = '';\s*/g, '');

/* Wording that mentioned pasting a key. */
a = a.replace(
  /none:\s*'Paste the licence key from your ArturaLabs purchase\. You only do this once on this computer\.'/,
  "none:            'Sign in with the Whop account you bought ArturaLabs with. You only do this once on this computer.'"
);
a = a.replace(
  /revoked:\s*'Whop did not accept this key\.[^']*'/,
  "revoked:         'Your Whop session has ended. Sign in again to carry on.'"
);
a = a.replace(
  /wrong_machine:\s*'A licence works on one computer at a time\.[^']*'/,
  "wrong_machine:   'Your membership is already in use on another computer. Sign out there, or contact support to reset it.'"
);
a = a.replace(
  /offline_expired:\s*'ArturaLabs has not been able to reach the licence server[^']*'/,
  "offline_expired: 'ArturaLabs has not checked your membership in a while. Connect to the internet and sign in again.'"
);
a = a.replace(/'Sign in to ArturaLabs'/g, "'Sign in to ArturaLabs'");
a = a.replace(/We could not confirm your membership/g, 'Your session has ended');
a = a.replace(/This licence is on another computer/g, 'Already signed in elsewhere');

/* Licence row on the API Keys screen. */
a = a.replace(/API\.license\.activate\([^)]*\)/g, 'API.license.signIn()');
a = a.replace(/Active on this computer/g, 'Signed in on this computer');

fs.writeFileSync(ap, a);
say('updated ' + (before - a.length >= 0 ? 'wording and handlers' : 'wording and handlers'));

/* ------------------------------------------------------------- 3. preload */
const pp = 'src/main/preload.js';
let p = fs.readFileSync(pp, 'utf8');
if (p.includes('activate:')) {
  p = p.replace(/activate:\s*key => call\('license:activate',\s*key\),?/, "signIn:   () => call('license:signIn'),");
  fs.writeFileSync(pp, p);
  say('preload now exposes signIn');
} else {
  say('preload already updated');
}

/* ---------------------------------------------------------------- 4. main */
const mp = 'src/main/main.js';
let m = fs.readFileSync(mp, 'utf8');
if (m.includes("license:activate")) {
  m = m.replace(/handle\('license:activate',\s*key => license\.activate\(key\)\);/,
                "handle('license:signIn', () => license.signIn());");
  fs.writeFileSync(mp, m);
  say('main process now handles license:signIn');
} else {
  say('main process already updated');
}

/* --------------------------------------------------------------- 5. check */
const { execFileSync } = require('child_process');
let bad = 0;
for (const f of ['src/main/license.js', 'src/main/config.js', 'src/main/main.js',
                 'src/main/preload.js', 'src/renderer/app.js',
                 'netlify/functions/license.js']) {
  if (!fs.existsSync(f)) { console.log('  MISSING ' + f); bad++; continue; }
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { console.log('  SYNTAX ERROR in ' + f + '\n' + e.stderr.toString().split('\n')[2]); bad++; }
}

if (bad) die(bad + ' file(s) have problems. Nothing was tagged. Tell Claude what is printed above.');

console.log('\n  All files valid.\n');
console.log('  NEXT: put your Whop app id into src/main/config.js, then run  npm start\n');
