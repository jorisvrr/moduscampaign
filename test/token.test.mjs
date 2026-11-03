import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newId, makeToken, verifyToken } from '../lib/token.mjs';

const SECRET = 'a'.repeat(40);

test('round trip returns the id', () => {
  const id = newId();
  assert.match(id, /^[A-Za-z0-9_-]{12}$/);
  assert.equal(verifyToken(makeToken(id, SECRET), SECRET), id);
});

test('tampered signature is rejected', () => {
  const token = makeToken(newId(), SECRET);
  const last = token.at(-1) === 'A' ? 'B' : 'A';
  assert.equal(verifyToken(token.slice(0, -1) + last, SECRET), null);
});

test('swapped id is rejected', () => {
  const [, sig] = makeToken(newId(), SECRET).split('.');
  assert.equal(verifyToken(`${newId()}.${sig}`, SECRET), null);
});

test('wrong secret is rejected', () => {
  const token = makeToken(newId(), SECRET);
  assert.equal(verifyToken(token, 'b'.repeat(40)), null);
});

test('malformed input is rejected without throwing', () => {
  for (const bad of ['', 'abc', 'x'.repeat(29), null, undefined, 42, '<script>.x']) {
    assert.equal(verifyToken(bad, SECRET), null);
  }
});

test('short or missing secret throws', () => {
  assert.throws(() => makeToken(newId(), 'short'));
  assert.throws(() => verifyToken('x', undefined));
});
