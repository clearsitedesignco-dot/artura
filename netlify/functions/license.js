/* ---------------------------------------------------------------------------
   ArturaLabs licence proxy.

   The desktop app talks to this. This talks to Whop. The Whop API key lives
   here as an environment variable and never travels to a member's computer.

   This matters more than it sounds. An Electron app is a zip file with a
   different extension. Anyone who buys ArturaLabs can unpack it and read every
   line of it, including any key inside. A key shipped in the app is a key
   published to everyone who ever buys it — and a Whop account key can read
   your payments, your members and your revenue.

   SETUP
   -----
   1. Deploy this folder to Netlify.
   2. Netlify dashboard -> Site settings -> Environment variables, add:

        WHOP_API_KEY   your Whop account API key
                       (Whop dashboard -> Developer -> API keys)

      Optional, and worth setting:

        WHOP_PRODUCT_ID   the prod_... id of the ArturaLabs product.
                          Without it, ANY valid licence from ANY product you
                          sell will open the app.

   3. Copy the deployed function address into src/main/config.js.

   Verify with:

     curl -X POST https://YOUR-SITE.netlify.app/.netlify/functions/license \
       -H "Content-Type: application/json" \
       -d '{"key":"test-key","hwid":"abc123"}'
--------------------------------------------------------------------------- */

const WHOP_API = 'https://api.whop.com/api/v2/memberships';

exports.handler = async (event) => {
  const reply = (status, body) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== 'POST') {
    return reply(405, { valid: false, code: 'METHOD', message: 'POST only.' });
  }

  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    // Configuration mistake on our side, not the member's. Say so plainly
    // rather than telling a paying customer their key is bad.
    return reply(500, { valid: false, code: 'SERVER_UNCONFIGURED',
      message: 'The licence server is not set up yet. This is not a problem with your key.' });
  }

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { valid: false, code: 'BAD_REQUEST', message: 'Malformed request.' }); }

  const key  = String(payload.key  || '').trim();
  const hwid = String(payload.hwid || '').trim();

  if (!key)  return reply(400, { valid: false, code: 'EMPTY',   message: 'No licence key supplied.' });
  if (!hwid) return reply(400, { valid: false, code: 'NO_HWID', message: 'No machine id supplied.' });

  // Keys are short and printable. Reject anything else before it reaches Whop.
  if (key.length > 128 || /[\r\n\t]/.test(key)) {
    return reply(400, { valid: false, code: 'BAD_KEY', message: 'That does not look like a licence key.' });
  }

  let res, body = {};
  try {
    res = await fetch(`${WHOP_API}/${encodeURIComponent(key)}/validate_license`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ metadata: { hwid } })
    });
    try { body = await res.json(); } catch { body = {}; }
  } catch (err) {
    return reply(502, { valid: false, code: 'UPSTREAM',
      message: 'Could not reach Whop. Try again in a moment.' });
  }

  /* Whop answers 201 when the key is good — either it was unbound and has now
     been bound to this machine, or it was already bound to this same machine. */
  if (res.status === 201 || res.status === 200) {
    const m = body || {};

    // Optional: make sure the key belongs to THIS product, not some other
    // thing sold from the same Whop account.
    const wantProduct = process.env.WHOP_PRODUCT_ID;
    if (wantProduct) {
      const got = m.product || m.product_id || (m.plan && m.plan.product) || null;
      if (got && got !== wantProduct) {
        return reply(200, { valid: false, code: 'WRONG_PRODUCT',
          message: 'That key is for a different product.' });
      }
    }

    // A cancelled or expired membership can still return a key. Check status.
    const state = (m.status || m.valid_status || '').toLowerCase();
    const dead = ['expired', 'cancelled', 'canceled', 'past_due', 'unresolved'];
    if (state && dead.includes(state)) {
      return reply(200, { valid: false, code: 'INACTIVE',
        message: 'That membership is no longer active.' });
    }

    return reply(200, {
      valid: true,
      status: m.status || 'active',
      plan: (m.plan && (m.plan.name || m.plan.id)) || m.plan_id || null,
      email: m.email || (m.user && m.user.email) || null
    });
  }

  /* 400 is Whop's answer when the key is bound to a different machine. */
  if (res.status === 400) {
    return reply(200, { valid: false, code: 'WRONG_MACHINE',
      message: 'This licence is already active on another computer. Reset it from your Whop orders page, then try again.' });
  }

  if (res.status === 404) {
    return reply(200, { valid: false, code: 'BAD_KEY',
      message: 'That licence key was not found. Check for a typo or a missing character.' });
  }

  if (res.status === 401 || res.status === 403) {
    // Our key is wrong, not theirs.
    return reply(500, { valid: false, code: 'SERVER_UNCONFIGURED',
      message: 'The licence server could not authenticate. This is not a problem with your key.' });
  }

  if (res.status === 429) {
    return reply(200, { valid: false, code: 'RATE_LIMIT',
      message: 'Too many attempts. Wait a minute and try again.' });
  }

  return reply(200, { valid: false, code: 'REJECTED',
    message: 'That licence key was not accepted.' });
};
