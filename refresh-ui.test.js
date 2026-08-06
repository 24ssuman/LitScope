'use strict';

const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('./public/app.js', 'utf8');
const apiRefreshStart = appSource.indexOf('async triggerRefresh()');
const refreshHandlerStart = appSource.indexOf('// Refresh feed trigger');
const refreshHandler = appSource.slice(refreshHandlerStart, refreshHandlerStart + 650);

test('the browser refresh API sends an unscoped request', () => {
  assert.notEqual(apiRefreshStart, -1);
  const apiRefreshSource = appSource.slice(apiRefreshStart, apiRefreshStart + 420);
  assert.match(apiRefreshSource, /body: JSON\.stringify\(\{\}\)/);
  assert.doesNotMatch(apiRefreshSource, /feedId/);
});

test('the refresh button does not derive its scope from the active tab', () => {
  assert.notEqual(refreshHandlerStart, -1);
  assert.match(refreshHandler, /API\.triggerRefresh\(\)/);
  assert.doesNotMatch(refreshHandler, /state\.activeFeedId|feedParam|feedId/);
});
