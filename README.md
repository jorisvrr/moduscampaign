# MODUS opt-out

Privacy notice and unsubscribe endpoint for the MODUS founding outreach. No npm dependencies.

- `/privacy`: static privacy notice (`public/privacy.html`)
- `/unsubscribe?t=TOKEN`: confirmation page; the opt-out is recorded on the button press (POST), not on page load, so email link scanners cannot unsubscribe people by prefetching
- `/api/suppressions`: admin-only JSON list of opted-out ids, used by the send-day check
- `scripts/outreach.mjs`: adds unsubscribe links to the prospect CSV, and runs the suppression check

The token in each link is `<random id>.<HMAC signature>`. It contains no email address. The server stores only `id -> opt-out time`; the id-to-email mapping lives only in your local CSV.

## Setup

1. Push this folder to a GitHub repo and import it in Vercel.
2. Vercel > Storage: add an Upstash Redis database and connect it to the project. The code reads `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, whichever the integration provides.
3. Add environment variables:
   - `UNSUB_SECRET`: `openssl rand -base64 36`. **Never change it after links are sent**, or every existing unsubscribe link stops working.
   - `ADMIN_TOKEN`: `openssl rand -base64 36`
   - `MODUS_CONTACT_EMAIL`: the monitored reply address
4. Add a domain, for example `go.withmodus.co`.
5. Replace every `[PLACEHOLDER]` in `public/privacy.html` (legal name, address, KVK number, contact email). Check the retention period (12 months) and the provider list match reality.
6. In Zoho Mail, make sure read receipts / open tracking are off. The privacy notice says no tracking is used.

## Workflow

Once, before the first send (keep `UNSUB_SECRET` in a password manager):

```bash
UNSUB_SECRET=... BASE_URL=https://go.withmodus.co \
  node scripts/outreach.mjs tokens prospects.csv prospects-links.csv
```

Each send day, before scheduling anything:

```bash
ADMIN_TOKEN=... BASE_URL=https://go.withmodus.co \
  node scripts/outreach.mjs check prospects-links.csv send-today.csv --manual suppressions-manual.txt
```

- Only rows with `suppressed = no` may be sent.
- `suppressions-manual.txt`: one email per line for people who replied "no". Never delete lines from it.
- The check fails closed: if the suppression list cannot be fetched, no output is written.

## Tests

```bash
npm test
```

## Before going live

- Click a real link end to end and confirm the id appears in `/api/suppressions`.
- Send yourself one test email from Zoho and confirm the link survives formatting.
