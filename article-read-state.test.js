'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveArticleReadState } = require('./article-read-state');

test('keeps a saved article read state', () => {
  assert.equal(resolveArticleReadState({ read: true }, false), true);
  assert.equal(resolveArticleReadState({ read: false }, true), false);
});

test('leaves a first-seen article unread unless it is in read history', () => {
  assert.equal(resolveArticleReadState(null, false), false);
  assert.equal(resolveArticleReadState(null, true), true);
});
