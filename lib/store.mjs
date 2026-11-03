// Suppression store on Upstash Redis via its REST API (plain fetch, no SDK).
// Stores only: unsubscribe id -> ISO timestamp of the first opt-out. No email addresses.

const KEY = 'modus:suppressions';

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis REST credentials are not configured');
  return { url: url.replace(/\/+$/, ''), token };
}

async function command(args) {
  const { url, token } = config();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(`Redis command ${args[0]} failed: ${data.error || response.status}`);
  }
  return data.result;
}

/** Idempotent: HSETNX keeps the first opt-out time if the link is clicked again. */
export async function recordSuppression(id, now = new Date()) {
  await command(['HSETNX', KEY, id, now.toISOString()]);
}

/** Returns { [id]: isoTimestamp }. */
export async function listSuppressions() {
  const result = await command(['HGETALL', KEY]);
  if (!result) return {};
  if (!Array.isArray(result)) return result;
  const out = {};
  for (let i = 0; i < result.length; i += 2) out[result[i]] = result[i + 1];
  return out;
}
