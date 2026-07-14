'use strict';

function resolveArticleReadState(existingArticle, isInReadHistory) {
  if (existingArticle) return Boolean(existingArticle.read);
  return Boolean(isInReadHistory);
}

module.exports = { resolveArticleReadState };
