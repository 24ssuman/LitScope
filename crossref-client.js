'use strict';

class CrossrefRequestError extends Error {
  constructor(status, retryAfterMs = null) {
    super(`Crossref returned ${status}`);
    this.name = 'CrossrefRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - now);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createCrossrefClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleepImpl = options.sleepImpl || sleep;
  const nowImpl = options.nowImpl || Date.now;
  const minIntervalMs = options.minIntervalMs ?? 350;
  const maxRetries = options.maxRetries ?? 2;
  const baseBackoffMs = options.baseBackoffMs ?? 1000;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 30000;
  const userAgent = options.userAgent || 'LitScope/1.0';
  const mailto = String(options.mailto || '').trim();

  let queue = Promise.resolve();
  let nextRequestAt = 0;
  const inFlight = new Map();

  async function requestWithRetries(requestUrl) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const intervalWait = Math.max(0, nextRequestAt - nowImpl());
      if (intervalWait > 0) await sleepImpl(intervalWait);
      nextRequestAt = nowImpl() + minIntervalMs;

      const response = await fetchImpl(requestUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json'
        }
      });

      if (response.ok) return response.json();

      const retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'), nowImpl());
      const error = new CrossrefRequestError(response.status, retryAfterMs);
      const retryable = response.status === 429 || response.status === 502
        || response.status === 503 || response.status === 504;

      if (!retryable || attempt === maxRetries) throw error;

      const exponentialDelay = baseBackoffMs * (2 ** attempt);
      const retryDelay = Math.min(
        maxRetryDelayMs,
        Math.max(minIntervalMs, retryAfterMs ?? exponentialDelay)
      );
      nextRequestAt = Math.max(nextRequestAt, nowImpl() + retryDelay);
    }

    throw new Error('Crossref request retry loop ended unexpectedly');
  }

  function getJson(input) {
    const url = new URL(input.toString());
    if (mailto && !url.searchParams.has('mailto')) {
      url.searchParams.set('mailto', mailto);
    }
    const requestUrl = url.toString();

    if (inFlight.has(requestUrl)) return inFlight.get(requestUrl);

    const job = queue.then(() => requestWithRetries(requestUrl));
    queue = job.catch(() => undefined);
    inFlight.set(requestUrl, job);
    job.finally(() => inFlight.delete(requestUrl)).catch(() => undefined);
    return job;
  }

  return { getJson };
}

module.exports = {
  CrossrefRequestError,
  createCrossrefClient,
  parseRetryAfter
};
