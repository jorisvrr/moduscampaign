import { createHash, timingSafeEqual } from 'node:crypto';
import { listSuppressions } from '../lib/store.mjs';

// GET /api/suppressions with "Authorization: Bearer ADMIN_TOKEN".
// Used by scripts/outreach.mjs check before every send day.

function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const admin = process.env.ADMIN_TOKEN;
  if (!admin || admin.length < 32) return json(res, 500, { error: 'ADMIN_TOKEN not configured' });

  const header = req.headers.authorization || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!given || !safeEqual(given, admin)) return json(res, 401, { error: 'unauthorized' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'method not allowed' });
  }

  try {
    return json(res, 200, { suppressions: await listSuppressions() });
  } catch (err) {
    console.error('Suppression list failure:', err.message);
    return json(res, 502, { error: 'store unavailable' });
  }
}
