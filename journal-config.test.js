'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_JOURNALS,
  createDefaultFeeds,
  getChemRxivCategories,
  getCrossrefFallbacks,
  getJournalHomepages,
  isSupportedFeedUrl,
  slugifyFeedName,
  validateJournalDefinitions
} = require('./journal-config');

test('the registry retains the current journal catalog and feed shape', () => {
  assert.equal(DEFAULT_JOURNALS.length, 30);
  assert.equal(DEFAULT_JOURNALS.filter(journal => journal.source === 'rss').length, 28);
  assert.equal(DEFAULT_JOURNALS.filter(journal => journal.source === 'chemrxiv').length, 2);

  const feeds = createDefaultFeeds();
  assert.deepEqual(feeds[0], {
    id: 'jcc',
    name: 'JCC',
    url: 'https://onlinelibrary.wiley.com/feed/1096987x/most-recent',
    category: 'Comp Chem'
  });
  assert.deepEqual(feeds.at(-1), {
    id: 'chemrxiv-pc',
    name: 'ChemRxiv: Phys Chem',
    url: 'chemrxiv://physical-chemistry',
    category: 'Comp Chem'
  });
});

test('optional fallback metadata is derived from the same registry', () => {
  assert.equal(getJournalHomepages().jctc, 'https://pubs.acs.org/journal/jctcce');
  assert.deepEqual(getCrossrefFallbacks().jcc, { issn: '1096-987X', rows: 20 });
  assert.deepEqual(getChemRxivCategories(), {
    'chemrxiv-tcc': '605c704b6c174a001015cca0',
    'chemrxiv-pc': '605c704b6c174a001015cc9e'
  });
});

test('a new RSS journal needs only the core definition fields', () => {
  const newJournal = {
    id: 'new-journal',
    name: 'New Journal',
    url: 'https://example.org/journal.rss',
    category: 'Chem'
  };

  assert.equal(validateJournalDefinitions([newJournal]), true);
  assert.deepEqual(createDefaultFeeds([newJournal]), [
    { id: 'new-journal', name: 'New Journal', url: newJournal.url, category: 'Chem' }
  ]);
});

test('registry validation catches duplicate or unsupported entries', () => {
  const base = {
    id: 'journal',
    name: 'Journal',
    url: 'https://example.org/journal.rss',
    category: 'Chem'
  };

  assert.throws(
    () => validateJournalDefinitions([base, { ...base }]),
    /Duplicate journal id/
  );
  assert.throws(
    () => validateJournalDefinitions([{ ...base, url: 'ftp://example.org/journal.rss' }]),
    /HTTP\(S\) RSS URL/
  );
});

test('feed URL and name helpers support the add-journal workflow', () => {
  assert.equal(isSupportedFeedUrl('https://example.org/feed.xml'), true);
  assert.equal(isSupportedFeedUrl('chemrxiv://physical-chemistry'), true);
  assert.equal(isSupportedFeedUrl('ftp://example.org/feed.xml'), false);
  assert.equal(slugifyFeedName('Nature Materials'), 'nature-materials');
  assert.equal(slugifyFeedName('  ACS & Nano  '), 'acs-nano');
  assert.equal(slugifyFeedName('---'), null);
});
