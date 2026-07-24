'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFeatureVector,
  createSuggestionState,
  extractAbstractFromHtml,
  getEventConfig,
  normalizeSuggestionState,
  predictScore,
  rankArticles,
  trainOnArticle
} = require('./paper-suggestions');

const article = {
  id: 'article-1',
  title: 'Cooperative neural potentials for aqueous interfaces',
  author: 'A. Researcher, B. Scientist',
  content: 'We develop a transferable model for molecular simulation and free-energy prediction.',
  pubDate: '2026-07-24T08:00:00.000Z'
};

test('passive read/seen state is not a model event', () => {
  assert.equal(getEventConfig('read'), null);
  assert.equal(getEventConfig('impression'), null);
});

test('title, authors, and abstract all contribute to hashed features', () => {
  const base = buildFeatureVector(article);
  const changed = buildFeatureVector({
    ...article,
    title: 'A different title',
    author: 'A different author',
    content: 'A different abstract with another mechanism.'
  });
  assert.notDeepEqual(base, changed);
  assert.equal(base.length, 256);
});

test('the cold-start neural ranker learns an active positive signal', () => {
  const state = createSuggestionState({ now: '2026-07-24T00:00:00.000Z' });
  const before = predictScore(state, article);
  for (let i = 0; i < 8; i++) {
    trainOnArticle(state, article, 'open', { now: '2026-07-24T00:00:00.000Z' });
  }
  const after = predictScore(state, article);

  assert.ok(after > before, `expected ${after} to exceed ${before}`);
  assert.equal(state.stats.trainingExamples, 8);
  assert.equal(state.stats.positiveExamples, 8);
});

test('explicit negative feedback lowers the article score', () => {
  const state = createSuggestionState();
  const before = predictScore(state, article);
  for (let i = 0; i < 8; i++) trainOnArticle(state, article, 'not-for-me');
  const after = predictScore(state, article);

  assert.ok(after < before, `expected ${after} to be below ${before}`);
  assert.equal(state.stats.negativeExamples, 8);
});

test('suggestion ranking includes score and fuller abstract data', () => {
  const state = createSuggestionState();
  state.fullAbstracts[article.id] = { text: 'The fuller publisher abstract.' };
  const ranked = rankArticles([article], state, { limit: 10 });

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].fullAbstract, 'The fuller publisher abstract.');
  assert.equal(typeof ranked[0].suggestionScore, 'number');
});

test('publisher HTML extraction prefers a citation abstract', () => {
  const html = `
    <html><head>
      <meta name="description" content="Short page description">
      <meta name="citation_abstract" content="This is the full publisher abstract describing the method, benchmark, and results in enough detail to be useful to the reader.">
    </head><body><div id="abstract">A shorter duplicate.</div></body></html>
  `;
  assert.match(extractAbstractFromHtml(html), /full publisher abstract/);
});

test('malformed persisted state is normalized without losing the model contract', () => {
  const normalized = normalizeSuggestionState({
    version: 99,
    stats: { trainingExamples: 3 },
    model: { inputSize: 1 }
  });
  assert.equal(normalized.version, 1);
  assert.equal(normalized.stats.trainingExamples, 3);
  assert.equal(normalized.model.inputSize, 256);
  assert.equal(normalized.model.hiddenSize, 12);
});
