/* ==========================================================================
   LitScope client-side core logic (app.js)
   ========================================================================== */

// --- Global Application State ---
const state = {
  feeds: [],
  articles: [],
  activeFeedId: 'today',       // 'today', 'saved', 'all', or feed ID
  activeCategory: null,        // Set when category is selected
  showUnreadOnly: true,        // Toggle read/unread filter
  viewMode: 'magazine',        // 'list', 'magazine', 'cards'
  selectedArticleId: null,
  searchQuery: '',
  isSidebarOpen: false,
  isRefreshing: false,
  articleRequestId: 0
};

// --- API Helper Methods ---
const API = {
  async getStatus() {
    const res = await fetch('/api/status');
    return res.json();
  },
  async getFeeds() {
    const res = await fetch('/api/feeds');
    return res.json();
  },
  async getArticles(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/articles?${query}`);
    return res.json();
  },
  async addFeed(name, url, category) {
    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, category })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add feed');
    }
    return res.json();
  },
  async updateFeed(id, data) {
    const res = await fetch(`/api/feeds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async deleteFeed(id) {
    const res = await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    return res.json();
  },
  async markRead(id, read) {
    const res = await fetch(`/api/articles/${id}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read })
    });
    return res.json();
  },
  async markAllRead(feedId, category) {
    const res = await fetch('/api/articles/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedId, category })
    });
    return res.json();
  },
  async markStarred(id, starred) {
    const res = await fetch(`/api/articles/${id}/star`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred })
    });
    return res.json();
  },
  async triggerRefresh() {
    const res = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return res.json();
  },
  async saveSettings(settings) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  },
};

// --- DOM Elements Cache ---
const DOM = {
  feedsListContainer: document.getElementById('feeds-list-container'),
  articlesListContainer: document.getElementById('articles-list-container'),
  streamContainer: document.getElementById('stream-container'),
  streamEmpty: document.getElementById('stream-empty'),
  
  feedTitle: document.getElementById('feed-title'),
  articleCountLabel: document.getElementById('article-count-label'),
  
  // Navigation elements
  navToday: document.getElementById('nav-today'),
  navSaved: document.getElementById('nav-saved'),
  navAll: document.getElementById('nav-all'),
  countToday: document.getElementById('count-today'),
  countSaved: document.getElementById('count-saved'),
  countAll: document.getElementById('count-all'),
  
  // Controls
  filterUnreadBtn: document.getElementById('filter-unread-btn'),
  filterAllBtn: document.getElementById('filter-all-btn'),
  
  layoutListBtn: document.getElementById('layout-list-btn'),
  layoutMagazineBtn: document.getElementById('layout-magazine-btn'),
  layoutCardsBtn: document.getElementById('layout-cards-btn'),
  
  refreshBtn: document.getElementById('refresh-btn'),
  refreshIcon: document.getElementById('refresh-icon'),
  
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  keyboardHelpBtn: document.getElementById('keyboard-help-btn'),
  menuToggleBtn: document.getElementById('menu-toggle-btn'),
  sidebar: document.getElementById('sidebar'),
  
  // Drawer
  detailDrawer: document.getElementById('detail-drawer'),
  drawerFeedName: document.getElementById('drawer-feed-name'),
  drawerDate: document.getElementById('drawer-date'),
  drawerStarBtn: document.getElementById('drawer-star-btn'),
  drawerReadBtn: document.getElementById('drawer-read-btn'),
  drawerCloseBtn: document.getElementById('drawer-close-btn'),
  drawerTitle: document.getElementById('drawer-title'),
  drawerAuthors: document.getElementById('drawer-authors'),
  drawerDoiContainer: document.getElementById('drawer-doi-container'),
  drawerDoiLink: document.getElementById('drawer-doi-link'),
  drawerContent: document.getElementById('drawer-content'),
  drawerExternalLink: document.getElementById('drawer-external-link'),
  drawerCopyCitationBtn: document.getElementById('drawer-copy-citation-btn'),
  
  // Progress Banner
  progressBanner: document.getElementById('progress-banner'),
  progressBar: document.getElementById('progress-bar'),
  progressText: document.getElementById('progress-text'),
  progressPercentage: document.getElementById('progress-percentage'),
  connectionStatus: document.getElementById('connection-status'),
  
  // Search
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  
  // Add Feed Modal
  feedModal: document.getElementById('feed-modal'),
  addFeedBtn: document.getElementById('add-feed-btn'),
  feedModalCloseBtn: document.getElementById('feed-modal-close-btn'),
  feedModalCancelBtn: document.getElementById('feed-modal-cancel-btn'),
  feedForm: document.getElementById('feed-form'),
  feedNameInput: document.getElementById('feed-name-input'),
  feedUrlInput: document.getElementById('feed-url-input'),
  feedCategoryInput: document.getElementById('feed-category-input'),
  
  // Edit Feed Modal
  editFeedModal: document.getElementById('edit-feed-modal'),
  editFeedForm: document.getElementById('edit-feed-form'),
  editFeedId: document.getElementById('edit-feed-id'),
  editFeedName: document.getElementById('edit-feed-name'),
  editFeedCategory: document.getElementById('edit-feed-category'),
  editFeedUrl: document.getElementById('edit-feed-url'),
  editFeedDeleteBtn: document.getElementById('edit-feed-delete-btn'),
  editFeedModalCloseBtn: document.getElementById('edit-feed-modal-close-btn'),
  editFeedCancelBtn: document.getElementById('edit-feed-cancel-btn'),
  
  // Keyboard Modal
  keyboardModal: document.getElementById('keyboard-modal'),
  keyboardModalCloseBtn: document.getElementById('keyboard-modal-close-btn'),

  // New Articles Navigation
  navNew: document.getElementById('nav-new'),
  countNew: document.getElementById('count-new'),

  // Advanced Search
  advancedSearchPanel: document.getElementById('advanced-search-panel'),
  filterAuthorInput: document.getElementById('filter-author-input'),
  filterJournalSelect: document.getElementById('filter-journal-select'),
  filterStartDate: document.getElementById('filter-start-date'),
  filterEndDate: document.getElementById('filter-end-date'),
  filterSortSelect: document.getElementById('filter-sort-select'),
  applyFiltersBtn: document.getElementById('apply-filters-btn'),
  resetFiltersBtn: document.getElementById('reset-filters-btn'),

  // Feedback
  toastContainer: document.getElementById('toast-container')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  // Bind events first
  bindEvents();
  
  // Load Settings and dashboard metadata
  await loadInitData();
  
  // Initial fetch of feeds and articles
  await refreshSidebar();
  await loadArticles();
  
  // Initialize Real-time Feed Fetching Status Tracker
  initSSE();
  
  // Check online status
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
});

// Update online status in UI
function updateOnlineStatus() {
  if (navigator.onLine) {
    DOM.connectionStatus.className = 'status-indicator online';
    DOM.connectionStatus.title = 'Online';
  } else {
    DOM.connectionStatus.className = 'status-indicator offline';
    DOM.connectionStatus.title = 'Offline (Using Cache)';
    showToast('Offline mode active. Feeds will load cached articles.', 'warning');
  }
}

// --- Load Initial Configurations ---
async function loadInitData() {
  try {
    const status = await API.getStatus();
    
    // Theme toggle
    if (status.settings.theme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      DOM.themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      DOM.themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
    }
    
    // View mode
    state.viewMode = status.settings.viewMode || 'magazine';
    updateLayoutButtons();
    
    // Filter mode
    state.showUnreadOnly = status.settings.showUnreadOnly !== undefined ? status.settings.showUnreadOnly : true;
    updateFilterButtons();
    
    // Refresh badges counts
    updateBadgeCounts(status);
  } catch (err) {
    console.error('Failed to load status:', err);
  }
}

function updateBadgeCounts(status) {
  DOM.countAll.innerText = status.totalArticles || 0;
  DOM.countSaved.innerText = status.starredArticles || 0;
  DOM.countToday.innerText = status.todayUnreadArticles || 0;
  DOM.countNew.innerText = status.unreadArticles || 0;
}

const QUICK_NAV_IDS = new Set(['today', 'new', 'saved', 'all']);

function sortFeedsForSidebar(feeds = []) {
  return [...feeds].sort((a, b) => {
    // 1. Sort by unreadCount > 0 first (unread at top, read/empty at bottom)
    const aHasUnread = a.unreadCount > 0 ? 1 : 0;
    const bHasUnread = b.unreadCount > 0 ? 1 : 0;
    if (aHasUnread !== bHasUnread) {
      return bHasUnread - aHasUnread;
    }

    // 2. Sort by newestDate descending (most recent first)
    const aDate = a.newestDate || 0;
    const bDate = b.newestDate || 0;
    if (aDate !== bDate) {
      return bDate - aDate;
    }

    // 3. Alphabetical fallback
    return a.name.localeCompare(b.name);
  });
}

function getCurrentJournalCategory() {
  if (state.activeCategory) return state.activeCategory;
  if (!state.activeFeedId || QUICK_NAV_IDS.has(state.activeFeedId)) return null;

  const feedObj = state.feeds.find(f => f.id === state.activeFeedId);
  return feedObj ? feedObj.category : null;
}

function getNextUnreadFeedInCategory(categoryName, excludeFeedId = null) {
  if (!categoryName) return null;

  const feedsInCategory = state.feeds.filter(feed => feed.category === categoryName);
  const sortedFeeds = sortFeedsForSidebar(feedsInCategory);
  return sortedFeeds.find(feed => feed.unreadCount > 0 && feed.id !== excludeFeedId) || null;
}

function jumpToNextUnreadFeedInCurrentCategory({ excludeCurrentFeed = false, showEmptyToast = true } = {}) {
  const categoryName = getCurrentJournalCategory();
  if (!categoryName) return false;

  const excludeFeedId = excludeCurrentFeed && state.activeFeedId && !QUICK_NAV_IDS.has(state.activeFeedId)
    ? state.activeFeedId
    : null;
  const nextFeed = getNextUnreadFeedInCategory(categoryName, excludeFeedId);

  if (nextFeed) {
    selectFeed(nextFeed.id);
    return true;
  }

  if (showEmptyToast) {
    showToast(`All journals in ${categoryName} are read.`, 'info');
  }

  return false;
}

// Generate color-coded, styled text icons for default academic publishers to prevent ugly missing-favicon arrows
function getFeedIcon(feed) {
  const name = feed.name.toLowerCase();
  const id = feed.id.toLowerCase();
  
  let text = '';
  let bgColor = '';
  let textColor = '#ffffff';
  let fontSerif = false;
  
  if (id.startsWith('acs') || id === 'jacs' || id === 'jctc' || id.startsWith('jpc') || id === 'chemmat' || id === 'nanolett') {
    text = 'ACS';
    bgColor = '#2980b9'; // ACS blue
  } else if (id.startsWith('nat') || id === 'nature' || id === 'scientificreports') {
    text = 'N';
    bgColor = '#2c3e50'; // Nature slate black
    fontSerif = true;
  } else if (id.startsWith('sci') || id === 'science' || id === 'sciencefirstrelease') {
    text = 'S';
    bgColor = '#e74c3c'; // Science crimson red
    fontSerif = true;
  } else if (id === 'jcc' || id === 'chemphyschem' || id === 'jcp' || id.includes('wiley')) {
    text = 'W';
    bgColor = '#2980b9'; // Wiley blue
    fontSerif = true;
  } else if (id === 'pccp' || id === 'chemsci' || id === 'faradaydiscussion' || id.includes('rsc')) {
    text = 'RSC';
    bgColor = '#27ae60'; // Royal Society of Chemistry green
  } else if (id.startsWith('pnas')) {
    text = 'PNAS';
    bgColor = '#7f8c8d'; // Grey
  } else if (id.startsWith('chemrxiv')) {
    text = 'CRx';
    bgColor = '#8e44ad'; // ChemRxiv purple
  } else if (id.startsWith('arxiv')) {
    text = 'arXiv';
    bgColor = '#b33939'; // Terracotta
  } else {
    // Fallback: take first 2 letters
    text = feed.name.substring(0, 2).toUpperCase();
    bgColor = '#2f3542'; // Charcoal grey
  }
  
  const style = `background-color: ${bgColor}; color: ${textColor}; font-family: ${fontSerif ? 'var(--font-serif)' : 'var(--font-sans)'}; font-weight: 700; font-size: ${text.length > 3 ? '7px' : (text.length > 2 ? '9px' : '11px')}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 4px; text-transform: uppercase; border: 1px solid var(--border-color);`;
  return `<span style="${style}">${text}</span>`;
}

// Generate color-coded, styled badge boxes for journal names to make them distinctly visible
function getJournalBadge(feedName, feedId = '') {
  const id = (feedId || feedName).toLowerCase();
  
  let bg = '';
  let border = '';
  let text = '';
  
  if (id === 'jacs') {
    bg = 'rgba(45, 212, 191, 0.15)';
    border = '1px solid rgba(45, 212, 191, 0.4)';
    text = '#2dd4bf';
  } else if (id === 'jctc') {
    bg = 'rgba(52, 211, 153, 0.15)';
    border = '1px solid rgba(52, 211, 153, 0.4)';
    text = '#34d399';
  } else if (id.startsWith('jpc')) {
    bg = 'rgba(56, 189, 248, 0.15)';
    border = '1px solid rgba(56, 189, 248, 0.4)';
    text = '#38bdf8';
  } else if (id.startsWith('acs') || id === 'chemmat' || id === 'nanolett') {
    bg = 'rgba(96, 165, 250, 0.15)';
    border = '1px solid rgba(96, 165, 250, 0.4)';
    text = '#60a5fa';
  } else if (id.startsWith('chemrxiv')) {
    bg = 'rgba(192, 132, 252, 0.15)';
    border = '1px solid rgba(192, 132, 252, 0.4)';
    text = '#c084fc';
  } else if (id.startsWith('arxiv')) {
    bg = 'rgba(248, 113, 113, 0.15)';
    border = '1px solid rgba(248, 113, 113, 0.4)';
    text = '#f87171';
  } else if (id === 'jcp' || id === 'jcc' || id.includes('wiley')) {
    bg = 'rgba(129, 140, 248, 0.15)';
    border = '1px solid rgba(129, 140, 248, 0.4)';
    text = '#818cf8';
  } else if (id === 'pccp') {
    bg = 'rgba(163, 230, 53, 0.15)';
    border = '1px solid rgba(163, 230, 53, 0.4)';
    text = '#a3e635';
  } else if (id === 'chemsci' || id === 'faradaydiscussion' || id.includes('rsc')) {
    bg = 'rgba(74, 222, 128, 0.15)';
    border = '1px solid rgba(74, 222, 128, 0.4)';
    text = '#4ade80';
  } else if (id.includes('nature') || id.startsWith('nat')) {
    bg = 'rgba(251, 191, 36, 0.15)';
    border = '1px solid rgba(251, 191, 36, 0.4)';
    text = '#fbbf24';
  } else {
    // Generate stable hash hue
    let hash = 0;
    const nameToHash = id || feedName;
    for (let i = 0; i < nameToHash.length; i++) {
      hash = nameToHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    bg = `hsla(${hue}, 70%, 50%, 0.15)`;
    border = `1px solid hsla(${hue}, 70%, 50%, 0.4)`;
    text = `hsl(${hue}, 80%, 75%)`;
  }
  
  const style = `background-color: ${bg}; border: ${border}; color: ${text}; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; font-family: var(--font-sans); display: inline-flex; align-items: center; white-space: nowrap; max-width: 100%; box-sizing: border-box;`;
  return `<span class="journal-badge" style="${style}" title="${escapeHTML(feedName)}">${escapeHTML(feedName)}</span>`;
}

// --- Sidebar Feeds Tree Loading ---
async function refreshSidebar() {
  try {
    const res = await API.getFeeds();
    state.feeds = res.feeds;
    
    // Build categories datalist options
    const uniqueCategories = [...new Set(state.feeds.map(f => f.category))];
    const datalist = document.getElementById('categories-list');
    datalist.innerHTML = uniqueCategories.map(cat => `<option value="${cat}">`).join('');
    updateJournalFilterOptions();

    // Group feeds by publisher while retaining each feed's saved category for
    // the existing filters and read actions.
    const grouped = {};
    state.feeds.forEach(feed => {
      const publisher = feed.publisher || 'Other';
      if (!grouped[publisher]) grouped[publisher] = [];
      grouped[publisher].push(feed);
    });

    // Render tree inside container
    DOM.feedsListContainer.innerHTML = '';
    
    const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    
    if (sortedCategories.length === 0) {
      DOM.feedsListContainer.innerHTML = `<div class="sidebar-empty">No feeds added yet. Click + to add your first feed!</div>`;
      return;
    }

    sortedCategories.forEach(category => {
      // Sort feeds within this category
      const feeds = sortFeedsForSidebar(grouped[category]);
      
      const groupEl = document.createElement('div');
      groupEl.className = 'category-group';
      groupEl.dataset.category = category;
      
      // Category Header
      const headerEl = document.createElement('div');
      headerEl.className = 'category-header';
      const unreadCount = feeds.reduce((total, feed) => total + feed.unreadCount, 0);
      headerEl.innerHTML = `
        <i data-lucide="chevron-down" class="category-arrow"></i>
        <span class="category-name">${escapeHTML(category)}</span>
        ${unreadCount > 0 ? `<span class="category-badge">${unreadCount}</span>` : ''}
      `;
      
      // Toggle collapse on arrow / text click
      headerEl.addEventListener('click', (e) => {
        groupEl.classList.toggle('collapsed');
      });
      
      const feedsContainerEl = document.createElement('div');
      feedsContainerEl.className = 'category-feeds';
      
      feeds.forEach(feed => {
        const feedItemEl = document.createElement('a');
        feedItemEl.href = '#';
        feedItemEl.className = `feed-item ${state.activeFeedId === feed.id ? 'active' : ''}`;
        feedItemEl.dataset.id = feed.id;
        
        const iconHtml = getFeedIcon(feed);
        
        feedItemEl.innerHTML = `
          <div class="feed-favicon">
            ${iconHtml}
          </div>
          <span class="feed-name">${escapeHTML(feed.name)}</span>
          ${feed.unreadCount > 0 ? `<span class="badge">${feed.unreadCount}</span>` : ''}
          <button class="feed-actions-trigger" data-feed-id="${feed.id}">
            <i data-lucide="edit-3" style="width:13px; height:13px;"></i>
          </button>
        `;
        
        // Feed selection event
        feedItemEl.addEventListener('click', (e) => {
          // If clicking the edit icon trigger edit modal
          if (e.target.closest('.feed-actions-trigger')) {
            e.preventDefault();
            e.stopPropagation();
            openEditFeedModal(feed);
            return;
          }
          e.preventDefault();
          selectFeed(feed.id);
        });
        
        feedsContainerEl.appendChild(feedItemEl);
      });
      
      groupEl.appendChild(headerEl);
      groupEl.appendChild(feedsContainerEl);
      DOM.feedsListContainer.appendChild(groupEl);
    });

    // Re-initialize lucide icons for newly appended DOM elements
    lucide.createIcons();
    
  } catch (err) {
    console.error('Failed to load sidebar feeds:', err);
    DOM.feedsListContainer.innerHTML = `<div class="sidebar-error">Error loading feeds.</div>`;
  }
}

function updateJournalFilterOptions() {
  const selectedFeedId = DOM.filterJournalSelect.value;
  const options = [...state.feeds]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(feed => `<option value="${escapeHTML(feed.id)}">${escapeHTML(feed.name)}</option>`)
    .join('');

  DOM.filterJournalSelect.innerHTML = `<option value="">All journals</option>${options}`;
  DOM.filterJournalSelect.value = state.feeds.some(feed => feed.id === selectedFeedId) ? selectedFeedId : '';
}

// --- Fetch & Render Articles Stream ---
async function loadArticles() {
  const requestId = ++state.articleRequestId;
  DOM.articlesListContainer.innerHTML = '<div class="loading-placeholder">Loading articles...</div>';
  DOM.streamEmpty.classList.add('hidden');

  const params = {
    limit: 100
  };

  // Toggle Advanced Search Panel visibility based on active view
  if (state.activeFeedId === 'all') {
    DOM.advancedSearchPanel.classList.remove('hidden');
  } else {
    DOM.advancedSearchPanel.classList.add('hidden');
  }

  // Filter params
  if (state.activeFeedId === 'today') {
    // Show only unread articles published today (last 24 hours / from start of today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    params.startDate = todayStart.toISOString();
    params.read = 'false';
  } else if (state.activeFeedId === 'new') {
    // Show all unread articles regardless of date
    params.read = 'false';
  } else if (state.activeFeedId === 'saved') {
    params.starred = 'true';
  } else if (state.activeFeedId === 'all') {
    // Show all depending on active toggle
    if (state.showUnreadOnly) params.read = 'false';
    
    // Inject Advanced Search Filters if present
    const authorVal = DOM.filterAuthorInput.value.trim();
    const journalVal = DOM.filterJournalSelect.value;
    const startVal = DOM.filterStartDate.value;
    const endVal = DOM.filterEndDate.value;
    const sortVal = DOM.filterSortSelect.value;
    
    if (authorVal) params.author = authorVal;
    if (journalVal) params.feedId = journalVal;
    if (startVal) params.startDate = new Date(startVal + 'T00:00:00').toISOString();
    if (endVal) params.endDate = new Date(endVal + 'T23:59:59').toISOString();
    if (sortVal) params.sort = sortVal;
  } else if (state.activeFeedId) {
    // Specific feed
    params.feedId = state.activeFeedId;
    if (state.showUnreadOnly) params.read = 'false';
  } else if (state.activeCategory) {
    // Specific category
    params.category = state.activeCategory;
    if (state.showUnreadOnly) params.read = 'false';
  }
  
  // Search query
  if (state.searchQuery) {
    params.search = state.searchQuery;
    delete params.read; // Search search everywhere
  }

  try {
    const res = await API.getArticles(params);
    if (requestId !== state.articleRequestId) return;
    state.articles = res.articles;
    
    // Update article count
    DOM.articleCountLabel.innerText = `${res.total} articles`;
    
    // Update status badge counts in sidebar
    const status = await API.getStatus();
    if (requestId !== state.articleRequestId) return;
    updateBadgeCounts(status);

    renderArticles();
  } catch (err) {
    if (requestId !== state.articleRequestId) return;
    console.error('Failed to fetch articles:', err);
    DOM.articlesListContainer.innerHTML = '<div class="loading-placeholder error">Error loading articles.</div>';
  }
}

function renderArticles() {
  DOM.articlesListContainer.innerHTML = '';
  
  if (state.articles.length === 0) {
    DOM.streamEmpty.classList.remove('hidden');
    return;
  }

  // Update layout CSS class on viewport container
  DOM.streamContainer.className = `stream-container`;
  DOM.articlesListContainer.className = `stream-content ${state.viewMode}-layout`;
  
  // Group articles by date relative tag (Today, Yesterday, Older)
  const todayGroup = [];
  const yesterdayGroup = [];
  const olderGroup = [];
  
  const now = new Date();
  const todayStr = now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  state.articles.forEach(art => {
    const artDate = new Date(art.pubDate);
    const artDateStr = artDate.toDateString();
    
    if (artDateStr === todayStr) {
      todayGroup.push(art);
    } else if (artDateStr === yesterdayStr) {
      yesterdayGroup.push(art);
    } else {
      olderGroup.push(art);
    }
  });

  const groups = [
    { title: 'Today', items: todayGroup },
    { title: 'Yesterday', items: yesterdayGroup },
    { title: 'Older Articles', items: olderGroup }
  ];

  groups.forEach(g => {
    if (g.items.length === 0) return;
    
    // Render group header (except in Cards Grid view where dividers ruin layout flow)
    if (state.viewMode !== 'cards') {
      const headerEl = document.createElement('div');
      headerEl.className = 'date-group-header';
      headerEl.innerText = g.title;
      DOM.articlesListContainer.appendChild(headerEl);
    }
    
    g.items.forEach(article => {
      const itemEl = document.createElement('article');
      itemEl.className = `article-item ${article.read ? 'read' : ''} ${state.selectedArticleId === article.id ? 'selected' : ''}`;
      itemEl.dataset.id = article.id;
      
      const relTime = formatRelativeTime(article.pubDate);
      const isStarred = article.starred;

      if (state.viewMode === 'list') {
        // List View Row
        itemEl.innerHTML = `
          <div class="article-read-dot"></div>
          <span class="article-source">${getJournalBadge(article.feedName, article.feedId)}</span>
          <div class="article-title-snippet">
            <span class="article-title">${escapeHTML(article.title)}</span>
            <span class="article-snippet">— ${escapeHTML(stripHTML(article.content))}</span>
          </div>
          <span class="article-meta-right">${relTime}</span>
          <div class="article-actions">
            <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="card-action-btn link-external" title="Visit Publisher Website" onclick="event.stopPropagation();">
              <i data-lucide="external-link"></i>
            </a>
            <button class="card-action-btn star-toggle ${isStarred ? 'starred' : ''}">
              <i data-lucide="star"></i>
            </button>
            <button class="card-action-btn read-toggle is-read">
              <i data-lucide="check"></i>
            </button>
          </div>
        `;
      } else if (state.viewMode === 'magazine') {
        // Magazine View Row
        itemEl.innerHTML = `
          <div class="article-header">
            <div class="article-meta-left">
              <div class="article-read-indicator"></div>
              ${getJournalBadge(article.feedName, article.feedId)}
            </div>
            <span class="article-date">${relTime}</span>
          </div>
          <h2 class="article-title">${escapeHTML(article.title)}</h2>
          <p class="article-snippet">${escapeHTML(stripHTML(article.content))}</p>
          <div class="article-footer">
            <span class="article-authors">By ${escapeHTML(formatAuthorsList(article.author))}</span>
            <div class="article-actions">
              <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="card-action-btn link-external" title="Visit Publisher Website" onclick="event.stopPropagation();">
                <i data-lucide="external-link"></i>
              </a>
              <button class="card-action-btn star-toggle ${isStarred ? 'starred' : ''}">
                <i data-lucide="star"></i>
              </button>
              <button class="card-action-btn read-toggle is-read">
                <i data-lucide="check"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        // Cards View Grid Card
        itemEl.innerHTML = `
          <div class="article-header">
            <div class="article-meta">
              <div class="article-read-indicator"></div>
              ${getJournalBadge(article.feedName, article.feedId)}
            </div>
            <span>${relTime}</span>
          </div>
          <h2 class="article-title">${escapeHTML(article.title)}</h2>
          ${article.doi ? `<div class="article-doi">DOI: ${escapeHTML(article.doi)}</div>` : ''}
          <p class="article-snippet">${escapeHTML(stripHTML(article.content))}</p>
          <div class="article-footer">
            <span class="article-authors">By ${escapeHTML(formatAuthorsList(article.author))}</span>
            <div class="article-actions">
              <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="card-action-btn link-external" title="Visit Publisher Website" onclick="event.stopPropagation();">
                <i data-lucide="external-link"></i>
              </a>
              <button class="card-action-btn star-toggle ${isStarred ? 'starred' : ''}">
                <i data-lucide="star"></i>
              </button>
              <button class="card-action-btn read-toggle is-read">
                <i data-lucide="check"></i>
              </button>
            </div>
          </div>
        `;
      }

      // Action Handlers
      // Toggle star/bookmark
      itemEl.querySelector('.star-toggle').addEventListener('click', async (e) => {
        e.stopPropagation();
        const nextStarred = !article.starred;
        article.starred = nextStarred;
        
        // Optimistic UI updates
        const btn = e.currentTarget;
        btn.classList.toggle('starred', nextStarred);
        
        await API.markStarred(article.id, nextStarred);
        if (state.activeFeedId === 'saved' && !nextStarred) {
          // Remove from view if inside saved filters
          itemEl.remove();
        }
        await updateBadgeCounts(await API.getStatus());
      });

      // Toggle read status manually
      itemEl.querySelector('.read-toggle').addEventListener('click', async (e) => {
        e.stopPropagation();
        const nextRead = !article.read;
        article.read = nextRead;
        
        // Optimistic UI updates
        itemEl.classList.toggle('read', nextRead);
        
        await API.markRead(article.id, nextRead);
        
        if (state.showUnreadOnly && nextRead) {
          // Fade and remove if unread only is enabled
          itemEl.style.opacity = '0.3';
          setTimeout(() => {
            if (state.showUnreadOnly && article.read) itemEl.remove();
          }, 300);
        }
        
        // Refresh sidebar badges
        await refreshSidebar();
        await updateBadgeCounts(await API.getStatus());
      });

      // Selection handler (clicks to open side drawer)
      itemEl.addEventListener('click', (e) => {
        selectArticle(article.id);
      });

      DOM.articlesListContainer.appendChild(itemEl);
    });
  });

  // Append "Mark all as read" button at the bottom of the stream if there are unread articles
  const hasUnread = state.articles.some(a => !a.read);
  if (state.articles.length > 0 && hasUnread) {
    const bottomBtnContainer = document.createElement('div');
    bottomBtnContainer.className = 'stream-bottom-actions';
    bottomBtnContainer.innerHTML = `
      <button id="stream-mark-all-read-btn" class="btn primary large-btn">
        <i data-lucide="check-check"></i>
        <span>Mark all read</span>
      </button>
    `;
    bottomBtnContainer.querySelector('button').addEventListener('click', async (e) => {
      e.stopPropagation();
      await triggerMarkAllRead();
    });
    DOM.articlesListContainer.appendChild(bottomBtnContainer);
  }

  lucide.createIcons();
}

// Navigation helper to find and jump to the first unread feed across any category folder
function jumpToNextUnreadFeedGlobal(excludeFeedId = null) {
  const grouped = {};
  state.feeds.forEach(feed => {
    const publisher = feed.publisher || 'Other';
    if (!grouped[publisher]) grouped[publisher] = [];
    grouped[publisher].push(feed);
  });
  const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  
  for (const category of sortedCategories) {
    const feeds = sortFeedsForSidebar(grouped[category]);
    const found = feeds.find(f => f.unreadCount > 0 && f.id !== excludeFeedId);
    if (found) {
      selectFeed(found.id);
      return true;
    }
  }
  return false;
}

// Mark all articles in current view as read and shift to the next top journal containing unread articles
async function triggerMarkAllRead() {
  const feedParam = (state.activeFeedId && !QUICK_NAV_IDS.has(state.activeFeedId)) ? state.activeFeedId : null;
  const categoryParam = state.activeCategory || null;
  
  // Immediately clear the article stream for instant visual feedback
  state.articles = [];
  DOM.articlesListContainer.innerHTML = '';
  DOM.streamEmpty.classList.remove('hidden');
  
  // Fire the API call — don't wait for it to finish before navigating
  const markPromise = API.markAllRead(feedParam, categoryParam);
  
  // Wait for the API to finish and refresh sidebar counts
  const res = await markPromise;
  showToast(`Marked ${res.markedReadCount} articles as read.`, 'success');
  
  await refreshSidebar();
  await updateBadgeCounts(await API.getStatus());

  // Jump to the next unread feed globally across all category folders
  if (!jumpToNextUnreadFeedGlobal(feedParam)) {
    // No unread feeds left anywhere — reload current (will show empty state)
    loadArticles();
  }
}

// --- Selecting items ---
function selectFeed(feedId) {
  state.activeFeedId = feedId;
  state.activeCategory = null;
  state.selectedArticleId = null;
  
  // Highlight in sidebar
  document.querySelectorAll('.feed-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === feedId);
  });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  // Auto-expand parent category folder if it is collapsed
  const activeFeedItem = document.querySelector(`.feed-item[data-id="${feedId}"]`);
  if (activeFeedItem) {
    const parentGroup = activeFeedItem.closest('.category-group');
    if (parentGroup) {
      parentGroup.classList.remove('collapsed');
    }
  }

  // Update header title
  const feedObj = state.feeds.find(f => f.id === feedId);
  DOM.feedTitle.innerText = feedObj ? feedObj.name : 'Unknown Feed';
  
  closeDrawer();
  loadArticles();
}

function selectCategory(categoryName) {
  state.activeFeedId = null;
  state.activeCategory = categoryName;
  state.selectedArticleId = null;
  
  // Deactivate all sidebar items
  document.querySelectorAll('.feed-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  DOM.feedTitle.innerText = categoryName;
  
  closeDrawer();
  loadArticles();
}

function selectQuickNav(navId) {
  state.activeFeedId = navId;
  state.activeCategory = null;
  state.selectedArticleId = null;
  
  document.querySelectorAll('.feed-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.id === `nav-${navId}`);
  });
  
  const titles = { today: 'Today\'s updates', new: 'New Articles', saved: 'Saved for Later', all: 'All articles' };
  DOM.feedTitle.innerText = titles[navId] || 'Updates';
  
  closeDrawer();
  loadArticles();
}

async function selectArticle(articleId) {
  state.selectedArticleId = articleId;
  
  // Highlight in stream
  document.querySelectorAll('.article-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === articleId);
  });
  
  const article = state.articles.find(a => a.id === articleId);
  if (!article) return;
  
  // Populate drawer
  DOM.drawerFeedName.innerHTML = getJournalBadge(article.feedName, article.feedId);
  DOM.drawerDate.innerText = formatFullDate(article.pubDate);
  DOM.drawerTitle.innerText = article.title;
  DOM.drawerAuthors.innerText = `By ${formatAuthorsList(article.author)}`;
  DOM.drawerContent.innerText = stripHTML(article.content);
  
  // DOI or ID resolution
  if (article.doi) {
    DOM.drawerDoiContainer.classList.remove('hidden');
    DOM.drawerDoiLink.innerText = article.doi;
    
    let resolvedUrl = '';
    if (/^arxiv:/i.test(article.doi)) {
      const id = article.doi.replace(/^arxiv:/i, '').trim();
      resolvedUrl = `https://arxiv.org/abs/${id}`;
    } else {
      resolvedUrl = `https://doi.org/${article.doi}`;
    }
    
    DOM.drawerDoiLink.href = resolvedUrl;
  } else {
    DOM.drawerDoiContainer.classList.add('hidden');
  }
  DOM.drawerExternalLink.href = article.link;
  
  // Star button state
  DOM.drawerStarBtn.className = `icon-btn tooltip ${article.starred ? 'starred' : ''}`;
  DOM.drawerStarBtn.dataset.tooltip = article.starred ? 'Remove Bookmark (S)' : 'Save for later (S)';
  DOM.drawerStarBtn.innerHTML = article.starred ? '<i data-lucide="star" class="starred" style="fill: var(--star-color); stroke: var(--star-color)"></i>' : '<i data-lucide="star"></i>';
  
  // Read button state
  DOM.drawerReadBtn.className = `icon-btn tooltip ${article.read ? 'is-read' : ''}`;
  DOM.drawerReadBtn.dataset.tooltip = article.read ? 'Mark as Unread (R)' : 'Mark as Read (R)';
  DOM.drawerReadBtn.innerHTML = article.read ? '<i data-lucide="mail-open"></i>' : '<i data-lucide="check"></i>';
  
  lucide.createIcons();
  
  // Slide drawer open
  DOM.detailDrawer.classList.add('open');
  
  // Auto-mark as read if unread
  if (!article.read) {
    article.read = true;
    const itemEl = document.querySelector(`.article-item[data-id="${articleId}"]`);
    if (itemEl) {
      itemEl.classList.add('read');
      if (state.showUnreadOnly) {
        setTimeout(() => {
          // If we are in unread list, don't delete immediately to let the user read, but it will vanish on refresh
        }, 100);
      }
    }
    await API.markRead(articleId, true);
    await refreshSidebar();
    await updateBadgeCounts(await API.getStatus());
  }
}

// --- Action bar controls ---
function updateLayoutButtons() {
  const modes = ['list', 'magazine', 'cards'];
  modes.forEach(mode => {
    const btn = DOM[`layout${capitalize(mode)}Btn`];
    if (btn) btn.classList.toggle('active', state.viewMode === mode);
  });
}

function updateFilterButtons() {
  DOM.filterUnreadBtn.classList.toggle('active', state.showUnreadOnly);
  DOM.filterAllBtn.classList.toggle('active', !state.showUnreadOnly);
}

// --- Real-time Feed Fetching Status (SSE Progress Monitor) ---
function initSSE() {
  const eventSource = new EventSource('/api/refresh-stream');
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'start') {
      state.isRefreshing = true;
      DOM.progressBanner.classList.remove('hidden');
      DOM.progressBar.style.width = '0%';
      DOM.progressText.innerText = 'Initializing feed updates...';
      DOM.progressPercentage.innerText = '0%';
      
      // Animate refresh icon spin
      DOM.refreshIcon.classList.add('lucide-spin');
    }
    else if (data.type === 'progress') {
      const percentage = Math.min(Math.max(Math.round((data.current / data.total) * 100), 0), 100);
      DOM.progressBar.style.width = `${percentage}%`;
      DOM.progressPercentage.innerText = `${percentage}%`;
      
      let message = `Fetching ${data.feedName}...`;
      if (data.status === 'done' && data.newCount > 0) {
        message += ` Found ${data.newCount} new article(s).`;
        showToast(`${data.feedName}: ${data.newCount} new articles!`);
      } else if (data.status === 'fallback') {
        message += data.message ? ` ${data.message}` : ` Used fallback content.`;
      }
      DOM.progressText.innerText = message;
    }
    else if (data.type === 'complete') {
      state.isRefreshing = false;
      DOM.progressBar.style.width = '100%';
      DOM.progressPercentage.innerText = '100%';
      DOM.progressText.innerText = 'Updates complete!';
      
      setTimeout(() => {
        DOM.progressBanner.classList.add('hidden');
        DOM.refreshIcon.classList.remove('lucide-spin');
      }, 1000);
      
      showToast('All journal feeds refreshed successfully!', 'success');
      
      // Reload everything, then keep focus within the current category if unread items exist.
      refreshSidebar().then(() => {
        if (!jumpToNextUnreadFeedInCurrentCategory({ excludeCurrentFeed: false, showEmptyToast: true })) {
          loadArticles();
        }
      }).catch((err) => {
        console.error('Failed to refresh sidebar after feed update:', err);
        loadArticles();
      });
    }
    else if (data.type === 'error') {
      state.isRefreshing = false;
      DOM.progressBanner.classList.add('hidden');
      DOM.refreshIcon.classList.remove('lucide-spin');
      showToast(data.message || 'Feed refresh stopped unexpectedly.');
    }
  };

  eventSource.onerror = (err) => {
    console.error('SSE connection lost, reconnecting...');
    DOM.refreshIcon.classList.remove('lucide-spin');
  };
}

// --- Events Bindings ---
function bindEvents() {
  
  // Navigation Links
  DOM.navToday.addEventListener('click', (e) => { e.preventDefault(); selectQuickNav('today'); });
  DOM.navNew.addEventListener('click', (e) => { e.preventDefault(); selectQuickNav('new'); });
  DOM.navSaved.addEventListener('click', (e) => { e.preventDefault(); selectQuickNav('saved'); });
  DOM.navAll.addEventListener('click', (e) => { e.preventDefault(); selectQuickNav('all'); });

  // Advanced Search Filters
  DOM.applyFiltersBtn.addEventListener('click', () => {
    loadArticles();
  });
  DOM.filterJournalSelect.addEventListener('change', () => loadArticles());
  DOM.filterSortSelect.addEventListener('change', () => loadArticles());
  DOM.resetFiltersBtn.addEventListener('click', () => {
    DOM.filterAuthorInput.value = '';
    DOM.filterJournalSelect.value = '';
    DOM.filterStartDate.value = '';
    DOM.filterEndDate.value = '';
    DOM.filterSortSelect.value = 'newest';
    loadArticles();
  });

  // Sidebar controls
  DOM.menuToggleBtn.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('open');
  });
  
  // Light/Dark mode toggling
  DOM.themeToggleBtn.addEventListener('click', async () => {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      DOM.themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
      await API.saveSettings({ theme: 'light' });
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      DOM.themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
      await API.saveSettings({ theme: 'dark' });
    }
    lucide.createIcons();
  });
  
  // Help shortcuts guide
  DOM.keyboardHelpBtn.addEventListener('click', () => {
    DOM.keyboardModal.classList.remove('hidden');
  });
  DOM.keyboardModalCloseBtn.addEventListener('click', () => {
    DOM.keyboardModal.classList.add('hidden');
  });
  
  // Filter modes (Unread vs All)
  DOM.filterUnreadBtn.addEventListener('click', async () => {
    state.showUnreadOnly = true;
    updateFilterButtons();
    await API.saveSettings({ showUnreadOnly: true });
    loadArticles();
  });
  DOM.filterAllBtn.addEventListener('click', async () => {
    state.showUnreadOnly = false;
    updateFilterButtons();
    await API.saveSettings({ showUnreadOnly: false });
    loadArticles();
  });

  // Layout View mode switches
  DOM.layoutListBtn.addEventListener('click', async () => {
    state.viewMode = 'list';
    updateLayoutButtons();
    await API.saveSettings({ viewMode: 'list' });
    renderArticles();
  });
  DOM.layoutMagazineBtn.addEventListener('click', async () => {
    state.viewMode = 'magazine';
    updateLayoutButtons();
    await API.saveSettings({ viewMode: 'magazine' });
    renderArticles();
  });
  DOM.layoutCardsBtn.addEventListener('click', async () => {
    state.viewMode = 'cards';
    updateLayoutButtons();
    await API.saveSettings({ viewMode: 'cards' });
    renderArticles();
  });

  // Refresh feed trigger
  DOM.refreshBtn.addEventListener('click', async () => {
    if (state.isRefreshing) return;
    try {
      const result = await API.triggerRefresh();
      if (result.status === 'already-running') {
        showToast('A feed refresh is already running.');
      }
    } catch (err) {
      console.error('Failed to start feed refresh:', err);
      showToast('Could not start feed refresh.');
    }
  });

  // Drawer toggles
  DOM.drawerCloseBtn.addEventListener('click', closeDrawer);
  DOM.drawerCopyCitationBtn.addEventListener('click', () => {
    const article = state.articles.find(item => item.id === state.selectedArticleId);
    if (article) copyArticleCitation(article);
  });
  
  DOM.drawerStarBtn.addEventListener('click', async () => {
    if (!state.selectedArticleId) return;
    const article = state.articles.find(a => a.id === state.selectedArticleId);
    if (!article) return;
    
    const nextStarred = !article.starred;
    article.starred = nextStarred;
    
    // Toggle state in drawer UI
    DOM.drawerStarBtn.classList.toggle('starred', nextStarred);
    DOM.drawerStarBtn.dataset.tooltip = nextStarred ? 'Remove Bookmark (S)' : 'Save for later (S)';
    DOM.drawerStarBtn.innerHTML = nextStarred ? '<i data-lucide="star" class="starred" style="fill: var(--star-color); stroke: var(--star-color)"></i>' : '<i data-lucide="star"></i>';
    lucide.createIcons();
    
    // Toggle in stream
    const itemEl = document.querySelector(`.article-item[data-id="${state.selectedArticleId}"]`);
    if (itemEl) {
      const starBtn = itemEl.querySelector('.star-toggle');
      if (starBtn) starBtn.classList.toggle('starred', nextStarred);
    }
    
    await API.markStarred(article.id, nextStarred);
    await updateBadgeCounts(await API.getStatus());
  });

  DOM.drawerReadBtn.addEventListener('click', async () => {
    if (!state.selectedArticleId) return;
    const article = state.articles.find(a => a.id === state.selectedArticleId);
    if (!article) return;
    
    const nextRead = !article.read;
    article.read = nextRead;
    
    // Toggle in drawer UI
    DOM.drawerReadBtn.classList.toggle('is-read', nextRead);
    DOM.drawerReadBtn.dataset.tooltip = nextRead ? 'Mark as Unread (R)' : 'Mark as Read (R)';
    DOM.drawerReadBtn.innerHTML = nextRead ? '<i data-lucide="mail-open"></i>' : '<i data-lucide="check"></i>';
    lucide.createIcons();
    
    // Toggle in stream
    const itemEl = document.querySelector(`.article-item[data-id="${state.selectedArticleId}"]`);
    if (itemEl) {
      itemEl.classList.toggle('read', nextRead);
    }
    
    await API.markRead(article.id, nextRead);
    await refreshSidebar();
    await updateBadgeCounts(await API.getStatus());
  });

  // Modal: Add Feed Actions
  DOM.addFeedBtn.addEventListener('click', () => {
    DOM.feedModal.classList.remove('hidden');
    DOM.feedNameInput.focus();
  });
  
  const closeFeedModal = () => {
    DOM.feedModal.classList.add('hidden');
    DOM.feedForm.reset();
  };
  
  DOM.feedModalCloseBtn.addEventListener('click', closeFeedModal);
  DOM.feedModalCancelBtn.addEventListener('click', closeFeedModal);
  
  DOM.feedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = DOM.feedNameInput.value.trim();
    const url = DOM.feedUrlInput.value.trim();
    const category = DOM.feedCategoryInput.value.trim();
    
    try {
      showToast('Adding feed and downloading metadata...', 'info');
      const addedFeed = await API.addFeed(name, url, category);
      showToast(`Feed "${name}" added successfully!`, 'success');
      closeFeedModal();
      
      // Reload sidebar & article view
      await refreshSidebar();
      await selectFeed(addedFeed.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Modal: Edit Feed Actions
  const closeEditModal = () => {
    DOM.editFeedModal.classList.add('hidden');
    DOM.editFeedForm.reset();
  };
  DOM.editFeedModalCloseBtn.addEventListener('click', closeEditModal);
  DOM.editFeedCancelBtn.addEventListener('click', closeEditModal);
  
  DOM.editFeedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = DOM.editFeedId.value;
    const name = DOM.editFeedName.value.trim();
    const category = DOM.editFeedCategory.value.trim();
    const url = DOM.editFeedUrl.value.trim();
    
    await API.updateFeed(id, { name, category, url });
    showToast('Feed updated successfully!', 'success');
    closeEditModal();
    
    await refreshSidebar();
    if (state.activeFeedId === id) {
      selectFeed(id);
    }
  });

  DOM.editFeedDeleteBtn.addEventListener('click', async () => {
    const id = DOM.editFeedId.value;
    const name = DOM.editFeedName.value;
    if (confirm(`Are you sure you want to delete "${name}"? All downloaded articles from this journal will be removed.`)) {
      await API.deleteFeed(id);
      showToast('Feed deleted successfully.', 'success');
      closeEditModal();
      
      await refreshSidebar();
      selectQuickNav('today');
    }
  });

  // Search Input Debouncing & clearing
  let searchTimeout;
  DOM.searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    DOM.clearSearchBtn.classList.toggle('hidden', val === '');
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = val;
      loadArticles();
    }, 400);
  });
  
  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    state.searchQuery = '';
    DOM.clearSearchBtn.classList.add('hidden');
    loadArticles();
  });

  // Keyboard Navigation Bindings
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Close modals on clicking backdrop overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });
}

// Open feed edit/delete settings modal
function openEditFeedModal(feed) {
  DOM.editFeedId.value = feed.id;
  DOM.editFeedName.value = feed.name;
  DOM.editFeedCategory.value = feed.category;
  DOM.editFeedUrl.value = feed.url;
  
  DOM.editFeedModal.classList.remove('hidden');
}

function closeDrawer() {
  DOM.detailDrawer.classList.remove('open');
  state.selectedArticleId = null;
  document.querySelectorAll('.article-item').forEach(el => el.classList.remove('selected'));
}

// --- Keyboard Navigation Shortcuts Parser ---
async function handleKeyboardShortcuts(e) {
  // If user is focused on input text boxes, skip shortcuts
  const activeTag = document.activeElement.tagName.toLowerCase();
  if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
    return;
  }

  // Handle escape to close panels/modals
  if (e.key === 'Escape') {
    closeDrawer();
    DOM.feedModal.classList.add('hidden');
    DOM.editFeedModal.classList.add('hidden');
    DOM.keyboardModal.classList.add('hidden');
    return;
  }

  switch(e.key) {
    case '/':
      e.preventDefault();
      DOM.searchInput.focus();
      break;

    case '?':
      // Toggle help cheat sheet
      DOM.keyboardModal.classList.toggle('hidden');
      break;

    case 'j':
      // Next Article
      navigateStream(1);
      break;

    case 'k':
      // Previous Article
      navigateStream(-1);
      break;

    case 'r':
      // Toggle read status of active selected article
      if (state.selectedArticleId) {
        const article = state.articles.find(a => a.id === state.selectedArticleId);
        if (article) {
          const nextRead = !article.read;
          article.read = nextRead;
          
          const itemEl = document.querySelector(`.article-item[data-id="${state.selectedArticleId}"]`);
          if (itemEl) itemEl.classList.toggle('read', nextRead);
          
          // Drawer update
          DOM.drawerReadBtn.classList.toggle('is-read', nextRead);
          DOM.drawerReadBtn.innerHTML = nextRead ? '<i data-lucide="mail-open"></i>' : '<i data-lucide="check"></i>';
          lucide.createIcons();
          
          await API.markRead(article.id, nextRead);
          await refreshSidebar();
          await updateBadgeCounts(await API.getStatus());
        }
      }
      break;

    case 's':
      // Toggle Star / Bookmark status of selected article
      if (state.selectedArticleId) {
        const article = state.articles.find(a => a.id === state.selectedArticleId);
        if (article) {
          const nextStarred = !article.starred;
          article.starred = nextStarred;
          
          const itemEl = document.querySelector(`.article-item[data-id="${state.selectedArticleId}"]`);
          if (itemEl) {
            const star = itemEl.querySelector('.star-toggle');
            if (star) star.classList.toggle('starred', nextStarred);
          }
          
          // Drawer update
          DOM.drawerStarBtn.classList.toggle('starred', nextStarred);
          DOM.drawerStarBtn.innerHTML = nextStarred ? '<i data-lucide="star" style="fill: var(--star-color); stroke: var(--star-color)"></i>' : '<i data-lucide="star"></i>';
          lucide.createIcons();
          
          await API.markStarred(article.id, nextStarred);
          await updateBadgeCounts(await API.getStatus());
        }
      }
      break;

    case 'o':
      // Toggle Open drawer on highlighted selection
      if (state.selectedArticleId) {
        if (DOM.detailDrawer.classList.contains('open')) {
          closeDrawer();
        } else {
          selectArticle(state.selectedArticleId);
        }
      } else if (state.articles.length > 0) {
        selectArticle(state.articles[0].id);
      }
      break;

    case 'v':
      // Visit original publisher website in a new tab
      if (state.selectedArticleId) {
        const article = state.articles.find(a => a.id === state.selectedArticleId);
        if (article && article.link) {
          window.open(article.link, '_blank');
        }
      }
      break;

    case 'c': {
      const article = state.articles.find(item => item.id === state.selectedArticleId);
      if (article) copyArticleCitation(article);
      break;
    }
  }
}

// Navigate selected article up/down stream
function navigateStream(direction) {
  if (state.articles.length === 0) return;
  
  let targetIndex = 0;
  if (state.selectedArticleId) {
    const currentIndex = state.articles.findIndex(a => a.id === state.selectedArticleId);
    targetIndex = currentIndex + direction;
  }
  
  // Boundary check
  if (targetIndex < 0) targetIndex = 0;
  if (targetIndex >= state.articles.length) targetIndex = state.articles.length - 1;
  
  const targetArticle = state.articles[targetIndex];
  selectArticle(targetArticle.id);
  
  // Scroll target article row into view smoothly
  const targetRow = document.querySelector(`.article-item[data-id="${targetArticle.id}"]`);
  if (targetRow) {
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// --- Utils & String Helpers ---

function extractDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.hostname;
  } catch (err) {
    return 'pubs.acs.org'; // default fallback
  }
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  if (diffMins < 60) {
    return `${diffMins <= 0 ? 1 : diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function stripHTML(htmlStr) {
  if (!htmlStr) return '';
  const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
  return doc.body.textContent || "";
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatAuthorsList(authorString) {
  if (!authorString || authorString === 'Staff Writers' || authorString === 'Unknown') {
    return authorString || 'Unknown';
  }
  
  // Clean ROR links or affiliation metadata sometimes appended by PNAS or Wiley
  let cleaned = authorString.replace(/https:\/\/ror\.org\/[a-z0-9]+/g, '');
  cleaned = cleaned.replace(/[a-z0-9]{9,}\b/g, ''); // strip random id hashes
  
  // Replace "and" with comma
  cleaned = cleaned.replace(/\s+and\s+/gi, ', ');
  
  // Split by comma or semicolon
  const authors = cleaned.split(/[;,]/).map(a => a.trim()).filter(Boolean);
  
  if (authors.length <= 3) {
    return authorString;
  }
  
  // Format as: First Author, et al., Last Author
  return `${authors[0]}, et al., ${authors[authors.length - 1]}`;
}

function buildArticleCitation(article) {
  const authors = stripHTML(article.author || 'Unknown author').replace(/\s+/g, ' ').trim();
  const date = new Date(article.pubDate);
  const year = Number.isNaN(date.getTime()) ? 'n.d.' : date.getFullYear();
  const journal = stripHTML(article.feedName || '');
  const url = article.doi
    ? (/^arxiv:/i.test(article.doi)
      ? `https://arxiv.org/abs/${article.doi.replace(/^arxiv:/i, '').trim()}`
      : `https://doi.org/${article.doi}`)
    : article.link;
  const source = journal ? ` ${journal}.` : '';

  return `${authors} (${year}). ${stripHTML(article.title || 'Untitled article')}.${source}${url ? ` ${url}` : ''}`;
}

async function copyArticleCitation(article) {
  const citation = buildArticleCitation(article);

  try {
    await navigator.clipboard.writeText(citation);
  } catch (err) {
    const fallback = document.createElement('textarea');
    fallback.value = citation;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand('copy');
    fallback.remove();
  }

  showToast('Citation copied to clipboard.', 'success');
}

// Toast Alerts Generator
function showToast(message, type = 'info') {
  const container = DOM.toastContainer;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-triangle';
  if (type === 'warning') icon = 'alert-circle';
  
  toast.innerHTML = `
    <i data-lucide="${icon}" style="width:18px; height:18px; flex-shrink:0;"></i>
    <span>${escapeHTML(message)}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Fade out and remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}
