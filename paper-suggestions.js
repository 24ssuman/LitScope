'use strict';

// A small, dependency-free online neural ranker. The model intentionally lives
// outside db.json so personal article/read/star state remains compatible with
// existing LitScope installations.
const MODEL_VERSION = 1;
const INPUT_SIZE = 256;
const HIDDEN_SIZE = 12;
const DEFAULT_SEED = 0x51f15e77;
const MAX_WEIGHT = 4;

const EVENT_TYPES = Object.freeze({
  open: { label: 0.72, weight: 1 },
  external: { label: 0.9, weight: 1.35 },
  star: { label: 1, weight: 1.8 },
  like: { label: 1, weight: 1.5 },
  unstar: { label: 0.35, weight: 0.45 },
  not_for_me: { label: 0, weight: 1.8 }
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

function createSuggestionState({ now = new Date().toISOString(), seed = DEFAULT_SEED } = {}) {
  return {
    version: MODEL_VERSION,
    createdAt: now,
    updatedAt: null,
    model: createModel({ seed }),
    stats: {
      eventsProcessed: 0,
      trainingExamples: 0,
      positiveExamples: 0,
      negativeExamples: 0
    },
    recentEventIds: [],
    dismissed: {},
    feedback: {},
    fullAbstracts: {}
  };
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeModel(candidate) {
  if (!candidate || Number(candidate.inputSize) !== INPUT_SIZE || Number(candidate.hiddenSize) !== HIDDEN_SIZE) {
    return createModel();
  }

  const validMatrix = Array.isArray(candidate.weights1)
    && candidate.weights1.length === HIDDEN_SIZE
    && candidate.weights1.every(row => Array.isArray(row) && row.length === INPUT_SIZE);
  const validBiases = Array.isArray(candidate.bias1) && candidate.bias1.length === HIDDEN_SIZE;
  const validOutput = Array.isArray(candidate.weights2) && candidate.weights2.length === HIDDEN_SIZE;
  if (!validMatrix || !validBiases || !validOutput || !isFiniteNumber(candidate.bias2)) {
    return createModel();
  }

  return {
    inputSize: INPUT_SIZE,
    hiddenSize: HIDDEN_SIZE,
    weights1: candidate.weights1.map(row => row.map(value => clamp(Number(value) || 0, -MAX_WEIGHT, MAX_WEIGHT))),
    bias1: candidate.bias1.map(value => clamp(Number(value) || 0, -MAX_WEIGHT, MAX_WEIGHT)),
    weights2: candidate.weights2.map(value => clamp(Number(value) || 0, -MAX_WEIGHT, MAX_WEIGHT)),
    bias2: clamp(Number(candidate.bias2) || 0, -MAX_WEIGHT, MAX_WEIGHT)
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

  return {
    version: MODEL_VERSION,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : fallback.createdAt,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
    model: normalizeModel(candidate.model),
    stats: {
      eventsProcessed: Math.max(0, Number(stats.eventsProcessed) || 0),
      trainingExamples: Math.max(0, Number(stats.trainingExamples) || 0),
      positiveExamples: Math.max(0, Number(stats.positiveExamples) || 0),
      negativeExamples: Math.max(0, Number(stats.negativeExamples) || 0)
    },
    recentEventIds,
    dismissed: normalizeMap(candidate.dismissed),
    feedback: normalizeMap(candidate.feedback),
    fullAbstracts: normalizeMap(candidate.fullAbstracts)
  };
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

function addFieldFeatures(vector, field, value, fieldWeight) {
  const tokens = tokenize(value).filter(token => token.length > 1);
  tokens.forEach((token, index) => {
    addHashedFeature(vector, `${field}:${token}`, fieldWeight);
    if (index > 0) {
      addHashedFeature(vector, `${field}:${tokens[index - 1]}_${token}`, fieldWeight * 0.45);
    }
  });
}

function getFullAbstractText(article, fullAbstract) {
  if (typeof fullAbstract === 'string' && fullAbstract.trim()) return fullAbstract;
  if (typeof article?.fullAbstract === 'string' && article.fullAbstract.trim()) return article.fullAbstract;
  return article?.content || '';
}

function buildFeatureVector(article, fullAbstract = null) {
  const vector = Array.from({ length: INPUT_SIZE }, () => 0);
  addFieldFeatures(vector, 'title', article?.title, 2.1);
  addFieldFeatures(vector, 'author', article?.author || article?.authors, 1.25);
  addFieldFeatures(vector, 'abstract', getFullAbstractText(article, fullAbstract), 1);

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] /= magnitude;
  }
  return vector;
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

function trainOnArticle(state, article, type, { fullAbstract = null, now = new Date().toISOString() } = {}) {
  const config = getEventConfig(type);
  if (!state || !article || !config) return null;

  const model = state.model;
  const vector = buildFeatureVector(article, fullAbstract);
  const result = forward(model, vector);
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

  state.stats.eventsProcessed += 1;
  state.stats.trainingExamples += 1;
  if (config.label >= 0.65) state.stats.positiveExamples += 1;
  if (config.label <= 0.35) state.stats.negativeExamples += 1;
  state.updatedAt = now;

  return { before: result.score, after: predictScore(state, article, fullAbstract) };
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

function rankArticles(articles, state, { limit = 50 } = {}) {
  const fullAbstracts = state?.fullAbstracts || {};
  const hasLearningData = Number(state?.stats?.trainingExamples || 0) > 0;
  const ranked = (articles || []).map(article => {
    const fullAbstract = getEnrichmentText(fullAbstracts, article.id);
    const score = predictScore(state, article, fullAbstract);
    return {
      ...article,
      ...(fullAbstract ? { fullAbstract } : {}),
      suggestionScore: Math.round(score * 1000) / 1000,
      suggestionFeedback: state?.feedback?.[article.id] || null
    };
  });

  ranked.sort((a, b) => {
    if (hasLearningData && b.suggestionScore !== a.suggestionScore) {
      return b.suggestionScore - a.suggestionScore;
    }
    return getArticleTimestamp(b) - getArticleTimestamp(a);
  });

  return ranked.slice(0, Math.max(0, Number(limit) || 0));
}

function markFeedback(state, articleId, type, now = new Date().toISOString()) {
  const normalizedType = getEventType(type);
  if (!state || !articleId) return;
  if (normalizedType === 'not_for_me') {
    state.dismissed[articleId] = now;
    state.feedback[articleId] = 'not-for-me';
  } else if (normalizedType === 'like') {
    state.feedback[articleId] = 'liked';
  }
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
  HIDDEN_SIZE,
  INPUT_SIZE,
  MODEL_VERSION,
  buildFeatureVector,
  createSuggestionState,
  extractAbstractFromHtml,
  getEnrichmentText,
  getEventConfig,
  getEventType,
  markFeedback,
  normalizeSuggestionState,
  predictScore,
  rankArticles,
  stripMarkup,
  trainOnArticle
};
