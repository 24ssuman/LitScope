'use strict';

/**
 * The shipped journal catalog lives here. Add an RSS-backed journal by adding
 * one object with an id, display name, RSS URL, and category. Special source
 * URLs are kept in the same registry so each source can retain its own
 * ingestion path without another server-side catalog.
 */
const DEFAULT_JOURNALS = [
  // Category: Comp Chem
  {
    id: 'jcc',
    name: 'JCC',
    url: 'https://onlinelibrary.wiley.com/feed/1096987x/most-recent',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://onlinelibrary.wiley.com/journal/1096987x',
    crossref: { issn: '1096-987X', rows: 20 }
  },
  {
    id: 'jcp',
    name: 'JCP',
    url: 'https://pubs.aip.org/rss/site_1000043/1000024.xml',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://pubs.aip.org/aip/jcp',
    crossref: { issn: '1089-7690', rows: 20 }
  },
  {
    id: 'jctc',
    name: 'JCTC',
    url: 'https://pubs.acs.org/action/showFeed?jc=jctcce&type=etoc&feed=rss',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/jctcce',
    crossref: { issn: '1549-9618', rows: 20 }
  },
  {
    id: 'jpca',
    name: 'JPC A',
    url: 'https://pubs.acs.org/action/showFeed?jc=jpcafh&type=etoc&feed=rss',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/jpcafh',
    crossref: { issn: '1520-5215', rows: 20 }
  },
  {
    id: 'jpcb',
    name: 'JPC B',
    url: 'https://pubs.acs.org/action/showFeed?jc=jpcbfk&type=etoc&feed=rss',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/jpcbfk',
    crossref: { issn: '1520-5207', rows: 20 }
  },
  {
    id: 'jpcc',
    name: 'JPC C',
    url: 'https://pubs.acs.org/action/showFeed?jc=jpchax&type=etoc&feed=rss',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/jpchax',
    crossref: { issn: '1932-7455', rows: 20 }
  },
  {
    id: 'jpcletts',
    name: 'JPC Letts',
    url: 'https://pubs.acs.org/action/showFeed?jc=jpclcd&type=etoc&feed=rss',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/jpclcd',
    crossref: { issn: '1948-7185', rows: 20 }
  },
  {
    id: 'pccp',
    name: 'PCCP',
    url: 'https://feeds.feedburner.com/rsc/pccp',
    category: 'Comp Chem',
    source: 'rss',
    homepage: 'https://pubs.rsc.org/en/journals/journalissues/cp',
    crossref: { issn: '1463-9084', rows: 20 }
  },

  // Category: Chem
  {
    id: 'chemphyschem',
    name: 'Chem Phys Chem',
    url: 'https://onlinelibrary.wiley.com/feed/14397641/most-recent',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://onlinelibrary.wiley.com/journal/14397641',
    crossref: { issn: '1439-7641', rows: 20 }
  },
  {
    id: 'natchem',
    name: 'Nat Chem',
    url: 'https://www.nature.com/nchem.rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.nature.com/nchem',
    crossref: { issn: '1755-4349', rows: 20 }
  },
  {
    id: 'natcommun',
    name: 'Nat Commun',
    url: 'https://www.nature.com/ncomms.rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.nature.com/ncomms',
    crossref: { issn: '2041-1723', rows: 20 }
  },
  {
    id: 'natmat',
    name: 'Nat Mat',
    url: 'https://www.nature.com/nmat.rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.nature.com/nmat',
    crossref: { issn: '1476-4660', rows: 20 }
  },
  {
    id: 'nature',
    name: 'Nature',
    url: 'https://www.nature.com/nature.rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.nature.com/nature',
    crossref: { issn: '1476-4687', rows: 20 }
  },
  {
    id: 'pnas',
    name: 'PNAS',
    url: 'https://www.pnas.org/rss/current.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.pnas.org',
    crossref: { issn: '1091-6490', rows: 20 }
  },
  {
    id: 'scientificreports',
    name: 'Scientific Reports',
    url: 'https://www.nature.com/srep.rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.nature.com/srep',
    crossref: { issn: '2045-2322', rows: 20 }
  },
  {
    id: 'acscat',
    name: 'ACS Cat.',
    url: 'https://pubs.acs.org/action/showFeed?jc=accacs&type=etoc&feed=rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/accacs',
    crossref: { issn: '2155-5435', rows: 20 }
  },
  {
    id: 'acsnano',
    name: 'ACS Nano',
    url: 'https://pubs.acs.org/action/showFeed?jc=ancac3&type=etoc&feed=rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/ancac3',
    crossref: { issn: '1936-086X', rows: 20 }
  },
  {
    id: 'acsnanomat',
    name: 'ACS Nano Mat',
    url: 'https://pubs.acs.org/action/showFeed?jc=aanmf6&type=etoc&feed=rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/aanmf6',
    crossref: { issn: '2694-2461', rows: 20 }
  },
  {
    id: 'chemmat',
    name: 'Chem Mat',
    url: 'https://pubs.acs.org/action/showFeed?jc=cmatex&type=etoc&feed=rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/cmatex',
    crossref: { issn: '1520-5002', rows: 20 }
  },
  {
    id: 'chemsci',
    name: 'Chem. Sci.',
    url: 'https://feeds.feedburner.com/rsc/chemicalscience',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.rsc.org/en/journals/journalissues/sc',
    crossref: { issn: '2041-6539', rows: 20 }
  },
  {
    id: 'faradaydiscussion',
    name: 'Faraday Discussion',
    url: 'https://feeds.feedburner.com/rsc/faradaydiscussions',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.rsc.org/en/journals/journalissues/fd',
    crossref: { issn: '1364-5498', rows: 20 }
  },
  {
    id: 'jacs',
    name: 'JACS',
    url: 'https://pubs.acs.org/action/showFeed?jc=jacsat&type=etoc&feed=rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/jacsat',
    crossref: { issn: '1520-5126', rows: 20 }
  },
  {
    id: 'nanolett',
    name: 'Nano Lett',
    url: 'https://pubs.acs.org/action/showFeed?jc=nalefd&type=etoc&feed=rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/nalefd',
    crossref: { issn: '1530-6992', rows: 20 }
  },
  {
    id: 'natrevchem',
    name: 'Nat Rev Chem',
    url: 'https://www.nature.com/nrevchem.rss',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.nature.com/nrevchem',
    crossref: { issn: '2397-3358', rows: 20 }
  },
  {
    id: 'pnaschemistry',
    name: 'PNAS: Chemistry',
    url: 'https://www.pnas.org/rss/chemistry.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.pnas.org',
    crossref: { issn: '1091-6490', rows: 20 }
  },
  {
    id: 'sciadv',
    name: 'Sci. Adv.',
    url: 'https://www.science.org/rss/advances.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.science.org/journal/sciadv',
    crossref: { issn: '2375-2548', rows: 20 }
  },
  {
    id: 'science',
    name: 'Science',
    url: 'https://www.science.org/rss/current.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.science.org/journal/science',
    crossref: { issn: '1095-9203', rows: 20 }
  },
  {
    id: 'sciencefirstrelease',
    name: 'Science First Release',
    url: 'https://www.science.org/rss/express.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.science.org/journal/science',
    crossref: { issn: '1095-9203', rows: 20 }
  },

  // Category: arXiv preprints. These are separate sources from ChemRxiv and
  // query the official arXiv Atom API independently by subject category.
  {
    id: 'arxiv-stat-mech',
    name: 'arXiv:stat-mech',
    url: 'https://export.arxiv.org/api/query?search_query=cat%3Acond-mat.stat-mech&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending',
    category: 'Comp Chem',
    source: 'arxiv',
    homepage: 'https://arxiv.org/list/cond-mat.stat-mech'
  },
  {
    id: 'arxiv-chem-ph',
    name: 'arXiv:chem-ph',
    url: 'https://export.arxiv.org/api/query?search_query=cat%3Aphysics.chem-ph&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending',
    category: 'Comp Chem',
    source: 'arxiv',
    homepage: 'https://arxiv.org/list/physics.chem-ph'
  },
  {
    id: 'chemical-reviews',
    name: 'Chem. Rev.',
    url: 'https://pubs.acs.org/rss/chreay/asap.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/chreay',
    crossref: { issn: '0009-2665', rows: 20 }
  },
  {
    id: 'accounts-chemical-research',
    name: 'Acc. Chem. Res.',
    url: 'https://pubs.acs.org/rss/achre4/asap.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://pubs.acs.org/journal/achre4',
    crossref: { issn: '0001-4842', rows: 20 }
  },
  {
    id: 'annual-review-physical-chemistry',
    name: 'Annu. Rev. Phys. Chem.',
    url: 'https://www.annualreviews.org/action/showFeed?ai=sy&feed=atom&jc=physchem&mi=3fndc3&type=etoc&ui=45mu4',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://www.annualreviews.org/content/journals/physchem',
    crossref: { issn: '0066-426X', rows: 20 }
  },
  {
    id: 'prl',
    name: 'Phys. Rev. Lett.',
    url: 'https://feeds.aps.org/rss/recent/prl.xml',
    category: 'Chem',
    source: 'rss',
    homepage: 'https://journals.aps.org/prl',
    crossref: { issn: '0031-9007', rows: 20 }
  },

  // Category: ChemRxiv preprints. These retain their existing non-RSS
  // API/Crossref fallback path and remain independent from arXiv.
  {
    id: 'chemrxiv-tcc',
    name: 'ChemRxiv: Theo/Comp',
    url: 'chemrxiv://theoretical-and-computational-chemistry',
    category: 'Comp Chem',
    source: 'chemrxiv',
    homepage: 'https://chemrxiv.org/engage/chemrxiv/search-dashboard?categoryIds=605c704b6c174a001015cca0',
    categoryId: '605c704b6c174a001015cca0'
  },
  {
    id: 'chemrxiv-pc',
    name: 'ChemRxiv: Phys Chem',
    url: 'chemrxiv://physical-chemistry',
    category: 'Comp Chem',
    source: 'chemrxiv',
    homepage: 'https://chemrxiv.org/engage/chemrxiv/search-dashboard?categoryIds=605c704b6c174a001015cc9e',
    categoryId: '605c704b6c174a001015cc9e'
  }
];

function inferSource(url) {
  const normalized = String(url || '').trim().toLowerCase();
  if (normalized.startsWith('chemrxiv://')) return 'chemrxiv';

  try {
    const parsed = new URL(normalized);
    if (
      parsed.pathname === '/api/query'
      && (parsed.hostname === 'export.arxiv.org' || parsed.hostname === 'arxiv.org')
      && parsed.searchParams.has('search_query')
    ) {
      return 'arxiv';
    }
  } catch (err) {
    // Validation below reports malformed URLs with the existing message.
  }

  return 'rss';
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function inferPublisher(value) {
  const url = String(value || '').trim().toLowerCase();
  if (url.startsWith('chemrxiv://') || url.includes('chemrxiv.org')) return 'ChemRxiv';
  if (url.includes('arxiv.org')) return 'arXiv';
  try {
    const host = new URL(url).hostname;
    if (host.includes('acs.org')) return 'ACS';
    if (host.includes('rsc.org') || url.includes('feedburner.com/rsc/')) return 'RSC';
    if (host.includes('aip.org')) return 'AIP';
    if (host.includes('aps.org')) return 'APS';
    if (host.includes('annualreviews.org')) return 'Annual Reviews';
    if (host.includes('wiley.com')) return 'Wiley';
    if (host.includes('nature.com')) return 'Nature';
    if (host.includes('pnas.org')) return 'PNAS';
    if (host.includes('science.org')) return 'AAAS';
  } catch (err) {
    // Custom or malformed URLs are grouped below as their own source.
  }
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Other';
  } catch (err) {
    return 'Other';
  }
}

function getJournalPublishers(definitions = DEFAULT_JOURNALS) {
  validateJournalDefinitions(definitions);
  return Object.fromEntries(definitions.map(journal => [journal.id, journal.publisher || inferPublisher(journal.url)]));
}

function isSupportedFeedUrl(value) {
  const url = String(value || '').trim();
  return inferSource(url) === 'chemrxiv' || isHttpUrl(url);
}

function validateJournalDefinitions(definitions = DEFAULT_JOURNALS) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new Error('Journal definitions must be a non-empty array');
  }

  const ids = new Set();
  definitions.forEach((journal, index) => {
    const label = `journal definition ${index + 1}`;
    if (!journal || typeof journal !== 'object') {
      throw new Error(`${label} must be an object`);
    }

    ['id', 'name', 'url', 'category'].forEach(field => {
      if (!String(journal[field] || '').trim()) {
        throw new Error(`${label} is missing ${field}`);
      }
    });

    if (!/^[a-z0-9][a-z0-9-]*$/.test(journal.id)) {
      throw new Error(`${label} id must contain lowercase letters, numbers, or hyphens`);
    }
    if (ids.has(journal.id)) {
      throw new Error(`Duplicate journal id: ${journal.id}`);
    }
    ids.add(journal.id);

    const source = journal.source || inferSource(journal.url);
    if (!['rss', 'chemrxiv', 'arxiv'].includes(source)) {
      throw new Error(`${label} has unsupported source: ${source}`);
    }
    if (!isSupportedFeedUrl(journal.url)) {
      throw new Error(`${label} must use an HTTP(S) RSS/arXiv URL or chemrxiv:// URL`);
    }
    if (source === 'rss' && inferSource(journal.url) !== 'rss') {
      throw new Error(`${label} marked as rss must use an HTTP(S) URL`);
    }
    if (source === 'chemrxiv' && !String(journal.categoryId || '').trim()) {
      throw new Error(`${label} is missing its ChemRxiv categoryId`);
    }
    if (source === 'arxiv' && inferSource(journal.url) !== 'arxiv') {
      throw new Error(`${label} marked as arxiv must use an arXiv API query URL`);
    }
    if (journal.homepage !== undefined && !isHttpUrl(journal.homepage)) {
      throw new Error(`${label} homepage must be an HTTP(S) URL`);
    }

    if (journal.crossref !== undefined) {
      const issn = String(journal.crossref.issn || '').trim();
      if (!/^\d{4}-?\d{3}[\dXx]$/.test(issn)) {
        throw new Error(`${label} has an invalid Crossref ISSN`);
      }
      const rows = journal.crossref.rows === undefined ? 20 : journal.crossref.rows;
      if (!Number.isInteger(rows) || rows < 1) {
        throw new Error(`${label} Crossref rows must be a positive integer`);
      }
    }
  });

  return true;
}

function createDefaultFeeds(definitions = DEFAULT_JOURNALS) {
  validateJournalDefinitions(definitions);
  return definitions.map(({ id, name, url, category }) => ({ id, name, url, category }));
}

function getJournalHomepages(definitions = DEFAULT_JOURNALS) {
  validateJournalDefinitions(definitions);
  return Object.fromEntries(
    definitions
      .filter(journal => journal.homepage)
      .map(journal => [journal.id, journal.homepage])
  );
}

function getCrossrefFallbacks(definitions = DEFAULT_JOURNALS) {
  validateJournalDefinitions(definitions);
  return Object.fromEntries(
    definitions
      .filter(journal => journal.crossref)
      .map(journal => [journal.id, { ...journal.crossref }])
  );
}

function getChemRxivCategories(definitions = DEFAULT_JOURNALS) {
  validateJournalDefinitions(definitions);
  return Object.fromEntries(
    definitions
      .filter(journal => journal.source === 'chemrxiv' || inferSource(journal.url) === 'chemrxiv')
      .map(journal => [journal.id, journal.categoryId])
  );
}

function slugifyFeedName(name) {
  const id = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id || null;
}

validateJournalDefinitions();

module.exports = {
  DEFAULT_JOURNALS,
  createDefaultFeeds,
  getChemRxivCategories,
  getCrossrefFallbacks,
  getJournalHomepages,
  getJournalPublishers,
  inferPublisher,
  inferSource,
  isSupportedFeedUrl,
  slugifyFeedName,
  validateJournalDefinitions
};
