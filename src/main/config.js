'use strict';

/* ---------------------------------------------------------------------------
   ArturaLabs configuration.

   CLIENT_ID is the public half of your Whop OAuth app (looks like app_xxxxx).
   It is safe to ship inside the app — that is what "public" means in OAuth.
   The client SECRET is not here and must never be, because an Electron app is
   a zip file anyone can open. We use PKCE instead, which is exactly the
   mechanism designed so desktop apps do not need a secret.

   LICENSE_PROXY_URL is the Netlify function that checks whether a signed-in
   user actually has an active ArturaLabs membership. That one does hold your
   Whop account API key, safely, on the server.

   Until both are filled in, the app runs UNLICENSED: it works, but shows a
   permanent warning bar so an unprotected build cannot be handed out by
   accident.
--------------------------------------------------------------------------- */

const CLIENT_ID = process.env.ARTURA_CLIENT_ID || 'PASTE_YOUR_WHOP_APP_ID_HERE';

const LICENSE_PROXY_URL = process.env.ARTURA_LICENSE_URL
  || 'https://ubiquitous-tulumba-5ff5eb.netlify.app/.netlify/functions/license';

/* How long the app keeps working without reaching the server. Members lose
   internet, get on planes, sit behind hotel wifi. Locking them out the moment
   a request fails punishes a paying customer for their connection. */
const OFFLINE_GRACE_DAYS = 7;

/* Re-check at most this often. Checking on every launch is wasteful and makes
   the app feel slow to open. */
const RECHECK_HOURS = 12;

const isConfigured = () =>
  typeof LICENSE_PROXY_URL === 'string' &&
  LICENSE_PROXY_URL.startsWith('https://') &&
  !LICENSE_PROXY_URL.includes('PASTE_');

module.exports = { CLIENT_ID, LICENSE_PROXY_URL, OFFLINE_GRACE_DAYS, RECHECK_HOURS, isConfigured };
