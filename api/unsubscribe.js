import { verifyToken } from '../lib/token.mjs';
import { recordSuppression } from '../lib/store.mjs';
import { page, escapeHtml } from '../lib/html.mjs';

// GET  /unsubscribe?t=TOKEN  -> confirmation page with a single button (no JS).
// POST /unsubscribe          -> records the opt-out, shows confirmation.
// GET does not record on purpose: corporate link scanners prefetch links in
// incoming mail, and recording on GET would opt people out who never clicked.
// POST with ?t= in the query also works, so an RFC 8058 List-Unsubscribe-Post
// header can point here later if the sending tool supports it.

function contact() {
  return process.env.MODUS_CONTACT_EMAIL || '';
}

function send(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
}

function contactLine() {
  const email = contact();
  return email
    ? `<p>You can also reply "no" to any of our emails, or write to <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>.</p>`
    : '<p>You can also reply "no" to any of our emails.</p>';
}

const confirmPage = (token) => page('Unsubscribe', `
<h1>Stop emails from MODUS</h1>
<p>Confirm below and we will not send further emails to this address.</p>
<form method="post" action="/unsubscribe">
<input type="hidden" name="t" value="${escapeHtml(token)}">
<button type="submit">Unsubscribe</button>
</form>`);

const donePage = () => page('Unsubscribed', `
<h1>You are unsubscribed</h1>
<p>We will not send further emails to this address. No further action is needed.</p>`);

const invalidPage = () => page('Link not recognised', `
<h1>This link is not recognised</h1>
<p>The unsubscribe link may be incomplete. Please use the full link from the email.</p>
${contactLine()}`);

const errorPage = () => page('Something went wrong', `
<h1>We could not record your request</h1>
<p>Please try again in a few minutes.</p>
${contactLine()}`);

function readToken(req) {
  const fromBody = req.body && typeof req.body === 'object' ? req.body.t : undefined;
  const fromQuery = req.query ? req.query.t : undefined;
  const value = fromBody ?? fromQuery ?? '';
  return Array.isArray(value) ? String(value[0]) : String(value);
}

export default async function handler(req, res) {
  const secret = process.env.UNSUB_SECRET;
  const token = readToken(req);

  let id;
  try {
    id = verifyToken(token, secret);
  } catch (err) {
    console.error('Unsubscribe misconfigured:', err.message);
    return send(res, 500, errorPage());
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return id ? send(res, 200, confirmPage(token)) : send(res, 400, invalidPage());
  }

  if (req.method === 'POST') {
    if (!id) return send(res, 400, invalidPage());
    try {
      await recordSuppression(id);
    } catch (err) {
      console.error('Unsubscribe store failure:', err.message);
      return send(res, 503, errorPage());
    }
    return send(res, 200, donePage());
  }

  res.setHeader('Allow', 'GET, HEAD, POST');
  return send(res, 405, invalidPage());
}
