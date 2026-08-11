'use strict';

/* ---------------------------------------------------------------------------
   ArturaLabs configuration.

   LICENSE_PROXY_URL is the address of the small serverless function that sits
   between this app and Whop. It exists for one reason: the Whop API key must
   never be inside the app. Anyone can unzip an Electron app in about ten
   seconds and read every file in it, so a key shipped to members is a key
   given away.

   Deploy netlify/functions/license.js, then paste the resulting address below.
   It will look like:

       https://your-site-name.netlify.app/.netlify/functions/license

   Until this is filled in, the app runs in UNLICENSED MODE: it works normally
   but shows a permanent warning banner, so an unlicensed build can never be
   handed out by accident.
--------------------------------------------------------------------------- */

const LICENSE_PROXY_URL = process.env.ARTURA_LICENSE_URL || 'https://ubiquitous-tulumba-5ff5eb.netlify.app/.netlify/functions/license';

/* How long the app keeps working without reaching the licence server.
   Members lose internet, get on planes, work from cafes with captive portals.
   Locking them out the moment a request fails would be punishing a paying
   customer for their wifi. Seven days is long enough to be invisible and
   short enough that a refunded member cannot keep using it indefinitely. */
const OFFLINE_GRACE_DAYS = 7;

/* Re-check with Whop at most this often. A check on every single launch is
   wasteful and makes the app feel slow to open. */
const RECHECK_HOURS = 12;

const isConfigured = () =>
  typeof LICENSE_PROXY_URL === 'string' &&
  LICENSE_PROXY_URL.startsWith('https://') &&
  !LICENSE_PROXY_URL.includes('PASTE_YOUR');

module.exports = { LICENSE_PROXY_URL, OFFLINE_GRACE_DAYS, RECHECK_HOURS, isConfigured };
