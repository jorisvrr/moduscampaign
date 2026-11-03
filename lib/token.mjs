import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Token format: <id>.<sig>
//   id  = 9 random bytes, base64url (12 chars). Stored in the CSV and in Redis.
//   sig = first 16 chars of base64url(HMAC-SHA256(secret, id)).
// The token contains no email address. The signature lets the server reject
// forged or mistyped tokens without storing a token-to-email mapping.

const ID_BYTES = 9;
const SIG_LENGTH = 16;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{16}$/;
const MIN_SECRET_LENGTH = 32;

function assertSecret(secret) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`UNSUB_SECRET must be a string of at least ${MIN_SECRET_LENGTH} characters`);
  }
}

function sign(id, secret) {
  return createHmac('sha256', secret).update(id).digest('base64url').slice(0, SIG_LENGTH);
}

export function newId() {
  return randomBytes(ID_BYTES).toString('base64url');
}

export function makeToken(id, secret) {
  assertSecret(secret);
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) throw new Error(`Invalid unsubscribe id: ${id}`);
  return `${id}.${sign(id, secret)}`;
}

/** Returns the id for a valid token, or null. Throws only on a misconfigured secret. */
export function verifyToken(token, secret) {
  assertSecret(secret);
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null;
  const [id, sig] = token.split('.');
  const expected = Buffer.from(sign(id, secret));
  const given = Buffer.from(sig);
  return timingSafeEqual(expected, given) ? id : null;
}
