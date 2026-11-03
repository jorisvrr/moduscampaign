#!/usr/bin/env node
// Usage:
//   UNSUB_SECRET=... BASE_URL=https://go.withmodus.co \
//     node scripts/outreach.mjs tokens <in.csv> <out.csv>
//
//   ADMIN_TOKEN=... BASE_URL=https://go.withmodus.co \
//     node scripts/outreach.mjs check <in.csv> <out.csv> [--manual suppressions-manual.txt]
//
// tokens: adds unsubscribe_id (kept if already present) and unsubscribe_url.
// check:  adds suppressed / suppressed_reason / suppressed_at. Fails closed:
//         if the live suppression list cannot be fetched, no output is written.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseCsv, stringifyCsv } from '../lib/csv.mjs';
import { newId, makeToken } from '../lib/token.mjs';

const EMAIL_COLUMN = 'public_business_email';

function die(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function env(name) {
  const value = process.env[name];
  if (!value) die(`${name} is not set`);
  return value;
}

function baseUrl() {
  const url = env('BASE_URL').replace(/\/+$/, '');
  if (!/^https:\/\//.test(url)) die('BASE_URL must start with https://');
  return url;
}

function load(path) {
  if (!existsSync(path)) die(`file not found: ${path}`);
  const { headers, records } = parseCsv(readFileSync(path, 'utf8'));
  if (!headers.includes(EMAIL_COLUMN)) die(`column "${EMAIL_COLUMN}" missing in ${path}`);
  return { headers, records };
}

function withColumns(headers, extra) {
  return [...headers, ...extra.filter((c) => !headers.includes(c))];
}

function warnDuplicates(records) {
  const seen = new Map();
  for (const r of records) {
    const email = r[EMAIL_COLUMN].trim().toLowerCase();
    seen.set(email, (seen.get(email) || 0) + 1);
  }
  for (const [email, count] of seen) {
    if (count > 1) console.warn(`Warning: ${email} appears ${count} times`);
  }
}

function tokens(input, output) {
  const secret = env('UNSUB_SECRET');
  const base = baseUrl();
  const { headers, records } = load(input);
  warnDuplicates(records);

  const used = new Set();
  for (const r of records) {
    if (!r.unsubscribe_id) {
      let id;
      do { id = newId(); } while (used.has(id));
      r.unsubscribe_id = id;
    }
    if (used.has(r.unsubscribe_id)) die(`duplicate unsubscribe_id ${r.unsubscribe_id}`);
    used.add(r.unsubscribe_id);
    r.unsubscribe_url = `${base}/unsubscribe?t=${makeToken(r.unsubscribe_id, secret)}`;
  }

  writeFileSync(output, stringifyCsv(withColumns(headers, ['unsubscribe_id', 'unsubscribe_url']), records));
  console.log(`Wrote ${records.length} rows with unsubscribe links to ${output}`);
}

function readManual(path) {
  if (!path) return new Set();
  if (!existsSync(path)) die(`manual suppression file not found: ${path}`);
  return new Set(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && !line.startsWith('#')),
  );
}

async function check(input, output, manualPath) {
  const admin = env('ADMIN_TOKEN');
  const base = baseUrl();
  const { headers, records } = load(input);
  const manual = readManual(manualPath);

  let remote;
  try {
    const response = await fetch(`${base}/api/suppressions`, {
      headers: { Authorization: `Bearer ${admin}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    remote = (await response.json()).suppressions || {};
  } catch (err) {
    die(`could not fetch suppression list (${err.message}). Nothing written; do not send.`);
  }

  let suppressed = 0;
  for (const r of records) {
    const email = r[EMAIL_COLUMN].trim().toLowerCase();
    r.suppressed = 'no';
    r.suppressed_reason = '';
    r.suppressed_at = '';
    if (r.unsubscribe_id && remote[r.unsubscribe_id]) {
      r.suppressed = 'yes';
      r.suppressed_reason = 'link';
      r.suppressed_at = remote[r.unsubscribe_id];
    } else if (manual.has(email)) {
      r.suppressed = 'yes';
      r.suppressed_reason = 'manual';
    }
    if (r.suppressed === 'yes') suppressed++;
  }

  writeFileSync(output, stringifyCsv(withColumns(headers, ['suppressed', 'suppressed_reason', 'suppressed_at']), records));
  console.log(`${records.length} rows checked, ${suppressed} suppressed, ${records.length - suppressed} sendable. Wrote ${output}`);
}

const [command, input, output, ...rest] = process.argv.slice(2);
const manualIndex = rest.indexOf('--manual');
const manualPath = manualIndex >= 0 ? rest[manualIndex + 1] : undefined;

if (!input || !output) die('usage: outreach.mjs <tokens|check> <in.csv> <out.csv> [--manual file]');
if (command === 'tokens') tokens(input, output);
else if (command === 'check') await check(input, output, manualPath);
else die(`unknown command "${command}"`);
