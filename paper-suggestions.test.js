'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFeatureVector,
  createSuggestionEventRecord,
  createSuggestionState,
  extractAbstractFromHtml,
  FEATURE_SCHEMA_VERSION,
  getEventConfig,
  HIDDEN_SIZE,
  INPUT_SIZE,
  MODEL_VERSION,
  normalizeSuggestionState,
  predictInterestScore,
  predictProfileScore,
  predictScore,
  rankArticles,
  replaySuggestionEventRecords,
  serializeSuggestionEventRecords,
  trainOnArticle
} = require('./paper-suggestions');

const article = {
  id: 'article-1',
  title: 'Cooperative neural potentials for aqueous interfaces',
  author: 'A. Researcher, B. Scientist',
  content: 'We develop a transferable model for molecular simulation and free-energy prediction.',
  feedName: 'Journal of Computational Chemistry',
  feedId: 'jcc',
  pubDate: '2026-07-24T08:00:00.000Z'
};

test('explicit read/dismiss actions are negative model events while passive state is neutral', () => {
  const readConfig = getEventConfig('read');
  assert.ok(readConfig);
  assert.ok(readConfig.label < 0.35);
  assert.ok(readConfig.profileSignal < 0);
  assert.equal(getEventConfig('unread'), null);
  assert.equal(getEventConfig('impression'), null);
  assert.equal(getEventConfig('like'), null);
  assert.equal(getEventConfig('not-for-me'), null);
  assert.ok(getEventConfig('abstract'));
});

test('suggestion event records preserve replayable paper metadata without mutable UI state', () => {
  const record = createSuggestionEventRecord(
    {
      articleId: article.id,
      type: 'open',
      eventId: 'session-1:1',
      occurredAt: '2026-08-03T15:00:00.000Z'
    },
    { ...article, read: true, starred: true },
    {
      fullAbstract: 'A fuller publisher abstract for replay.',
      recordedAt: '2026-08-03T15:00:01.000Z'
    }
  );

  assert.equal(record.schemaVersion, 1);
  assert.equal(record.eventId, 'session-1:1');
  assert.equal(record.type, 'open');
  assert.equal(record.trainingEligible, true);
  assert.equal(record.articleSnapshot.title, article.title);
  assert.equal(record.articleSnapshot.fullAbstract, 'A fuller publisher abstract for replay.');
  assert.equal('read' in record.articleSnapshot, false);
  assert.equal('starred' in record.articleSnapshot, false);

  const lines = serializeSuggestionEventRecords([record]).trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), record);

  const readRecord = createSuggestionEventRecord(
    { articleId: article.id, type: 'read', eventId: 'session-1:2' },
    article,
    { metadata: { read: true, source: 'article' } }
  );
  assert.equal(readRecord.trainingEligible, true);
  assert.deepEqual(readRecord.metadata, { read: true, source: 'article' });

  const automaticReadRecord = createSuggestionEventRecord(
    { articleId: article.id, type: 'read', eventId: 'session-1:3' },
    article,
    {
      metadata: { read: true, source: 'publisher' },
      trainingEligible: false
    }
  );
  assert.equal(automaticReadRecord.trainingEligible, false);
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
  assert.equal(base.length, INPUT_SIZE);
});

test('the richer encoder includes source, category, feed identity, and structural metadata', () => {
  const journalVector = buildFeatureVector({
    ...article,
    category: 'Comp Chem',
    source: 'rss',
    doi: '10.1002/example'
  });
  const preprintVector = buildFeatureVector({
    ...article,
    category: 'Chem',
    source: 'arxiv',
    feedId: 'arxiv-chem-ph',
    doi: null,
    author: 'A. Researcher'
  });

  assert.notDeepEqual(journalVector, preprintVector);
  assert.equal(journalVector.length, 512);
  assert.ok(journalVector.some(value => value !== 0));
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

test('the ranker learns a negative signal from an explicit read/dismiss action', () => {
  const state = createSuggestionState({ now: '2026-07-24T00:00:00.000Z' });
  const before = predictScore(state, article);
  for (let i = 0; i < 8; i++) {
    trainOnArticle(state, article, 'read', { now: '2026-07-24T00:00:00.000Z' });
  }
  const after = predictScore(state, article);

  assert.ok(after < before, `expected ${after} to be below ${before}`);
  assert.equal(state.stats.trainingExamples, 8);
  assert.equal(state.stats.positiveExamples, 0);
  assert.equal(state.stats.negativeExamples, 8);
  assert.ok(state.profile.negativeWeight > 0);
});

test('negative paper text generalizes to similar articles without affecting unrelated text equally', () => {
  const state = createSuggestionState();
  const similar = {
    ...article,
    id: 'article-2',
    title: 'Cooperative neural potentials for liquid interfaces',
    content: 'A transferable model for molecular simulation and free-energy prediction.'
  };
  const unrelated = {
    ...article,
    id: 'article-3',
    title: 'A new catalyst for carbon dioxide conversion',
    author: 'C. Chemist',
    content: 'We report a catalytic reaction mechanism for selective organic synthesis.',
    feedName: 'Organic Letters',
    feedId: 'ol'
  };

  for (let i = 0; i < 6; i++) trainOnArticle(state, article, 'read');

  assert.ok(predictProfileScore(state, similar) < predictProfileScore(state, unrelated));
  assert.ok(predictInterestScore(state, similar) < predictInterestScore(state, unrelated));
});

test('all active article interactions train the model without explicit feedback controls', () => {
  const state = createSuggestionState();
  ['open', 'external', 'star', 'abstract', 'unstar'].forEach(type => trainOnArticle(state, article, type));

  assert.equal(state.stats.trainingExamples, 5);
  assert.equal(state.stats.positiveExamples, 4);
  assert.equal(state.stats.negativeExamples, 1);
});

test('bulk read-all feedback stays negative but has less influence than an individual dismissal', () => {
  const manualState = createSuggestionState();
  const bulkState = createSuggestionState();
  const manual = trainOnArticle(manualState, article, 'read', {
    metadata: { source: 'manual' }
  });
  const bulk = trainOnArticle(bulkState, article, 'read', {
    metadata: { source: 'read-all', batchSize: 100 }
  });

  assert.ok(bulk.after < bulk.before);
  assert.ok(bulk.trainingScale < manual.trainingScale);
  assert.equal(bulkState.stats.featureNegativeExamples, 1);
});

test('the interest profile generalizes active clicks to similar article text', () => {
  const state = createSuggestionState();
  const similar = {
    ...article,
    id: 'article-2',
    title: 'Cooperative neural potentials for liquid interfaces',
    content: 'A transferable model for molecular simulation and free-energy prediction.',
    pubDate: '2026-07-24T07:00:00.000Z'
  };
  const unrelated = {
    ...article,
    id: 'article-3',
    title: 'A new catalyst for carbon dioxide conversion',
    author: 'C. Chemist',
    content: 'We report a catalytic reaction mechanism for selective organic synthesis.',
    feedName: 'Organic Letters',
    feedId: 'ol'
  };

  for (let i = 0; i < 6; i++) trainOnArticle(state, article, 'open');

  assert.ok(state.profile.positiveWeight > 0);
  assert.ok(predictProfileScore(state, similar) > predictProfileScore(state, unrelated));
  assert.ok(predictInterestScore(state, similar) > predictInterestScore(state, unrelated));
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
  assert.equal(normalized.version, MODEL_VERSION);
  assert.equal(normalized.featureSchemaVersion, FEATURE_SCHEMA_VERSION);
  assert.equal(normalized.stats.trainingExamples, 3);
  assert.equal(normalized.model.inputSize, INPUT_SIZE);
  assert.equal(normalized.model.hiddenSize, HIDDEN_SIZE);
  assert.equal(normalized.profile.positiveCentroid.length, INPUT_SIZE);
});

test('version 3 state keeps a legacy ranker and replays eligible records into version 4 features', () => {
  const legacyModel = {
    inputSize: 256,
    hiddenSize: 12,
    weights1: Array.from({ length: 12 }, () => Array.from({ length: 256 }, () => 0)),
    bias1: Array.from({ length: 12 }, () => 0),
    weights2: Array.from({ length: 12 }, () => 0),
    bias2: 0
  };
  const legacyProfile = {
    positiveCentroid: Array.from({ length: 256 }, () => 0),
    negativeCentroid: Array.from({ length: 256 }, () => 0),
    positiveWeight: 2,
    negativeWeight: 3
  };
  const migrated = normalizeSuggestionState({
    version: 3,
    model: legacyModel,
    profile: legacyProfile,
    stats: {
      eventsProcessed: 12,
      trainingExamples: 12,
      positiveExamples: 5,
      negativeExamples: 7
    }
  });
  const eligible = createSuggestionEventRecord(
    { ...article, articleId: article.id, type: 'open', eventId: 'replay:1' },
    { ...article, category: 'Comp Chem', source: 'rss' }
  );
  const neutral = createSuggestionEventRecord(
    { ...article, articleId: article.id, type: 'read', eventId: 'replay:2' },
    article,
    { trainingEligible: false }
  );
  const result = replaySuggestionEventRecords(migrated, [eligible, eligible, neutral], {
    now: '2026-08-14T17:00:00.000Z'
  });

  assert.equal(result.applied, 1);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.migration.required, false);
  assert.equal(migrated.stats.trainingExamples, 12);
  assert.equal(migrated.stats.featureTrainingExamples, 1);
  assert.equal(migrated.model.inputSize, 512);
  assert.equal(migrated.legacyRanker.model.inputSize, 256);
});
