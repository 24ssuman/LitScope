'use strict';

const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_SUGGESTION_PAGES,
  SUGGESTION_PAGE_SIZE,
  getSuggestionPagination
} = require('./suggestion-pagination');

const appSource = fs.readFileSync('./public/app.js', 'utf8');
const serverSource = fs.readFileSync('./server.js', 'utf8');

test('suggestion pagination exposes three 20-paper pages for a full queue', () => {
  const pageOne = getSuggestionPagination(100, 1, SUGGESTION_PAGE_SIZE);
  const pageTwo = getSuggestionPagination(100, 2, SUGGESTION_PAGE_SIZE);
  const pageThree = getSuggestionPagination(100, 3, SUGGESTION_PAGE_SIZE);

  assert.equal(pageOne.pageCount, MAX_SUGGESTION_PAGES);
  assert.equal(pageOne.pageSize, 20);
  assert.equal(pageOne.offset, 0);
  assert.equal(pageTwo.offset, 20);
  assert.equal(pageThree.offset, 40);
  assert.equal(pageThree.visibleTotal, 60);
  assert.equal(pageThree.hasMore, true);
});

test('suggestion pagination clamps page size to the requested 10-20 paper range', () => {
  assert.equal(getSuggestionPagination(45, 1, 5).pageSize, 10);
  assert.equal(getSuggestionPagination(45, 1, 50).pageSize, 20);
  assert.equal(getSuggestionPagination(45, 99, 20).page, 3);
  assert.equal(getSuggestionPagination(25, 3, 20).page, 2);
});

test('the Suggested client requests page metadata and renders numbered controls', () => {
  assert.match(appSource, /API\.getSuggestions\(\{\s*page: state\.suggestionPage,\s*limit: state\.suggestionPageSize\s*\}\)/);
  assert.match(appSource, /state\.suggestionPageCount = Number\(res\.pageCount\)/);
  assert.match(appSource, /aria-label', 'Suggested paper pages'/);
  assert.match(appSource, /selectSuggestionPage\(page\)/);
});

test('the paginated API ranks once for the visible window and returns page metadata', () => {
  assert.match(serverSource, /getSuggestionPagination\(/);
  assert.match(serverSource, /rankArticles\(candidates, suggestionState, \{ limit: pagination\.visibleTotal \}\)/);
  assert.match(serverSource, /pageCount: pagination\.pageCount/);
  assert.match(serverSource, /visibleTotal: pagination\.visibleTotal/);
});

test('each Suggested page has a page-scoped Mark as read action', () => {
  assert.match(appSource, /async markArticlesRead\(articleIds\)/);
  assert.match(appSource, /body: JSON\.stringify\(\{ articleIds \}\)/);
  assert.match(appSource, /appendSuggestionReadAction\(\)/);
  assert.match(appSource, /triggerMarkSuggestedPageRead\(button\)/);
  assert.match(serverSource, /const requestedArticleIds = Array\.isArray\(req\.body\?\.articleIds\)/);
  assert.match(serverSource, /requestedArticleIds\.has\(article\.id\)/);
});
