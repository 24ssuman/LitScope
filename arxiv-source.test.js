'use strict';

const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const serverSource = fs.readFileSync('./server.js', 'utf8');
const arxivBranchStart = serverSource.indexOf("if (source === 'arxiv')");
const arxivBranchEnd = serverSource.indexOf('\n  let crossrefError', arxivBranchStart);
const arxivBranch = serverSource.slice(arxivBranchStart, arxivBranchEnd);

test('arXiv refresh uses its own source branch rather than ChemRxiv fallback', () => {
  assert.notEqual(arxivBranchStart, -1);
  assert.match(arxivBranch, /fetchArxiv\(feed\)/);
  assert.match(arxivBranch, /arXiv API request failed/);
  assert.doesNotMatch(arxivBranch, /fetchChemRxiv|Crossref/);
});

test('arXiv DOI-shaped IDs resolve to abstract pages case-insensitively', () => {
  assert.match(serverSource, /if \(\/\^arxiv:\/i\.test\(cleanedDoi\)\)/);
  assert.match(serverSource, /cleanedDoi\.replace\(\/\^arxiv:\/i/);
});
