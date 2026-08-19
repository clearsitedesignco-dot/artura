/* ---------------------------------------------------------------------------
   ArturaLabs membership check.

   The desktop app signs the member in with Whop directly (OAuth + PKCE, no
   secret needed). It then sends us the resulting access token and asks one
   question: does this person have an active ArturaLabs membership?

   We answer it using the Whop ACCOUNT API key, which lives here as an
   environment variable and never travels to anyone's computer. That key can
   read your payments, members and revenue — it must never ship inside the app.

   ENVIRONMENT VARIABLES (Netlify -> Site settings -> Environment variables)

     WHOP_API_KEY      your Whop account API key            (required)
     WHOP_PRODUCT_ID   prod_... for ArturaLabs              (strongly advised)
     WHOP_DEVICE_LIMIT how many computers per member, default 2

   Without WHOP_PRODUCT_ID, a membership to ANY product you sell would open
   ArturaLabs.

   Redeploy after adding variables — Netlify does not pick them up otherwise.
--------------------------------------------------------------------------- */

const USERINFO = 'https://api.whop.com/oauth/userinfo';
const WHOP_API = 'https://api.whop.com/v2';

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
    // Our mistake, not the member's. Say so, rather than implying they did
    // something wrong.
    return reply(500, { valid: false, code: 'SERVER_UNCONFIGURED',
      message: 'The membership server is not set up yet. This is not a problem with your account.' });
  }

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { valid: false, code: 'BAD_REQUEST', message: 'Malformed request.' }); }

  const token = String(payload.access_token || '').trim();
  if (!token) {
    return reply(400, { valid: false, code: 'NO_TOKEN', message: 'No sign-in token supplied.' });
  }

  /* 1. Who is this? Ask Whop using the member's own token. */
  let who = {};
  try {
    const r = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401 || r.status === 403) {
      return reply(200, { valid: false, code: 'BAD_TOKEN',
        message: 'That sign-in has expired. Please sign in again.' });
    }
    who = await r.json();
  } catch {
    return reply(502, { valid: false, code: 'UPSTREAM',
      message: 'Could not reach Whop. Try again in a moment.' });
  }

  const userId = who.sub || who.id;
  if (!userId) {
    return reply(200, { valid: false, code: 'BAD_TOKEN',
      message: 'Whop did not recognise that sign-in. Please try again.' });
  }

  /* 2. Do they hold an active membership for THIS product? Asked with the
        account key, because a member's own token should not be trusted to
        answer a question about whether they have paid us. */
  let memberships = [];
  try {
    const url = new URL(`${WHOP_API}/memberships`);
    url.searchParams.set('user_id', userId);
    url.searchParams.set('per', '50');
    const wantProduct = process.env.WHOP_PRODUCT_ID;
    if (wantProduct) url.searchParams.set('product_id', wantProduct);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (r.status === 401 || r.status === 403) {
      return reply(500, { valid: false, code: 'SERVER_UNCONFIGURED',
        message: 'The membership server could not authenticate. This is not a problem with your account.' });
    }

    const body = await r.json();
    memberships = Array.isArray(body.data) ? body.data : (Array.isArray(body) ? body : []);
  } catch {
    return reply(502, { valid: false, code: 'UPSTREAM',
      message: 'Could not reach Whop. Try again in a moment.' });
  }

  const LIVE = ['active', 'completed', 'trialing', 'trialing_active'];
  const wantProduct = process.env.WHOP_PRODUCT_ID;

  const good = memberships.find(m => {
    const state = String(m.status || m.valid_status || '').toLowerCase();
    if (!LIVE.includes(state) && m.valid !== true) return false;
    if (!wantProduct) return true;
    const got = m.product || m.product_id || (m.plan && m.plan.product) || null;
    return !got || got === wantProduct;
  });

  if (!good) {
    return reply(200, { valid: false, code: 'NO_MEMBERSHIP',
      message: 'We could not find an active ArturaLabs membership on that Whop account. If you have just bought, give it a minute and try again.' });
  }

  return reply(200, {
    valid: true,
    status: good.status || 'active',
    plan: (good.plan && (good.plan.name || good.plan.id)) || good.plan_id || null,
    email: who.email || null,
    user: userId
  });
};
