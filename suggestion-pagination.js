'use strict';

const SUGGESTION_PAGE_SIZE = 20;
const MIN_SUGGESTION_PAGE_SIZE = 10;
const MAX_SUGGESTION_PAGE_SIZE = 20;
const MAX_SUGGESTION_PAGES = 3;

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getSuggestionPagination(total, requestedPage = 1, requestedPageSize = SUGGESTION_PAGE_SIZE) {
  const candidateTotal = Math.max(0, normalizeInteger(total, 0));
  const pageSize = clamp(
    normalizeInteger(requestedPageSize, SUGGESTION_PAGE_SIZE),
    MIN_SUGGESTION_PAGE_SIZE,
    MAX_SUGGESTION_PAGE_SIZE
  );
  const visibleTotal = Math.min(candidateTotal, pageSize * MAX_SUGGESTION_PAGES);
  const pageCount = visibleTotal === 0 ? 0 : Math.ceil(visibleTotal / pageSize);
  const page = pageCount === 0
    ? 1
    : clamp(normalizeInteger(requestedPage, 1), 1, pageCount);

  return {
    page,
    pageSize,
    pageCount,
    offset: (page - 1) * pageSize,
    visibleTotal,
    hasMore: candidateTotal > visibleTotal,
    total: candidateTotal
  };
}

module.exports = {
  MAX_SUGGESTION_PAGE_SIZE,
  MAX_SUGGESTION_PAGES,
  MIN_SUGGESTION_PAGE_SIZE,
  SUGGESTION_PAGE_SIZE,
  getSuggestionPagination
};
