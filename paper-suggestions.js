'use strict';

// A small, dependency-free online neural ranker. The model intentionally lives
// outside db.json so personal article/read/star state remains compatible with
// existing LitScope installations.
const MODEL_VERSION = 4;
const FEATURE_SCHEMA_VERSION = 2;
const SUGGESTION_EVENT_SCHEMA_VERSION = 1;
const INPUT_SIZE = 512;
const HIDDEN_SIZE = 16;
const LEGACY_INPUT_SIZE = 256;
const LEGACY_HIDDEN_SIZE = 12;
const DEFAULT_SEED = 0x51f15e77;
const MAX_WEIGHT = 4;
const PROFILE_MAX_WEIGHT = 1000;
const MAX_ABSTRACT_TOKENS = 320;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
  'has', 'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our',
  'that', 'the', 'their', 'these', 'this', 'to', 'using', 'was', 'we', 'were',
  'which', 'with'
]);

const EVENT_TYPES = Object.freeze({
  open: { label: 0.72, weight: 1, profileSignal: 1 },
  external: { label: 0.9, weight: 1.35, profileSignal: 1.25 },
  star: { label: 1, weight: 1.8, profileSignal: 1.8 },
  abstract: { label: 0.78, weight: 0.65, profileSignal: 0.65 },
  unstar: { label: 0.35, weight: 0.45, profileSignal: -0.6 },
  // An explicit read/dismiss action means the user did not want to spend more
  // attention on the paper. Automatic state updates from opening the drawer or
  // visiting the publisher are recorded separately and do not use this signal.
  read: { label: 0.08, weight: 1.15, profileSignal: -1.35 }
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function seededRandom(seed = DEFAULT_SEED) {
  let value = (Number(seed) >>> 0) || DEFAULT_SEED;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createModel({ inputSize = INPUT_SIZE, hiddenSize = HIDDEN_SIZE, seed = DEFAULT_SEED } = {}) {
  const random = seededRandom(seed);
  const weights1 = Array.from({ length: hiddenSize }, () => (
    Array.from({ length: inputSize }, () => (random() - 0.5) * 0.08)
  ));
  const bias1 = Array.from({ length: hiddenSize }, () => 0);
  const weights2 = Array.from({ length: hiddenSize }, () => (random() - 0.5) * 0.08);

  return {
    inputSize,
    hiddenSize,
    weights1,
    bias1,
    weights2,
    bias2: 0
  };
}

function createProfile() {
  return {
    positiveCentroid: Array.from({ length: INPUT_SIZE }, () => 0),
    negativeCentroid: Array.from({ length: INPUT_SIZE }, () => 0),
    positiveWeight: 0,
    negativeWeight: 0,
    lastUpdatedAt: null
  };
}

function createSuggestionState({ now = new Date().toISOString(), seed = DEFAULT_SEED } = {}) {
  return {
    version: MODEL_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: null,
    model: createModel({ seed }),
    stats: {
      eventsProcessed: 0,
      trainingExamples: 0,
      positiveExamples: 0,
      negativeExamples: 0,
      featureTrainingExamples: 0,
      featurePositiveExamples: 0,
      featureNegativeExamples: 0
    },
    recentEventIds: [],
    profile: createProfile(),
    fullAbstracts: {},
    legacyRanker: null,
    migration: null
  };
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeModel(
  candidate,
  { inputSize = INPUT_SIZE, hiddenSize = HIDDEN_SIZE, seed = DEFAULT_SEED } = {}
) {
  if (!candidate || Number(candidate.inputSize) !== inputSize || Number(candidate.hiddenSize) !== hiddenSize) {
    return createModel({ inputSize, hiddenSize, seed });
  }

  const validMatrix = Array.isArray(candidate.weights1)
    && candidate.weights1.length === hiddenSize
    && candidate.weights1.every(row => Array.isArray(row) && row.length === inputSize);
  const validBiases = Array.isArray(candidate.bias1) && candidate.bias1.length === hiddenSize;
  const validOutput = Array.isArray(candidate.weights2) && candidate.weights2.length === hiddenSize;
  if (!validMatrix || !validBiases || !validOutput || !isFiniteNumber(candidate.bias2)) {
    return createModel({ inputSize, hiddenSize, seed });
  }

  return {
    inputSize,
    hiddenSize,
    weights1: candidate.weights1.map(row => row.map(value => clamp(Number(value) || 0, -MAX_WEIGHT, MAX_WEIGHT))),
    bias1: candidate.bias1.map(value => clamp(Number(value) || 0, -MAX_WEIGHT, MAX_WEIGHT)),
    weights2: candidate.weights2.map(value => clamp(Number(value) || 0, -MAX_WEIGHT, MAX_WEIGHT)),
    bias2: clamp(Number(candidate.bias2) || 0, -MAX_WEIGHT, MAX_WEIGHT)
  };
}

function normalizeProfile(candidate, inputSize = INPUT_SIZE) {
  const fallback = {
    ...createProfile(),
    positiveCentroid: Array.from({ length: inputSize }, () => 0),
    negativeCentroid: Array.from({ length: inputSize }, () => 0)
  };
  if (!candidate || typeof candidate !== 'object') return fallback;

  const normalizeVector = value => {
    if (!Array.isArray(value) || value.length !== inputSize) return null;
    return value.map(item => clamp(Number(item) || 0, -1, 1));
  };
  const positiveCentroid = normalizeVector(candidate.positiveCentroid);
  const negativeCentroid = normalizeVector(candidate.negativeCentroid);

  return {
    positiveCentroid: positiveCentroid || fallback.positiveCentroid,
    negativeCentroid: negativeCentroid || fallback.negativeCentroid,
    positiveWeight: clamp(Number(candidate.positiveWeight) || 0, 0, PROFILE_MAX_WEIGHT),
    negativeWeight: clamp(Number(candidate.negativeWeight) || 0, 0, PROFILE_MAX_WEIGHT),
    lastUpdatedAt: typeof candidate.lastUpdatedAt === 'string' ? candidate.lastUpdatedAt : null
  };
}

function normalizeSuggestionState(candidate) {
  const fallback = createSuggestionState();
  if (!candidate || typeof candidate !== 'object') return fallback;

  const stats = candidate.stats && typeof candidate.stats === 'object' ? candidate.stats : {};
  const normalizeMap = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const recentEventIds = Array.isArray(candidate.recentEventIds)
    ? candidate.recentEventIds.filter(id => typeof id === 'string').slice(-1000)
    : [];

  const normalizedStats = {
    eventsProcessed: Math.max(0, Number(stats.eventsProcessed) || 0),
    trainingExamples: Math.max(0, Number(stats.trainingExamples) || 0),
    positiveExamples: Math.max(0, Number(stats.positiveExamples) || 0),
    negativeExamples: Math.max(0, Number(stats.negativeExamples) || 0),
    featureTrainingExamples: Math.max(0, Number(stats.featureTrainingExamples) || 0),
    featurePositiveExamples: Math.max(0, Number(stats.featurePositiveExamples) || 0),
    featureNegativeExamples: Math.max(0, Number(stats.featureNegativeExamples) || 0)
  };
  const isCurrent = Number(candidate.version) === MODEL_VERSION
    && Number(candidate.featureSchemaVersion) === FEATURE_SCHEMA_VERSION;

  if (!isCurrent) {
    const hasLegacyModel = Number(candidate?.model?.inputSize) === LEGACY_INPUT_SIZE
      && Number(candidate?.model?.hiddenSize) === LEGACY_HIDDEN_SIZE;
    return {
      ...fallback,
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : fallback.createdAt,
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
      stats: normalizedStats,
      recentEventIds,
      fullAbstracts: normalizeMap(candidate.fullAbstracts),
      legacyRanker: hasLegacyModel ? {
        version: Number(candidate.version) || 3,
        model: normalizeModel(candidate.model, {
          inputSize: LEGACY_INPUT_SIZE,
          hiddenSize: LEGACY_HIDDEN_SIZE
        }),
        profile: normalizeProfile(candidate.profile, LEGACY_INPUT_SIZE),
        trainingExamples: normalizedStats.trainingExamples
      } : null,
      migration: {
        required: true,
        fromVersion: Number(candidate.version) || null,
        requestedAt: new Date().toISOString()
      }
    };
  }

  const legacyCandidate = candidate.legacyRanker;
  const legacyRanker = legacyCandidate && typeof legacyCandidate === 'object'
    ? {
      version: Number(legacyCandidate.version) || 3,
      model: normalizeModel(legacyCandidate.model, {
        inputSize: LEGACY_INPUT_SIZE,
        hiddenSize: LEGACY_HIDDEN_SIZE
      }),
      profile: normalizeProfile(legacyCandidate.profile, LEGACY_INPUT_SIZE),
      trainingExamples: Math.max(0, Number(legacyCandidate.trainingExamples) || 0)
    }
    : null;

  return {
    version: MODEL_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : fallback.createdAt,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
    model: normalizeModel(candidate.model),
    stats: normalizedStats,
    recentEventIds,
    profile: normalizeProfile(candidate.profile),
    fullAbstracts: normalizeMap(candidate.fullAbstracts),
    legacyRanker,
    migration: candidate.migration && typeof candidate.migration === 'object'
      ? { ...candidate.migration, required: Boolean(candidate.migration.required) }
      : null
  };
}

function normalizeSnapshotValue(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
  return String(value);
}

function createSuggestionArticleSnapshot(article, fullAbstract = null) {
  if (!article || typeof article !== 'object') return null;

  return {
    id: normalizeSnapshotValue(article.id),
    feedId: normalizeSnapshotValue(article.feedId),
    feedName: normalizeSnapshotValue(article.feedName || article.journal),
    category: normalizeSnapshotValue(article.category),
    source: normalizeSnapshotValue(article.source),
    title: normalizeSnapshotValue(article.title),
    author: normalizeSnapshotValue(article.author || article.authors),
    content: normalizeSnapshotValue(article.content),
    fullAbstract: normalizeSnapshotValue(fullAbstract || article.fullAbstract),
    doi: normalizeSnapshotValue(article.doi),
    link: normalizeSnapshotValue(article.link),
    guid: normalizeSnapshotValue(article.guid),
    pubDate: normalizeSnapshotValue(article.pubDate),
    fetchedAt: normalizeSnapshotValue(article.fetchedAt)
  };
}

function createSuggestionEventRecord(
  event,
  article = null,
  {
    fullAbstract = null,
    metadata = null,
    recordedAt = new Date().toISOString(),
    trainingEligible = null
  } = {}
) {
  const occurredAt = String(event?.occurredAt || recordedAt).slice(0, 40);
  const type = getEventType(event?.type);
  const eventConfig = getEventConfig(type);
  return {
    schemaVersion: SUGGESTION_EVENT_SCHEMA_VERSION,
    eventId: String(event?.eventId || '').slice(0, 160) || null,
    articleId: String(event?.articleId || article?.id || '').trim() || null,
    type,
    trainingEligible: trainingEligible === null
      ? Boolean(eventConfig)
      : Boolean(trainingEligible),
    occurredAt,
    recordedAt,
    metadata: metadata && typeof metadata === 'object' ? metadata : null,
    articleSnapshot: createSuggestionArticleSnapshot(article, fullAbstract)
  };
}

function serializeSuggestionEventRecords(records = []) {
  const lines = records
    .filter(record => record && typeof record === 'object')
    .map(record => JSON.stringify(record));
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function addHashedFeature(vector, key, weight) {
  const hash = hashString(key);
  const index = hash % vector.length;
  const sign = (hash & 1) === 0 ? 1 : -1;
  vector[index] += sign * weight;
}

function addLegacyFieldFeatures(vector, field, value, fieldWeight) {
  const tokens = tokenize(value).filter(token => token.length > 1);
  tokens.forEach((token, index) => {
    addHashedFeature(vector, `${field}:${token}`, fieldWeight);
    if (index > 0) {
      addHashedFeature(vector, `${field}:${tokens[index - 1]}_${token}`, fieldWeight * 0.45);
    }
  });
}

function getMeaningfulTokens(value, maxTokens = MAX_ABSTRACT_TOKENS) {
  return tokenize(value)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token))
    .slice(0, maxTokens);
}

function addTokenFeatures(
  vector,
  field,
  tokens,
  { unigramWeight = 1, bigramWeight = 0.4, subwordWeight = 0, maxSubwords = 80 } = {}
) {
  const counts = new Map();
  tokens.forEach(token => counts.set(token, (counts.get(token) || 0) + 1));
  counts.forEach((count, token) => {
    addHashedFeature(vector, `${field}:word:${token}`, unigramWeight * (1 + Math.log(count)));
  });

  for (let index = 1; index < tokens.length; index++) {
    addHashedFeature(vector, `${field}:pair:${tokens[index - 1]}_${tokens[index]}`, bigramWeight);
  }

  if (subwordWeight > 0) {
    let added = 0;
    for (const token of counts.keys()) {
      if (token.length < 5 || added >= maxSubwords) continue;
      const bounded = `^${token.slice(0, 24)}$`;
      for (let index = 0; index <= bounded.length - 3 && added < maxSubwords; index++) {
        addHashedFeature(vector, `${field}:char3:${bounded.slice(index, index + 3)}`, subwordWeight);
        added++;
      }
    }
  }
}

function getAuthorNames(value) {
  return String(value || '')
    .split(/\s*(?:,|;|\band\b|&)\s*/i)
    .map(name => getMeaningfulTokens(name, 8))
    .filter(tokens => tokens.length > 0);
}

function inferArticleSource(article) {
  const explicit = String(article?.source || '').trim().toLowerCase();
  if (explicit) return explicit;
  const feedId = String(article?.feedId || '').toLowerCase();
  const link = String(article?.link || article?.guid || '').toLowerCase();
  if (feedId.includes('arxiv') || link.includes('arxiv.org')) return 'arxiv';
  if (feedId.includes('chemrxiv') || link.includes('chemrxiv.org')) return 'chemrxiv';
  return 'journal';
}

function addMetadataFeatures(vector, article, titleTokens, abstractTokens, authorNames) {
  const category = String(article?.category || '').trim().toLowerCase();
  const source = inferArticleSource(article);
  const feedId = String(article?.feedId || '').trim().toLowerCase();
  const feedName = String(article?.feedName || article?.journal || '').trim().toLowerCase();
  if (category) addHashedFeature(vector, `meta:category:${category}`, 0.9);
  if (source) addHashedFeature(vector, `meta:source:${source}`, 0.75);
  if (feedId) addHashedFeature(vector, `meta:feed:${feedId}`, 0.75);
  if (feedName) addHashedFeature(vector, `meta:journal:${feedName}`, 0.6);

  const doiPrefix = String(article?.doi || '').trim().toLowerCase().match(/^10\.\d{4,9}/)?.[0];
  if (doiPrefix) addHashedFeature(vector, `meta:doi-prefix:${doiPrefix}`, 0.35);

  const titleLengthBucket = Math.min(5, Math.floor(titleTokens.length / 4));
  const abstractLengthBucket = Math.min(7, Math.floor(abstractTokens.length / 40));
  const authorCountBucket = Math.min(5, authorNames.length);
  addHashedFeature(vector, `meta:title-length:${titleLengthBucket}`, 0.3);
  addHashedFeature(vector, `meta:abstract-length:${abstractLengthBucket}`, 0.35);
  addHashedFeature(vector, `meta:author-count:${authorCountBucket}`, 0.3);
  addHashedFeature(vector, `meta:has-doi:${doiPrefix ? 'yes' : 'no'}`, 0.2);

  const titleSet = new Set(titleTokens);
  const abstractSet = new Set(abstractTokens);
  let overlap = 0;
  titleSet.forEach(token => {
    if (abstractSet.has(token)) overlap++;
  });
  const overlapRatio = titleSet.size > 0 ? overlap / titleSet.size : 0;
  addHashedFeature(vector, `meta:title-abstract-overlap:${Math.min(4, Math.floor(overlapRatio * 5))}`, 0.4);
}

function getFullAbstractText(article, fullAbstract) {
  if (typeof fullAbstract === 'string' && fullAbstract.trim()) return fullAbstract;
  if (typeof article?.fullAbstract === 'string' && article.fullAbstract.trim()) return article.fullAbstract;
  return article?.content || '';
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] /= magnitude;
  }
  return vector;
}

function buildLegacyFeatureVector(article, fullAbstract = null) {
  const vector = Array.from({ length: LEGACY_INPUT_SIZE }, () => 0);
  addLegacyFieldFeatures(vector, 'title', article?.title, 2.1);
  addLegacyFieldFeatures(vector, 'author', article?.author || article?.authors, 1.25);
  addLegacyFieldFeatures(vector, 'abstract', stripMarkup(getFullAbstractText(article, fullAbstract)), 1);
  addLegacyFieldFeatures(vector, 'journal', article?.feedName || article?.journal, 0.65);
  return normalizeVector(vector);
}

function buildFeatureVector(article, fullAbstract = null) {
  const vector = Array.from({ length: INPUT_SIZE }, () => 0);
  const titleTokens = getMeaningfulTokens(article?.title, 80);
  const abstractTokens = getMeaningfulTokens(
    stripMarkup(getFullAbstractText(article, fullAbstract)),
    MAX_ABSTRACT_TOKENS
  );
  const authorNames = getAuthorNames(article?.author || article?.authors);

  addTokenFeatures(vector, 'title', titleTokens, {
    unigramWeight: 2.4,
    bigramWeight: 1.05,
    subwordWeight: 0.22,
    maxSubwords: 100
  });
  addTokenFeatures(vector, 'abstract', abstractTokens, {
    unigramWeight: 0.95,
    bigramWeight: 0.32,
    subwordWeight: 0.08,
    maxSubwords: 120
  });

  authorNames.forEach(tokens => {
    const canonicalName = tokens.join('_');
    addHashedFeature(vector, `author:person:${canonicalName}`, 1.65);
    addHashedFeature(vector, `author:surname:${tokens[tokens.length - 1]}`, 1.3);
    tokens.forEach(token => addHashedFeature(vector, `author:token:${token}`, 0.55));
  });

  addMetadataFeatures(vector, article, titleTokens, abstractTokens, authorNames);
  return normalizeVector(vector);
}

function sigmoid(value) {
  const bounded = clamp(value, -30, 30);
  return 1 / (1 + Math.exp(-bounded));
}

function forward(model, vector) {
  const hiddenPre = Array.from({ length: model.hiddenSize }, () => 0);
  const hidden = Array.from({ length: model.hiddenSize }, () => 0);

  for (let j = 0; j < model.hiddenSize; j++) {
    let value = model.bias1[j];
    for (let i = 0; i < model.inputSize; i++) value += model.weights1[j][i] * vector[i];
    hiddenPre[j] = value;
    hidden[j] = Math.tanh(value);
  }

  let output = model.bias2;
  for (let j = 0; j < model.hiddenSize; j++) output += model.weights2[j] * hidden[j];
  return { hiddenPre, hidden, score: sigmoid(output) };
}

function getEventType(type) {
  return String(type || '').trim().toLowerCase().replace(/-/g, '_');
}

function getEventConfig(type) {
  return EVENT_TYPES[getEventType(type)] || null;
}

function predictScore(stateOrModel, article, fullAbstract = null) {
  const model = stateOrModel?.model || stateOrModel;
  if (!model || !article) return 0.5;
  const vector = buildFeatureVector(article, fullAbstract);
  return forward(model, vector).score;
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftMagnitude += left[i] * left[i];
    rightMagnitude += right[i] * right[i];
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function predictProfileScoreFromVector(profile, vector) {
  if (!profile || (!profile.positiveWeight && !profile.negativeWeight)) return 0.5;

  const positiveSimilarity = Math.max(0, cosineSimilarity(vector, profile.positiveCentroid));
  const negativeSimilarity = Math.max(0, cosineSimilarity(vector, profile.negativeCentroid));
  const confidence = Math.min(1, (profile.positiveWeight + profile.negativeWeight) / 10);
  const balance = positiveSimilarity - negativeSimilarity * 0.65;
  return clamp(0.5 + balance * (0.35 + confidence * 0.15), 0, 1);
}

function predictProfileScore(state, article, fullAbstract = null) {
  return predictProfileScoreFromVector(state?.profile, buildFeatureVector(article, fullAbstract));
}

function combineRankerScores(model, profile, vector) {
  const neuralScore = model ? forward(model, vector).score : 0.5;
  const profileWeight = profile && (profile.positiveWeight || profile.negativeWeight)
    ? Math.min(0.58, 0.28 + ((profile.positiveWeight + profile.negativeWeight) / 20))
    : 0;
  const profileScore = predictProfileScoreFromVector(profile, vector);
  return clamp(neuralScore * (1 - profileWeight) + profileScore * profileWeight, 0, 1);
}

function predictInterestScore(state, article, fullAbstract = null) {
  const currentScore = combineRankerScores(
    state?.model,
    state?.profile,
    buildFeatureVector(article, fullAbstract)
  );
  const legacy = state?.legacyRanker;
  if (!legacy?.model) return currentScore;

  const legacyScore = combineRankerScores(
    legacy.model,
    legacy.profile,
    buildLegacyFeatureVector(article, fullAbstract)
  );
  const featureExamples = Math.max(0, Number(state?.stats?.featureTrainingExamples) || 0);
  const legacyWeight = 0.55 / (1 + featureExamples / 350);
  return clamp(currentScore * (1 - legacyWeight) + legacyScore * legacyWeight, 0, 1);
}

function updateInterestProfile(state, vector, config, now) {
  const signal = Number(config.profileSignal) || 0;
  if (!state.profile || !signal) return;

  const isPositive = signal > 0;
  const centroidKey = isPositive ? 'positiveCentroid' : 'negativeCentroid';
  const weightKey = isPositive ? 'positiveWeight' : 'negativeWeight';
  const profile = state.profile;
  const previousWeight = profile[weightKey];
  const contribution = Math.abs(signal);
  const nextWeight = Math.min(PROFILE_MAX_WEIGHT, previousWeight + contribution);
  const learningRate = contribution / Math.max(nextWeight, contribution);

  for (let i = 0; i < vector.length; i++) {
    profile[centroidKey][i] = clamp(
      profile[centroidKey][i] + (vector[i] - profile[centroidKey][i]) * learningRate,
      -1,
      1
    );
  }
  profile[weightKey] = nextWeight;
  profile.lastUpdatedAt = now;
}

function getTrainingScale(state, config, metadata) {
  const stats = state?.stats || {};
  const isPositive = config.label >= 0.65;
  const isNegative = config.label <= 0.35;
  const positiveCount = Math.max(0, Number(stats.featurePositiveExamples) || 0);
  const negativeCount = Math.max(0, Number(stats.featureNegativeExamples) || 0);
  let classScale = 1;

  if (isPositive) {
    classScale = clamp(Math.sqrt((negativeCount + 8) / (positiveCount + 8)), 0.75, 2.25);
  } else if (isNegative) {
    classScale = clamp(Math.sqrt((positiveCount + 8) / (negativeCount + 8)), 0.6, 1);
  }

  const source = String(metadata?.source || '').toLowerCase();
  let bulkScale = 1;
  if (source === 'read-all') {
    const batchSize = Math.max(1, Number(metadata?.batchSize) || 0);
    bulkScale = batchSize > 1
      ? clamp(1 / Math.sqrt(batchSize), 0.08, 0.35)
      : 0.3;
  }
  return classScale * bulkScale;
}

function trainOnArticle(
  state,
  article,
  type,
  {
    fullAbstract = null,
    metadata = null,
    now = new Date().toISOString(),
    updateAggregateStats = true
  } = {}
) {
  const baseConfig = getEventConfig(type);
  if (!state || !article || !baseConfig) return null;

  const model = state.model;
  const vector = buildFeatureVector(article, fullAbstract);
  const result = forward(model, vector);
  const trainingScale = getTrainingScale(state, baseConfig, metadata);
  const config = {
    ...baseConfig,
    weight: baseConfig.weight * trainingScale,
    profileSignal: baseConfig.profileSignal * trainingScale
  };
  const error = result.score - config.label;
  const learningRate = 0.045 * config.weight;

  for (let j = 0; j < model.hiddenSize; j++) {
    const outputGradient = error * result.hidden[j];
    const hiddenGradient = error * model.weights2[j] * (1 - result.hidden[j] * result.hidden[j]);
    model.weights2[j] = clamp(model.weights2[j] - learningRate * outputGradient, -MAX_WEIGHT, MAX_WEIGHT);
    model.bias1[j] = clamp(model.bias1[j] - learningRate * hiddenGradient, -MAX_WEIGHT, MAX_WEIGHT);
    for (let i = 0; i < model.inputSize; i++) {
      model.weights1[j][i] = clamp(
        model.weights1[j][i] - learningRate * hiddenGradient * vector[i],
        -MAX_WEIGHT,
        MAX_WEIGHT
      );
    }
  }
  model.bias2 = clamp(model.bias2 - learningRate * error, -MAX_WEIGHT, MAX_WEIGHT);
  updateInterestProfile(state, vector, config, now);

  state.stats.featureTrainingExamples = (state.stats.featureTrainingExamples || 0) + 1;
  if (baseConfig.label >= 0.65) {
    state.stats.featurePositiveExamples = (state.stats.featurePositiveExamples || 0) + 1;
  }
  if (baseConfig.label <= 0.35) {
    state.stats.featureNegativeExamples = (state.stats.featureNegativeExamples || 0) + 1;
  }
  if (updateAggregateStats) {
    state.stats.eventsProcessed += 1;
    state.stats.trainingExamples += 1;
    if (baseConfig.label >= 0.65) state.stats.positiveExamples += 1;
    if (baseConfig.label <= 0.35) state.stats.negativeExamples += 1;
  }
  state.updatedAt = now;

  return {
    before: result.score,
    after: predictScore(state, article, fullAbstract),
    trainingScale
  };
}

function replaySuggestionEventRecords(
  state,
  records,
  { enrichArticle = article => article, now = new Date().toISOString() } = {}
) {
  if (!state?.migration?.required) return { applied: 0, skipped: true };

  const previousUpdatedAt = state.updatedAt;
  state.model = createModel();
  state.profile = createProfile();
  state.stats.featureTrainingExamples = 0;
  state.stats.featurePositiveExamples = 0;
  state.stats.featureNegativeExamples = 0;
  const seenEventIds = new Set();
  let applied = 0;

  (Array.isArray(records) ? records : []).forEach(record => {
    if (!record || record.trainingEligible !== true || !record.articleSnapshot) return;
    const eventId = String(record.eventId || '');
    if (eventId && seenEventIds.has(eventId)) return;
    const type = getEventType(record.type);
    if (!getEventConfig(type)) return;

    const article = enrichArticle(record.articleSnapshot, record) || record.articleSnapshot;
    trainOnArticle(state, article, type, {
      fullAbstract: record.articleSnapshot.fullAbstract,
      metadata: record.metadata,
      now: record.occurredAt || record.recordedAt || now,
      updateAggregateStats: false
    });
    if (eventId) seenEventIds.add(eventId);
    applied++;
  });

  state.updatedAt = previousUpdatedAt;
  state.migration = {
    required: false,
    fromVersion: state.migration.fromVersion || null,
    completedAt: now,
    replayedRecords: applied
  };
  return { applied, skipped: false };
}

function getEnrichmentText(fullAbstracts, articleId) {
  const value = fullAbstracts && fullAbstracts[articleId];
  if (typeof value === 'string') return value;
  if (value && typeof value.text === 'string') return value.text;
  return null;
}

function getArticleTimestamp(article) {
  const value = new Date(article?.pubDate || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function getFreshnessScore(timestamp, latestTimestamp) {
  if (!timestamp || !latestTimestamp) return 0.2;
  const ageDays = Math.max(0, latestTimestamp - timestamp) / (24 * 60 * 60 * 1000);
  return Math.exp(-ageDays / 30);
}

function getFeedKey(article) {
  return String(article?.feedId || article?.feedName || 'unknown');
}

function rankArticles(articles, state, { limit = 50 } = {}) {
  const fullAbstracts = state?.fullAbstracts || {};
  const hasLearningData = Number(state?.stats?.trainingExamples || 0) > 0
    || Number(state?.profile?.positiveWeight || 0) > 0
    || Number(state?.profile?.negativeWeight || 0) > 0;
  const source = Array.isArray(articles) ? articles : [];
  const latestTimestamp = source.reduce((latest, article) => Math.max(latest, getArticleTimestamp(article)), 0);
  const ranked = source.map(article => {
    const fullAbstract = getEnrichmentText(fullAbstracts, article.id);
    const interestScore = hasLearningData ? predictInterestScore(state, article, fullAbstract) : 0.5;
    const freshnessScore = getFreshnessScore(getArticleTimestamp(article), latestTimestamp);
    const explorationScore = 1 - Math.abs(interestScore - 0.5) * 2;
    return {
      ...article,
      ...(fullAbstract ? { fullAbstract } : {}),
      interestScore,
      freshnessScore,
      explorationScore,
      feedKey: getFeedKey(article)
    };
  });

  const selected = [];
  const remaining = [...ranked];
  const feedCounts = new Map();
  const requestedLimit = Math.max(0, Number(limit) || 0);

  while (remaining.length > 0 && selected.length < requestedLimit) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const feedCount = feedCounts.get(candidate.feedKey) || 0;
      const diversityScore = 1 / (1 + feedCount);
      const value = hasLearningData
        ? candidate.interestScore * 0.72
          + candidate.freshnessScore * 0.14
          + candidate.explorationScore * 0.06
          + diversityScore * 0.08
        : candidate.freshnessScore * 0.82
          + candidate.explorationScore * 0.08
          + diversityScore * 0.10;
      const bestCandidate = remaining[bestIndex];
      if (
        value > bestValue
        || (value === bestValue && getArticleTimestamp(candidate) > getArticleTimestamp(bestCandidate))
      ) {
        bestIndex = index;
        bestValue = value;
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    const chosenFeedKey = chosen.feedKey;
    chosen.suggestionScore = Math.round(bestValue * 1000) / 1000;
    delete chosen.feedKey;
    delete chosen.interestScore;
    delete chosen.freshnessScore;
    delete chosen.explorationScore;
    selected.push(chosen);
    feedCounts.set(chosenFeedKey, (feedCounts.get(chosenFeedKey) || 0) + 1);
  }

  return selected;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripMarkup(value) {
  return decodeHtmlEntities(String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttribute(tag, attribute) {
  const match = String(tag || '').match(new RegExp(`${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeHtmlEntities(match[2]) : '';
}

function extractAbstractFromHtml(html) {
  const source = String(html || '');
  const candidates = [];
  const priority = {
    citation_abstract: 6,
    'dc.description': 5,
    description: 3,
    'og:description': 2
  };

  const metaTags = source.match(/<meta\b[^>]*>/gi) || [];
  metaTags.forEach(tag => {
    const key = (getAttribute(tag, 'name') || getAttribute(tag, 'property')).toLowerCase();
    if (!priority[key]) return;
    const content = stripMarkup(getAttribute(tag, 'content'));
    if (content.length >= 80) candidates.push({ text: content, priority: priority[key] });
  });

  const jsonAbstracts = source.match(/"abstract"\s*:\s*"(?:\\.|[^"\\])*"/gi) || [];
  jsonAbstracts.forEach(match => {
    const separator = match.indexOf(':');
    const raw = match.slice(separator + 1).trim();
    try {
      const text = stripMarkup(JSON.parse(raw));
      if (text.length >= 80) candidates.push({ text, priority: 4 });
    } catch (_) {
      // Some publisher JSON is not valid JSON after HTML entity expansion.
    }
  });

  const blockMatches = source.match(/<(?:section|div|article|p)\b[^>]*(?:id|class)\s*=\s*["'][^"']*abstract[^"']*["'][^>]*>[\s\S]*?<\/(?:section|div|article|p)>/gi) || [];
  blockMatches.forEach(block => {
    const text = stripMarkup(block);
    if (text.length >= 120) candidates.push({ text, priority: 4 });
  });

  candidates.sort((a, b) => b.priority - a.priority || b.text.length - a.text.length);
  return candidates[0]?.text || null;
}

module.exports = {
  EVENT_TYPES,
  FEATURE_SCHEMA_VERSION,
  HIDDEN_SIZE,
  INPUT_SIZE,
  MODEL_VERSION,
  SUGGESTION_EVENT_SCHEMA_VERSION,
  buildFeatureVector,
  createSuggestionArticleSnapshot,
  createSuggestionEventRecord,
  predictInterestScore,
  predictProfileScore,
  createSuggestionState,
  extractAbstractFromHtml,
  getEnrichmentText,
  getEventConfig,
  getEventType,
  normalizeSuggestionState,
  predictScore,
  rankArticles,
  replaySuggestionEventRecords,
  serializeSuggestionEventRecords,
  stripMarkup,
  trainOnArticle
};
