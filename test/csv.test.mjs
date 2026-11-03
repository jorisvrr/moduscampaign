import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, stringifyCsv } from '../lib/csv.mjs';

test('parses quoted fields with commas, quotes and newlines', () => {
  const text = '﻿name,email\r\n"Acme, LLC",a@x.com\n"Say ""hi""\nthere",b@x.com\n';
  const { headers, records } = parseCsv(text);
  assert.deepEqual(headers, ['name', 'email']);
  assert.equal(records[0].name, 'Acme, LLC');
  assert.equal(records[1].name, 'Say "hi"\nthere');
});

test('round trip is lossless', () => {
  const headers = ['a', 'b'];
  const records = [{ a: 'x,y', b: 'q"q' }, { a: '', b: 'plain' }];
  const parsed = parseCsv(stringifyCsv(headers, records));
  assert.deepEqual(parsed.headers, headers);
  assert.deepEqual(parsed.records, records);
});

test('rejects rows with the wrong field count', () => {
  assert.throws(() => parseCsv('a,b\n1,2,3\n'), /row 2/);
});

test('rejects unterminated quotes', () => {
  assert.throws(() => parseCsv('a\n"open\n'), /unterminated/);
});

test('parses the real seed file shape', () => {
  const text = 'country,market_cell,business_name\nUS,"Bay County, FL — Central Time","C Q ELECTRICAL, LLC"\n';
  const { records } = parseCsv(text);
  assert.equal(records[0].market_cell, 'Bay County, FL — Central Time');
  assert.equal(records[0].business_name, 'C Q ELECTRICAL, LLC');
});
