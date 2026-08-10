'use strict';

const os = require('os');
const crypto = require('crypto');
const db = require('./store');
const keys = require('./keys');
const cfg = require('./config');

const DAY = 86400000;

/* ---------------------------------------------------------------------------
   Machine fingerprint.

   Whop binds a licence key to whatever identifier we send the first time it is
   used. Send a different one later and Whop answers 400 — that is how one
   purchase is stopped from being shared with a hundred people.

   The identifier has to be stable, or a paying member gets locked out of their
   own computer for no reason. So it is derived from things that survive a
   reboot, a reinstall of the app, and even wiping the app's saved data:
   hostname, OS username, platform and architecture. It is hashed, so nothing
   identifying about the member's machine ever leaves it — Whop only ever sees
   an opaque string.
--------------------------------------------------------------------------- */
function hwid() {
  const parts = [
    os.hostname() || '',
    (os.userInfo && (() => { try { return os.userInfo().username; } catch { return ''; } })()) || '',
    os.platform(),
    os.arch()
  ].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 32);
}

function readState() {
  try { return JSON.parse(db.getSetting('license') || '{}'); }
  catch { return {}; }
}
function writeState(s) { db.setSetting('license', JSON.stringify(s)); }

/* Ask our own serverless function, which holds the Whop key and asks Whop. */
async function askServer(key) {
  if (!cfg.isConfigured()) {
    const e = new Error('Licence checking is not set up in this build.');
    e.code = 'NOT_CONFIGURED';
    throw e;
  }

  let res;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    res = await fetch(cfg.LICENSE_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: String(key || '').trim(), hwid: hwid() }),
      signal: controller.signal
    });
  } catch (err) {
    const e = new Error('Could not reach the licence server. Check your internet connection.');
    e.code = 'NETWORK';
    throw e;
  } finally {
    clearTimeout(timer);
  }

  let body = {};
  try { body = await res.json(); } catch { /* fall through to status handling */ }

  if (res.status === 200 && body.valid === true) {
    return { valid: true, plan: body.plan || null, email: body.email || null, status: body.status || null };
  }

  const e = new Error(body.message || 'That licence key was not accepted.');
  e.code = body.code || (res.status === 404 ? 'BAD_KEY' : 'REJECTED');
  throw e;
}

/* ---------------------------------------------------------------------------
   activate — the member pastes their key. Checked live, no grace period, and
   only stored once Whop has actually said yes.
--------------------------------------------------------------------------- */
async function activate(key) {
  const clean = String(key || '').trim();
  if (!clean) { const e = new Error('Paste your licence key first.'); e.code = 'EMPTY'; throw e; }

  const result = await askServer(clean);

  await keys.set('whopLicenseKey', clean);
  writeState({
    activated: true,
    lastCheck: Date.now(),
    lastGood: Date.now(),
    hwid: hwid(),
    plan: result.plan,
    email: result.email
  });
  db.logEvent('key', 'Licence activated');
  return { valid: true, plan: result.plan, email: result.email };
}

/* ---------------------------------------------------------------------------
   status — called on every launch. Decides whether the app opens.

   Deliberately generous when the network fails and deliberately strict when
   Whop actually says no. A failed request is not evidence that someone has
   stopped paying; a 400 from Whop is.
--------------------------------------------------------------------------- */
async function status({ force = false } = {}) {
  if (!cfg.isConfigured()) {
    return { state: 'unconfigured', ok: true,
             message: 'Licence checking is not set up in this build.' };
  }

  const st = readState();
  const stored = await keys.get('whopLicenseKey').catch(() => null);

  if (!stored || !st.activated) return { state: 'none', ok: false };

  /* The saved licence belongs to a different machine. */
  if (st.hwid && st.hwid !== hwid()) {
    return { state: 'wrong_machine', ok: false,
             message: 'This licence is already in use on another computer.' };
  }

  const sinceCheck = Date.now() - (st.lastCheck || 0);
  const fresh = sinceCheck < cfg.RECHECK_HOURS * 3600000;
  if (fresh && !force) {
    return { state: 'ok', ok: true, plan: st.plan, email: st.email, checked: 'cached' };
  }

  try {
    const result = await askServer(stored);
    writeState({ ...st, lastCheck: Date.now(), lastGood: Date.now(),
                 plan: result.plan, email: result.email });
    return { state: 'ok', ok: true, plan: result.plan, email: result.email, checked: 'live' };
  } catch (err) {
    /* Whop was reached and said no. That is a real answer — act on it. */
    if (err.code !== 'NETWORK' && err.code !== 'NOT_CONFIGURED') {
      writeState({ ...st, activated: false, lastCheck: Date.now(), reason: err.code });
      return { state: 'revoked', ok: false, message: err.message, code: err.code };
    }

    /* Could not reach the server. Fall back on the grace window. */
    const daysSinceGood = (Date.now() - (st.lastGood || 0)) / DAY;
    if (daysSinceGood <= cfg.OFFLINE_GRACE_DAYS) {
      const left = Math.max(0, Math.ceil(cfg.OFFLINE_GRACE_DAYS - daysSinceGood));
      return { state: 'offline', ok: true, plan: st.plan, daysLeft: left,
               message: `Working offline. Connect to the internet within ${left} day${left === 1 ? '' : 's'}.` };
    }
    return { state: 'offline_expired', ok: false,
             message: `ArturaLabs has not been able to check your licence for ${cfg.OFFLINE_GRACE_DAYS} days. Connect to the internet to carry on.` };
  }
}

/* Sign out — clears the licence from this machine but keeps the member's work.
   Their leads, calls and meetings are theirs and are not held hostage. */
async function signOut() {
  await keys.remove('whopLicenseKey').catch(() => {});
  writeState({});
  db.logEvent('key', 'Signed out of licence');
  return true;
}

module.exports = { activate, status, signOut, hwid, isConfigured: cfg.isConfigured };
