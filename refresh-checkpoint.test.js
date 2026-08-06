'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createArticleCheckpoint,
  getFeedCheckpoint,
  selectNewArticles,
  sharesArticleIdentity
} = require('./refresh-checkpoint');

function article(id, pubDate, extra = {}) {
  return {
    id,
    feedId: 'journal-a',
    title: `Paper ${id}`,
    link: `https://example.org/${id}`,
    guid: `guid-${id}`,
    pubDate,
    fetchedAt: extra.fetchedAt || pubDate,
    ...extra
  };
}

test('an empty journal checkpoint accepts the initial source page', () => {
  const source = [article('new-2', '2026-08-06T02:00:00Z'), article('new-1', '2026-08-05T02:00:00Z')];

  assert.deepEqual(selectNewArticles(source, null, []).articles, source);
});

test('the source entries before the remembered article are the new entries', () => {
  const existing = article('anchor', '2026-08-05T02:00:00Z');
  const source = [
    article('new-2', '2026-08-06T02:00:00Z'),
    article('new-1', '2026-08-05T12:00:00Z'),
    { ...existing, id: 'source-anchor', link: existing.link, guid: 'different-guid' }
  ];
  const checkpoint = createArticleCheckpoint(existing);

  const result = selectNewArticles(source, checkpoint, [existing]);

  assert.equal(result.mode, 'after-checkpoint');
  assert.deepEqual(result.articles.map(item => item.id), ['new-2', 'new-1']);
  assert.equal(sharesArticleIdentity(source[2], checkpoint), true);
});

test('a rotated source window accepts only records not already in the journal', () => {
  const existing = article('known', '2026-08-05T02:00:00Z');
  const checkpoint = createArticleCheckpoint(article('rotated-out', '2026-08-04T02:00:00Z'));
  const source = [
    article('new-2', '2026-08-06T02:00:00Z'),
    { ...existing, title: 'A changed source title' }
  ];

  const result = selectNewArticles(source, checkpoint, [existing]);

  assert.equal(result.mode, 'checkpoint-not-in-source');
  assert.deepEqual(result.articles.map(item => item.id), ['new-2']);
});

test('legacy feeds derive a checkpoint from the latest fetched article', () => {
  const older = article('older', '2026-08-04T02:00:00Z', {
    fetchedAt: '2026-08-05T10:00:00Z'
  });
  const newer = article('newer', '2026-08-03T02:00:00Z', {
    fetchedAt: '2026-08-05T11:00:00Z'
  });

  const checkpoint = getFeedCheckpoint({ id: 'journal-a' }, [older, newer]);

  assert.equal(checkpoint.key, 'link:https://example.org/newer');
  assert.equal(checkpoint.id, 'newer');
});
