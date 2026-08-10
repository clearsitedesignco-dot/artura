# Turning the licence gate on

The gate is built and tested. It is **not live yet**, because it needs two
things only the Whop account owner can get. Until they're filled in, the app
opens for anyone and shows an orange "Unlicensed build" bar along the bottom —
deliberately, so an unprotected copy can't be handed out by accident.

---

## What you need from Landon

| What | Where it comes from | Used for |
|---|---|---|
| **Whop account API key** | Whop dashboard → Developer → API keys | Lets the server ask Whop whether a key is real |
| **Product ID** (`prod_…`) | Whop dashboard → Products → ArturaLabs | Stops a key for a *different* product opening this app |
| **One real test key** | Buy your own product, or issue a comp membership | Proving the gate works before members hit it |

The API key is the sensitive one. It can read your payments, members and
revenue. It must go in Netlify's environment variables and nowhere else —
never in the app, never in the repo, never in a screenshot.

---

## Step 1 — deploy the licence server

The whole server is one file: `netlify/functions/license.js`.

1. Go to Netlify → **Add new site** → **Import from Git** → pick the `artura` repo
2. Netlify reads `netlify.toml` and finds the function on its own
3. Once deployed, go to **Site settings → Environment variables** and add:

   ```
   WHOP_API_KEY      = (Landon's account API key)
   WHOP_PRODUCT_ID   = prod_xxxxxxxx
   ```

4. **Redeploy** after adding variables. Netlify does not pick them up until you do.

Your function address will be:

```
https://YOUR-SITE-NAME.netlify.app/.netlify/functions/license
```

## Step 2 — point the app at it

Open `src/main/config.js` and replace the placeholder:

```js
const LICENSE_PROXY_URL = 'https://YOUR-SITE-NAME.netlify.app/.netlify/functions/license';
```

Commit, tag, and let CI build the installers.

## Step 3 — prove it works before anyone else touches it

Do all four. The first two are the ones people skip and regret.

1. **A real key opens the app.** Paste Landon's test key. Should unlock.
2. **A nonsense key does not.** Type `asdfasdf`. Should say the key wasn't found.
3. **The same key on a second computer is refused.** This is the anti-sharing
   check and it is the whole point. It should say the licence is already in
   use elsewhere.
4. **Pulling the internet doesn't lock out a paid member.** Disconnect wifi,
   reopen the app. It should still open and show a grey bar saying how many
   days you have.

---

## How it behaves

**One computer per licence.** On first use, Whop binds the key to a fingerprint
of the machine — hostname, username, platform, architecture, hashed. Whop never
sees anything identifying. A second machine gets refused until the member resets
the key from their Whop orders page.

**Seven days offline.** A failed network request is not evidence someone stopped
paying — it's usually a cafe wifi or a flight. So the app keeps working for
seven days since the last successful check, warning as the deadline approaches.
A refund still shuts access off, just not instantly.

**A real "no" is acted on immediately.** If Whop is reached and says the
membership is cancelled or expired, the app locks on the spot. The distinction
that matters is between *couldn't ask* and *asked and got told no*.

**Their work is never held hostage.** Signing out, or a licence lapsing, does
not touch saved leads, calls or notes. Those are the member's. Reactivate and
everything is where they left it.

---

## What this does and does not stop

It stops casual sharing — one person buying and passing the key to a group chat.
That is the realistic threat and this handles it.

It will not stop a determined person who is willing to edit the app. Electron
apps can be unpacked, and a licence check that runs on someone else's computer
can be removed by someone who knows how. Every desktop app has this property.
The honest goal is to make sharing inconvenient enough that buying is easier,
not to make cracking impossible.

If you later want something stronger, the move is to make the server do
something the app genuinely cannot do without it — not to add more checks on
the client side.
