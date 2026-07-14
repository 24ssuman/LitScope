'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CrossrefRequestError,
  createCrossrefClient,
  parseRetryAfter
} = require('./crossref-client');

function response(status, body = {}, retryAfter = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === 'retry-after' ? retryAfter : null },
    json: async () => body
  };
}

test('parses Retry-After seconds', () => {
  assert.equal(parseRetryAfter('2'), 2000);
  assert.equal(parseRetryAfter('invalid'), null);
});

test('retries a 429 and honors a bounded delay', async () => {
  const responses = [response(429, {}, '2'), response(200, { message: { items: [] } })];
  const delays = [];
  const client = createCrossrefClient({
    fetchImpl: async () => responses.shift(),
    sleepImpl: async ms => delays.push(ms),
    minIntervalMs: 0,
    maxRetries: 1,
    maxRetryDelayMs: 5000
  });

  const result = await client.getJson('https://api.crossref.org/works');
  assert.deepEqual(result, { message: { items: [] } });
  assert.deepEqual(delays, [2000]);
});

test('deduplicates identical requests already in flight', async () => {
  let fetchCount = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const client = createCrossrefClient({
    fetchImpl: async () => {
      fetchCount++;
      await gate;
      return response(200, { ok: true });
    },
    minIntervalMs: 0
  });

  const first = client.getJson('https://api.crossref.org/works?rows=20');
  const second = client.getJson('https://api.crossref.org/works?rows=20');
  release();

  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await second, { ok: true });
  assert.equal(fetchCount, 1);
});

test('surfaces the final Crossref status after retries are exhausted', async () => {
  const client = createCrossrefClient({
    fetchImpl: async () => response(429),
    sleepImpl: async () => {},
    minIntervalMs: 0,
    maxRetries: 1,
    baseBackoffMs: 0
  });

  await assert.rejects(
    client.getJson('https://api.crossref.org/works'),
    error => error instanceof CrossrefRequestError && error.status === 429
  );
});
