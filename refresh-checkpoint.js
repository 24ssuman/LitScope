'use strict';

function cleanValue(value) {
  return String(value || '').trim();
}

function normalizeDoi(value) {
  return cleanValue(value).toLowerCase();
}

function normalizeUrl(value) {
  return cleanValue(value).split('#')[0].trim().toLowerCase();
}

function normalizeTitle(value) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getArticleIdentityKeys(article) {
  if (!article || typeof article !== 'object') return [];

  const keys = new Set();
  const add = (prefix, value) => {
    if (value) keys.add(`${prefix}:${value}`);
  };

  add('doi', normalizeDoi(article.doi));
  add('link', normalizeUrl(article.link));
  add('guid', normalizeUrl(article.guid));
  add('id', cleanValue(article.id));

  const title = normalizeTitle(article.title);
  const feedId = cleanValue(article.feedId);
  if (title && feedId) add('title', `${feedId}:${title}`);

  return [...keys];
}

function normalizeCheckpoint(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') return null;

  const keys = new Set([
    ...getArticleIdentityKeys(checkpoint),
    ...(Array.isArray(checkpoint.keys) ? checkpoint.keys.map(cleanValue) : []),
    cleanValue(checkpoint.key)
  ].filter(Boolean));

  if (keys.size === 0) return null;

  return {
    key: cleanValue(checkpoint.key) || [...keys][0],
    keys: [...keys],
    id: checkpoint.id || null,
    doi: checkpoint.doi || null,
    link: checkpoint.link || null,
    guid: checkpoint.guid || null,
    title: checkpoint.title || null,
    feedId: checkpoint.feedId || null,
    pubDate: checkpoint.pubDate || null,
    fetchedAt: checkpoint.fetchedAt || null
  };
}

function createArticleCheckpoint(article) {
  const keys = getArticleIdentityKeys(article);
  if (keys.length === 0) return null;

  return {
    key: keys[0],
    keys,
    id: article.id || null,
    doi: article.doi || null,
    link: article.link || null,
    guid: article.guid || null,
    title: article.title || null,
    feedId: article.feedId || null,
    pubDate: article.pubDate || null,
    fetchedAt: article.fetchedAt || null
  };
}

function getDateValue(value) {
  const parsed = Date.parse(cleanValue(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLatestFetchedArticle(feed, articles = []) {
  const feedId = cleanValue(feed && feed.id);
  return articles
    .filter(article => !feedId || article.feedId === feedId)
    .reduce((latest, article) => {
      if (!latest) return article;

      const articleFetchedAt = getDateValue(article.fetchedAt);
      const latestFetchedAt = getDateValue(latest.fetchedAt);
      if (articleFetchedAt !== latestFetchedAt) {
        return articleFetchedAt > latestFetchedAt ? article : latest;
      }

      const articlePubDate = getDateValue(article.pubDate);
      const latestPubDate = getDateValue(latest.pubDate);
      return articlePubDate >= latestPubDate ? article : latest;
    }, null);
}

function getFeedCheckpoint(feed, articles = []) {
  const stored = normalizeCheckpoint(feed && feed.lastFetchedArticle);
  if (stored) return stored;
  return createArticleCheckpoint(getLatestFetchedArticle(feed, articles));
}

function sharesArticleIdentity(article, checkpoint) {
  const articleKeys = new Set(getArticleIdentityKeys(article));
  const checkpointKeys = new Set(
    normalizeCheckpoint(checkpoint)?.keys || []
  );
  return [...articleKeys].some(key => checkpointKeys.has(key));
}

function selectNewArticles(sourceArticles = [], checkpoint = null, existingArticles = []) {
  const articles = Array.isArray(sourceArticles) ? sourceArticles : [];
  const normalizedCheckpoint = normalizeCheckpoint(checkpoint);

  if (!normalizedCheckpoint) {
    return {
      articles,
      checkpointFound: false,
      mode: 'initial'
    };
  }

  const checkpointIndex = articles.findIndex(article => (
    sharesArticleIdentity(article, normalizedCheckpoint)
  ));

  if (checkpointIndex !== -1) {
    return {
      // RSS, arXiv, Crossref, and ChemRxiv sources are requested newest-first.
      // The entries before the checkpoint are the articles fetched since the
      // last successful journal refresh.
      articles: articles.slice(0, checkpointIndex),
      checkpointFound: true,
      mode: 'after-checkpoint'
    };
  }

  const knownKeys = new Set(
    existingArticles.flatMap(article => getArticleIdentityKeys(article))
  );
  const unseenArticles = articles.filter(article => {
    const keys = getArticleIdentityKeys(article);
    return keys.length === 0 || !keys.some(key => knownKeys.has(key));
  });

  return {
    // If a feed has rotated past its checkpoint, keep coverage by accepting
    // only source records that are not already in the local journal library.
    articles: unseenArticles,
    checkpointFound: false,
    mode: 'checkpoint-not-in-source'
  };
}

module.exports = {
  createArticleCheckpoint,
  getArticleIdentityKeys,
  getFeedCheckpoint,
  getLatestFetchedArticle,
  normalizeCheckpoint,
  selectNewArticles,
  sharesArticleIdentity
};
