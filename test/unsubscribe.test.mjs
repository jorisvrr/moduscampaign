import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/unsubscribe.js';
import { newId, makeToken } from '../lib/token.mjs';

const SECRET = 's'.repeat(40);
let calls;
const realFetch = globalThis.fetch;

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ?? ''; },
  };
}

beforeEach(() => {
  process.env.UNSUB_SECRET = SECRET;
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 't';
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ result: 1 }), { status: 200 });
  };
});

afterEach(() => { globalThis.fetch = realFetch; });

test('GET with valid token shows confirm form and records nothing', async () => {
  const token = makeToken(newId(), SECRET);
  const res = mockRes();
  await handler({ method: 'GET', query: { t: token } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<form method="post"/);
  assert.equal(calls.length, 0);
});

test('GET with invalid token returns 400', async () => {
  const res = mockRes();
  await handler({ method: 'GET', query: { t: 'nope' } }, res);
  assert.equal(res.statusCode, 400);
});

test('POST with valid token records the id once via HSETNX', async () => {
  const id = newId();
  const res = mockRes();
  await handler({ method: 'POST', body: { t: makeToken(id, SECRET) }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'HSETNX');
  assert.equal(calls[0][2], id);
});

test('POST with token in query (one-click header style) works', async () => {
  const res = mockRes();
  await handler({ method: 'POST', body: {}, query: { t: makeToken(newId(), SECRET) } }, res);
  assert.equal(res.statusCode, 200);
});

test('POST with forged token records nothing', async () => {
  const res = mockRes();
  await handler({ method: 'POST', body: { t: `${newId()}.${'A'.repeat(16)}` }, query: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test('store failure returns 503, not a false confirmation', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  const res = mockRes();
  await handler({ method: 'POST', body: { t: makeToken(newId(), SECRET) }, query: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(res.body, /You are unsubscribed/);
});

test('missing secret returns 500', async () => {
  delete process.env.UNSUB_SECRET;
  const res = mockRes();
  await handler({ method: 'GET', query: { t: 'x' } }, res);
  assert.equal(res.statusCode, 500);
});
