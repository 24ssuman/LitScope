'use strict';

const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('./public/app.js', 'utf8');

test('read API calls carry an interaction source and survive publisher-tab navigation', () => {
  assert.match(appSource, /async markRead\(id, read, source = 'manual'\)/);
  assert.match(appSource, /body: JSON\.stringify\(\{ read, source \}\)/);
  assert.match(appSource, /keepalive: true/);
  assert.match(appSource, /API\.markRead\(article\.id, true, 'publisher'\)/);
});

test('publisher links retain the positive external signal and mark the article read', () => {
  assert.match(appSource, /queueSuggestionEvent\(article, 'external'\);\s*void markPublisherVisitAsRead\(article\);/);
  assert.match(appSource, /DOM\.drawerDoiLink\.addEventListener\('click'/);
  assert.match(appSource, /window\.open\(article\.link, '_blank'\)/);
});

test('opening the in-app drawer persists read state without using the negative read signal', () => {
  assert.match(appSource, /API\.markRead\(articleId, true, 'open'\)/);
  assert.match(appSource, /API\.markRead\(article\.id, nextRead, 'manual'\)/);
});
