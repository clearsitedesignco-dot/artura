'use strict';

/* ---------------------------------------------------------------------------
   ArturaLabs — Sign in with Whop.

   Replaces the old paste-a-licence-key screen entirely.

   How it works:

     1. The app starts a tiny web server on 127.0.0.1 and opens the member's
        real browser at Whop's authorize page.
     2. They sign in to Whop (or are already signed in) and approve.
     3. Whop redirects back to that local server with a one-time code.
     4. The app swaps the code for an access token using PKCE, so no client
        secret ever has to live inside the app. This matters: an Electron app
        is a zip file anyone can open, so a secret shipped inside it is a
        secret published to every buyer.
     5. The app asks our Netlify function whether that user actually has an
        active ArturaLabs membership. Netlify holds the Whop account key.

   Whop OAuth reference: https://docs.whop.com/developer/guides/oauth
--------------------------------------------------------------------------- */

const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { shell } = require('electron');
const db = require('./store');
const keys = require('./keys');
const cfg = require('./config');

const DAY = 86400000;

/* Fixed port, because Whop requires the redirect URI to match exactly and a
   random port could never be registered in advance. */
const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

/* ---------------------------------------------------------------------------
   Machine fingerprint — used for the device limit, hashed so nothing
   identifying about the member's computer ever leaves it.
--------------------------------------------------------------------------- */
function hwid() {
  let user = '';
  try { user = os.userInfo().username || ''; } catch { user = ''; }
  const parts = [os.hostname() || '', user, os.platform(), os.arch()].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 32);
}

function readState() {
  try { return JSON.parse(db.getSetting('license') || '{}'); }
  catch { return {}; }
}
function writeState(s) { db.setSetting('license', JSON.stringify(s)); }

/* ---------------------------- PKCE helpers ---------------------------- */
const b64url = buf => buf.toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

function makePkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge, state: b64url(crypto.randomBytes(16)) };
}

/* ---------------------------------------------------------------------------
   The little local server that catches Whop's redirect.

   It runs only during sign-in and shuts itself down the moment it has the
   code, or after two minutes if the member wanders off.
--------------------------------------------------------------------------- */
function waitForCode(expectedState) {
  return new Promise((resolve, reject) => {
    let done = false;

    const page = (title, body) => `<!doctype html><meta charset="utf-8">
<title>ArturaLabs</title>
<style>
 body{font-family:system-ui,-apple-system,sans-serif;background:#141416;color:#fff;
      display:grid;place-items:center;height:100vh;margin:0;text-align:center}
 h1{font-size:22px;font-weight:600;margin:0 0 10px}
 p{color:rgba(255,255,255,.55);font-size:14px;max-width:36ch;line-height:1.6;margin:0}
</style>
<div><h1>${title}</h1><p>${body}</p></div>`;

    const server = http.createServer((req, res) => {
      if (!req.url.startsWith('/callback')) { res.writeHead(404); res.end(); return; }

      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      const finish = (ok, title, body, err) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(page(title, body));
        if (done) return;
        done = true;
        setTimeout(() => server.close(), 200);
        ok ? resolve(code) : reject(err);
      };

      if (error) {
        const e = new Error(url.searchParams.get('error_description') || error);
        e.code = 'DENIED';
        return finish(false, 'Sign-in cancelled', 'You can close this tab and try again in ArturaLabs.', e);
      }
      if (!code || state !== expectedState) {
        const e = new Error('The sign-in response did not match what the app expected.');
        e.code = 'BAD_STATE';
        return finish(false, 'Something went wrong', 'Close this tab and try signing in again.', e);
      }
      finish(true, 'You are signed in', 'You can close this tab and go back to ArturaLabs.');
    });

    server.on('error', err => {
      const e = new Error(err.code === 'EADDRINUSE'
        ? 'ArturaLabs could not start sign-in because something else is using the port. Close any other copy of ArturaLabs and try again.'
        : 'Could not start the sign-in listener.');
      e.code = 'PORT';
      reject(e);
    });

    server.listen(PORT, '127.0.0.1');

    setTimeout(() => {
      if (done) return;
      done = true;
      server.close();
      const e = new Error('Sign-in timed out. Try again.');
      e.code = 'TIMEOUT';
      reject(e);
    }, 120000);
  });
}

/* ---------------------- talk to Whop / our server ---------------------- */
async function postJson(url, body, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    let data = {};
    try { data = await res.json(); } catch { /* leave empty */ }
    return { status: res.status, data };
  } catch {
    const e = new Error('Could not reach the server. Check your internet connection.');
    e.code = 'NETWORK';
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* Ask our Netlify function whether this Whop user has an active membership. */
async function checkMembership(accessToken) {
  if (!cfg.isConfigured()) {
    const e = new Error('Licence checking is not set up in this build.');
    e.code = 'NOT_CONFIGURED';
    throw e;
  }
  const { status, data } = await postJson(cfg.LICENSE_PROXY_URL, {
    access_token: accessToken,
    hwid: hwid()
  });

  if (status === 200 && data.valid === true) {
    return { valid: true, plan: data.plan || null, email: data.email || null,
             user: data.user || null, status: data.status || 'active' };
  }
  const e = new Error(data.message || 'We could not confirm an active membership.');
  e.code = data.code || 'NO_MEMBERSHIP';
  throw e;
}

/* ---------------------------------------------------------------------------
   signIn — the whole flow, triggered by the button on the lock screen.
--------------------------------------------------------------------------- */
async function signIn() {
  if (!cfg.CLIENT_ID || cfg.CLIENT_ID.includes('PASTE_')) {
    const e = new Error('This build has no Whop app configured.');
    e.code = 'NOT_CONFIGURED';
    throw e;
  }

  const pkce = makePkce();
  const waiter = waitForCode(pkce.state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state: pkce.state,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256'
  });
  await shell.openExternal(`https://api.whop.com/oauth/authorize?${params}`);

  const code = await waiter;

  const { status, data } = await postJson('https://api.whop.com/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: cfg.CLIENT_ID,
    code_verifier: pkce.verifier
  });

  if (status !== 200 || !data.access_token) {
    const e = new Error(data.error_description || 'Whop would not complete the sign-in.');
    e.code = data.error || 'TOKEN_FAILED';
    throw e;
  }

  const member = await checkMembership(data.access_token);

  keys.set('whopRefresh', data.refresh_token || '');
  writeState({
    activated: true,
    lastCheck: Date.now(),
    lastGood: Date.now(),
    hwid: hwid(),
    plan: member.plan,
    email: member.email,
    user: member.user
  });
  db.logEvent('key', 'Signed in with Whop');
  return { valid: true, plan: member.plan, email: member.email };
}

/* ---------------------------------------------------------------------------
   status — called on every launch.

   Generous when the network fails, strict when Whop actually says no. A failed
   request is not evidence that someone stopped paying; a rejection is.
--------------------------------------------------------------------------- */
async function status() {
  if (!cfg.isConfigured() || !cfg.CLIENT_ID || cfg.CLIENT_ID.includes('PASTE_')) {
    return { state: 'unconfigured', ok: true,
             message: 'Licence checking is not set up in this build.' };
  }

  const st = readState();
  if (!st.activated) return { state: 'none', ok: false };

  if (st.hwid && st.hwid !== hwid()) {
    return { state: 'wrong_machine', ok: false,
             message: 'This membership is already in use on another computer.' };
  }

  const fresh = (Date.now() - (st.lastCheck || 0)) < cfg.RECHECK_HOURS * 3600000;
  if (fresh) {
    return { state: 'ok', ok: true, plan: st.plan, email: st.email, checked: 'cached' };
  }

  let refresh = null;
  try { refresh = keys.get('whopRefresh'); } catch { refresh = null; }
  if (!refresh) {
    /* Nothing to re-check with, but they signed in before and the grace window
       is still open — let them work rather than locking them out. */
    const days = (Date.now() - (st.lastGood || 0)) / DAY;
    if (days <= cfg.OFFLINE_GRACE_DAYS) {
      return { state: 'ok', ok: true, plan: st.plan, email: st.email, checked: 'cached' };
    }
    return { state: 'none', ok: false };
  }

  try {
    const { status: s, data } = await postJson('https://api.whop.com/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: cfg.CLIENT_ID
    });

    if (s !== 200 || !data.access_token) {
      writeState({ ...st, activated: false });
      return { state: 'revoked', ok: false,
               message: 'Your Whop session has expired. Sign in again to carry on.' };
    }

    /* Refresh tokens rotate on every use, so the new one must be saved. */
    if (data.refresh_token) keys.set('whopRefresh', data.refresh_token);

    const member = await checkMembership(data.access_token);
    writeState({ ...st, lastCheck: Date.now(), lastGood: Date.now(),
                 plan: member.plan, email: member.email });
    return { state: 'ok', ok: true, plan: member.plan, email: member.email, checked: 'live' };

  } catch (err) {
    if (err.code !== 'NETWORK' && err.code !== 'NOT_CONFIGURED') {
      writeState({ ...st, activated: false, reason: err.code });
      return { state: 'revoked', ok: false, message: err.message, code: err.code };
    }
    const days = (Date.now() - (st.lastGood || 0)) / DAY;
    if (days <= cfg.OFFLINE_GRACE_DAYS) {
      const left = Math.max(0, Math.ceil(cfg.OFFLINE_GRACE_DAYS - days));
      return { state: 'offline', ok: true, plan: st.plan, daysLeft: left,
               message: `Working offline. Connect to the internet within ${left} day${left === 1 ? '' : 's'}.` };
    }
    return { state: 'offline_expired', ok: false,
             message: `ArturaLabs has not been able to check your membership for ${cfg.OFFLINE_GRACE_DAYS} days. Connect to the internet to carry on.` };
  }
}

/* Signing out clears the session but never the member's work. Their leads,
   calls and notes are theirs. */
async function signOut() {
  let refresh = null;
  try { refresh = keys.get('whopRefresh'); } catch { /* ignore */ }
  if (refresh) {
    try {
      await postJson('https://api.whop.com/oauth/revoke',
        { token: refresh, client_id: cfg.CLIENT_ID });
    } catch { /* revoking is best-effort; local sign-out still proceeds */ }
  }
  try { keys.remove('whopRefresh'); } catch { /* ignore */ }
  writeState({});
  db.logEvent('key', 'Signed out');
  return true;
}

module.exports = { signIn, status, signOut, hwid, isConfigured: cfg.isConfigured };
