const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Parser = require('rss-parser');
const { createCrossrefClient } = require('./crossref-client');
const { resolveArticleReadState } = require('./article-read-state');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure RSS Parser with browser headers
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  timeout: 15000
});

// Default Feeds matching screenshots
const DEFAULT_FEEDS = [
  // Category: Comp Chem
  { id: 'jcc', name: 'JCC', url: 'https://onlinelibrary.wiley.com/feed/1096987x/most-recent', category: 'Comp Chem' },
  { id: 'jcp', name: 'JCP', url: 'https://pubs.aip.org/rss/site_1000043/1000024.xml', category: 'Comp Chem' },
  { id: 'jctc', name: 'JCTC', url: 'https://pubs.acs.org/action/showFeed?jc=jctcce&type=etoc&feed=rss', category: 'Comp Chem' },
  { id: 'jpca', name: 'JPC A', url: 'https://pubs.acs.org/action/showFeed?jc=jpcafh&type=etoc&feed=rss', category: 'Comp Chem' },
  { id: 'jpcb', name: 'JPC B', url: 'https://pubs.acs.org/action/showFeed?jc=jpcbfk&type=etoc&feed=rss', category: 'Comp Chem' },
  { id: 'jpcc', name: 'JPC C', url: 'https://pubs.acs.org/action/showFeed?jc=jpchax&type=etoc&feed=rss', category: 'Comp Chem' },
  { id: 'jpcletts', name: 'JPC Letts', url: 'https://pubs.acs.org/action/showFeed?jc=jpclcd&type=etoc&feed=rss', category: 'Comp Chem' },
  { id: 'pccp', name: 'PCCP', url: 'https://feeds.feedburner.com/rsc/pccp', category: 'Comp Chem' },

  // Category: Chem
  { id: 'chemphyschem', name: 'Chem Phys Chem', url: 'https://onlinelibrary.wiley.com/feed/14397641/most-recent', category: 'Chem' },
  { id: 'natchem', name: 'Nat Chem', url: 'https://www.nature.com/nchem.rss', category: 'Chem' },
  { id: 'natcommun', name: 'Nat Commun', url: 'https://www.nature.com/ncomms.rss', category: 'Chem' },
  { id: 'natmat', name: 'Nat Mat', url: 'https://www.nature.com/nmat.rss', category: 'Chem' },
  { id: 'nature', name: 'Nature', url: 'https://www.nature.com/nature.rss', category: 'Chem' },
  { id: 'pnas', name: 'PNAS', url: 'https://www.pnas.org/rss/current.xml', category: 'Chem' },
  { id: 'scientificreports', name: 'Scientific Reports', url: 'https://www.nature.com/srep.rss', category: 'Chem' },
  { id: 'acscat', name: 'ACS Cat.', url: 'https://pubs.acs.org/action/showFeed?jc=accacs&type=etoc&feed=rss', category: 'Chem' },
  { id: 'acsnano', name: 'ACS Nano', url: 'https://pubs.acs.org/action/showFeed?jc=ancac3&type=etoc&feed=rss', category: 'Chem' },
  { id: 'acsnanomat', name: 'ACS Nano Mat', url: 'https://pubs.acs.org/action/showFeed?jc=aanmf6&type=etoc&feed=rss', category: 'Chem' },
  { id: 'chemmat', name: 'Chem Mat', url: 'https://pubs.acs.org/action/showFeed?jc=cmatex&type=etoc&feed=rss', category: 'Chem' },
  { id: 'chemsci', name: 'Chem. Sci.', url: 'https://feeds.feedburner.com/rsc/chemicalscience', category: 'Chem' },
  { id: 'faradaydiscussion', name: 'Faraday Discussion', url: 'https://feeds.feedburner.com/rsc/faradaydiscussions', category: 'Chem' },
  { id: 'jacs', name: 'JACS', url: 'https://pubs.acs.org/action/showFeed?jc=jacsat&type=etoc&feed=rss', category: 'Chem' },
  { id: 'nanolett', name: 'Nano Lett', url: 'https://pubs.acs.org/action/showFeed?jc=nalefd&type=etoc&feed=rss', category: 'Chem' },
  { id: 'natrevchem', name: 'Nat Rev Chem', url: 'https://www.nature.com/nrevchem.rss', category: 'Chem' },
  { id: 'pnaschemistry', name: 'PNAS: Chemistry', url: 'https://www.pnas.org/rss/chemistry.xml', category: 'Chem' },
  { id: 'sciadv', name: 'Sci. Adv.', url: 'https://www.science.org/rss/advances.xml', category: 'Chem' },
  { id: 'science', name: 'Science', url: 'https://www.science.org/rss/current.xml', category: 'Chem' },
  { id: 'sciencefirstrelease', name: 'Science First Release', url: 'https://www.science.org/rss/express.xml', category: 'Chem' },

  // Category: Preprints
  { id: 'chemrxiv-tcc', name: 'ChemRxiv: Theo/Comp', url: 'chemrxiv://theoretical-and-computational-chemistry', category: 'Comp Chem' },
  { id: 'chemrxiv-pc', name: 'ChemRxiv: Phys Chem', url: 'chemrxiv://physical-chemistry', category: 'Comp Chem' }
];

// Helper templates for realistic mock research articles
const MOCK_RESEARCH_TEMPLATES = {
  chemistry: {
    titles: [
      "Nickel-Catalyzed Cross-Coupling of Unactivated Alkyl Halides with Arylsilanes",
      "Total Synthesis of (+)-Lycopladine A via Catalytic Enantioselective Carbonyl-Ene Reaction",
      "Enzyme-Mimetic Supramolecular Catalysts for Organic Transesterification in Water",
      "High-Throughput Screen Identifies Novel Small Molecules Inhibiting SARS-CoV-2 Main Protease",
      "Chiral Phosphoric Acid-Catalyzed Asymmetric Synthesis of Spirooxindoles",
      "Direct Photocatalytic C–H Functionalization of Arenes Using Metal-Free Organic Dyes",
      "Dynamic Covalent Assemblies for Selective Recognition of Polyphosphates in Physiological Media",
      "A Bio-Inspired Artificial Metalloenzyme for Enantioselective Sulfoxidation Reactions"
    ],
    abstracts: [
      "We report a nickel-catalyzed cross-coupling method that links unactivated secondary and primary alkyl iodides and bromides with arylsilanes under mild conditions. The reaction operates via a radical pathway and tolerates a wide range of functional groups, including esters, amides, and unprotected alcohols.",
      "The first total synthesis of (+)-lycopladine A, a tetracyclic Lycopodium alkaloid, has been achieved in 12 steps from commercially available starting materials. The key step involves a highly diastereoselective intramolecular carbonyl-ene reaction catalyzed by a chiral Lewis acid.",
      "Supramolecular cages constructed from self-assembled organic ligands exhibit high catalytic efficiency for transesterification reactions in aqueous environments. The hydrophobic cavity stabilizes transition states, accelerating reaction rates by four orders of magnitude compared to background rates.",
      "A library of 10,000 synthetic compounds was screened in search of novel inhibitors of the SARS-CoV-2 main protease. Lead optimization yielded two compounds with sub-nanomolar binding affinities and excellent pharmacokinetic profiles in rodent models.",
      "An efficient asymmetric synthesis of spirooxindole derivatives has been developed using chiral phosphoric acids as organocatalysts. The reaction delivers products in up to 98% yield and 99% enantiomeric excess under mild operational conditions.",
      "Here we describe a light-driven, metal-free protocol for the direct functionalization of aromatic C-H bonds. By utilizing a newly synthesized phenanthridinium-based photocatalyst, a broad array of coupling partners are introduced at room temperature under blue LED irradiation.",
      "We present a class of dynamic covalent macrocycles designed for the selective binding of ATP and ADP in water. The receptor relies on synergistic hydrogen bonding and electrostatic interactions, showing a 50-fold selectivity over monophosphates.",
      "By anchoring a synthetic manganese complex within a modified beta-barrel protein scaffold, we constructed an artificial metalloenzyme. The hybrid catalyst achieves up to 94% enantiomeric excess in the oxidation of thioanisole derivatives."
    ],
    authors: [
      "L. Wei, K. Sato, and M. Tanaka",
      "S. Smith, R. Davis, and A. Miller",
      "M. Rossi, G. Bianchi, and A. Silva",
      "J. P. Dupont, H. Schneider, and M. Lefevre",
      "H. Chen, Y. Wang, and Z. Zhang"
    ]
  },
  comp_chem: {
    titles: [
      "Machine Learning Potentials for Accurate Prediction of Transition State Structures",
      "High-Throughput Density Functional Theory Screening of Solid-State Electrolytes",
      "Deep Learning Model for Predicting Solvation Free Energies in Non-Aqueous Solvents",
      "Quantum Chemical Analysis of Cooperativity in Cation–pi Interactions",
      "A Parallelized Algorithm for Excited-State Calculations in Large Molecular Aggregates",
      "Assessment of Density Functional Tight Binding (DFTB) for Metal-Organic Frameworks",
      "Neural Network Directed Enhanced Sampling of Complex Protein Folding Trajectories",
      "Accurate Reaction Barriers via Composite Wavefunction Methods and Machine Learning"
    ],
    abstracts: [
      "We introduce a machine learning potential trained on coupled-cluster calculations to predict transition state geometries and activation barriers. The model reduces computational cost by five orders of magnitude while preserving chemical accuracy within 1 kcal/mol.",
      "Using high-throughput density functional theory (DFT), we screened over 5,000 crystalline lithium-containing compounds to identify candidate solid-state electrolytes. We analyze ionic conductivity, electrochemical stability windows, and mechanical properties to propose three new structural classes.",
      "A graph convolutional neural network is developed to predict solvation free energies of organic molecules in a dataset of 150 solvents. The model outperforms traditional PCM-based solvation models and requires only milliseconds of inference time.",
      "We present a systematic ab initio investigation of cooperativity in complexes featuring multiple cation-pi interactions. Symmetry-adapted perturbation theory (SAPT) decomposition reveals that polarization and induction forces dominate the non-additive cooperative energy.",
      "We present a new domain-decomposition algorithm optimized for massive parallel GPU architectures. The implementation speeds up time-dependent DFT calculations of molecular aggregates containing up to 10,000 atoms by two orders of magnitude.",
      "We benchmark several density functional tight binding parameter sets against high-level DFT calculations for breathing modes and guest-adsorption curves in metal-organic frameworks (MOFs), identifying key limitations in current repulsive potentials.",
      "By combining deep neural networks with metadynamics, we constructed a bias potential that accelerates the simulation of large-scale conformational transitions in proteins. We successfully fold three fast-folding proteins in under 100 nanoseconds of simulation time.",
      "A composite quantum-chemical method is coupled with an active learning framework to calculate accurate chemical reaction pathways. This hybrid approach automatically selects regions of high uncertainty for refinement at the CCSD(T) level."
    ],
    authors: [
      "A. Kovalenko, E. Rostova, and I. Petrov",
      "J. Doe, J. Smith, and K. Johnson",
      "T. H. Fischer, M. Almlof, and P. Pulay",
      "Y. Liu, H. Kim, and Y. Jung",
      "R. Bastian, M. Parrinello, and U. Rothlisberger"
    ]
  }
};

// Database State
let db = {
  feeds: [],
  articles: [],
  settings: {
    theme: 'dark',
    viewMode: 'magazine',
    showUnreadOnly: true
  }
};

// Load database from file
function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      db = JSON.parse(raw);
      // Fallback if data structure is corrupted or missing fields
      if (!db.feeds) db.feeds = [];
      if (!db.articles) db.articles = [];
      if (!db.settings) db.settings = { theme: 'dark', viewMode: 'magazine', showUnreadOnly: true };
    } else {
      // Initialize database with defaults
      db.feeds = DEFAULT_FEEDS.map(f => ({
        ...f,
        lastFetched: null,
        status: 'ok',
        errorMessage: null
      }));
      db.articles = [];
      saveDB();
    }
  } catch (err) {
    console.error('Error loading database, resetting:', err);
    db.feeds = DEFAULT_FEEDS.map(f => ({
      ...f,
      lastFetched: null,
      status: 'ok',
      errorMessage: null
    }));
    db.articles = [];
  }

  // Initialize persistent read history tracking
  loadReadHistory();
  let imported = false;
  db.articles.forEach(art => {
    if (art.read) {
      const cleanLink = art.link ? art.link.split('#')[0].trim() : '';
      const normDoi = art.doi ? normalizeDoi(art.doi) : '';
      if (normDoi && !readHistory.has(normDoi)) {
        readHistory.add(normDoi);
        imported = true;
      }
      if (cleanLink && !readHistory.has(cleanLink)) {
        readHistory.add(cleanLink);
        imported = true;
      }
    }
  });
  if (imported) {
    saveReadHistory();
  }
}

// Persistent Read History helper functions
const READ_HISTORY_PATH = path.join(__dirname, 'read_history.json');
let readHistory = new Set();

function loadReadHistory() {
  try {
    if (fs.existsSync(READ_HISTORY_PATH)) {
      const raw = fs.readFileSync(READ_HISTORY_PATH, 'utf8');
      const list = JSON.parse(raw);
      readHistory = new Set(list);
    } else {
      readHistory = new Set();
      saveReadHistory();
    }
  } catch (err) {
    console.error('Error loading read history:', err);
    readHistory = new Set();
  }
}

function saveReadHistory() {
  try {
    const list = Array.from(readHistory);
    fs.writeFileSync(READ_HISTORY_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving read history:', err);
  }
}

function addArticleToReadHistory(doi, link) {
  let changed = false;
  if (doi) {
    const normDoi = normalizeDoi(doi);
    if (normDoi && !readHistory.has(normDoi)) {
      readHistory.add(normDoi);
      changed = true;
    }
  }
  if (link) {
    const cleanLink = link.split('#')[0].trim();
    if (cleanLink && !readHistory.has(cleanLink)) {
      readHistory.add(cleanLink);
      changed = true;
    }
  }
  if (changed) {
    saveReadHistory();
  }
}

function removeArticleFromReadHistory(doi, link) {
  let changed = false;
  if (doi) {
    const normDoi = normalizeDoi(doi);
    if (normDoi && readHistory.has(normDoi)) {
      readHistory.delete(normDoi);
      changed = true;
    }
  }
  if (link) {
    const cleanLink = link.split('#')[0].trim();
    if (cleanLink && readHistory.has(cleanLink)) {
      readHistory.delete(cleanLink);
      changed = true;
    }
  }
  if (changed) {
    saveReadHistory();
  }
}

function isArticleInReadHistory(doi, link) {
  if (doi) {
    const normDoi = normalizeDoi(doi);
    if (normDoi && readHistory.has(normDoi)) return true;
  }
  if (link) {
    const cleanLink = link.split('#')[0].trim();
    if (cleanLink && readHistory.has(cleanLink)) return true;
  }
  return false;
}

// Save database to file
const CSV_PATH = path.join(__dirname, 'articles_archive.csv');

function writeCSVArchive(articles) {
  try {
    const csvHeaders = ['Article Name', 'Authors', 'Journal Name', 'Date Published', 'DOI'];
    const articleKeys = ['title', 'author', 'feedName', 'pubDate', 'doi'];
    
    const rows = [csvHeaders.join(',')];
    
    articles.forEach(art => {
      const row = articleKeys.map(key => {
        let val = art[key];
        if (val === undefined || val === null) {
          val = '';
        } else {
          val = String(val);
        }
        // Escape double quotes and wrap in double quotes if there are commas, quotes, or newlines
        const escaped = val.replace(/"/g, '""');
        if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
          return `"${escaped}"`;
        }
        return escaped;
      });
      rows.push(row.join(','));
    });
    
    fs.writeFileSync(CSV_PATH, rows.join('\n'), 'utf8');
  } catch (err) {
    console.error('Error writing CSV archive:', err);
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    writeCSVArchive(db.articles);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// Generate unique ID based on a string (e.g., link or GUID)
function generateId(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

function extractDoiFromFeedItem(item) {
  const sourceLink = item.link || item.guid || '';
  const guid = item.guid || item.link || '';

  return extractDOI(
    sourceLink,
    guid,
    item.doi,
    item.DOI,
    item['dc:identifier'],
    item['prism:doi'],
    item['dc:source'],
    item.categories,
    item.content,
    item['content:encoded'],
    item.description,
    item.summary,
    item.contentSnippet
  );
}


// Mapping of default journal feed IDs to their real homepages to ensure working external links
const HOMEPAGES = {
  jcc: 'https://onlinelibrary.wiley.com/journal/1096987x',
  jcp: 'https://pubs.aip.org/aip/jcp',
  jctc: 'https://pubs.acs.org/journal/jctcce',
  jpca: 'https://pubs.acs.org/journal/jpcafh',
  jpcb: 'https://pubs.acs.org/journal/jpcbfk',
  jpcc: 'https://pubs.acs.org/journal/jpchax',
  jpcletts: 'https://pubs.acs.org/journal/jpclcd',
  pccp: 'https://pubs.rsc.org/en/journals/journalissues/cp',
  chemphyschem: 'https://onlinelibrary.wiley.com/journal/14397641',
  natchem: 'https://www.nature.com/nchem',
  natcommun: 'https://www.nature.com/ncomms',
  natmat: 'https://www.nature.com/nmat',
  nature: 'https://www.nature.com/nature',
  pnas: 'https://www.pnas.org',
  scientificreports: 'https://www.nature.com/srep',
  acscat: 'https://pubs.acs.org/journal/accacs',
  acsnano: 'https://pubs.acs.org/journal/ancac3',
  acsnanomat: 'https://pubs.acs.org/journal/aanmf6',
  chemmat: 'https://pubs.acs.org/journal/cmatex',
  chemsci: 'https://pubs.rsc.org/en/journals/journalissues/sc',
  faradaydiscussion: 'https://pubs.rsc.org/en/journals/journalissues/fd',
  jacs: 'https://pubs.acs.org/journal/jacsat',
  nanolett: 'https://pubs.acs.org/journal/nalefd',
  natrevchem: 'https://www.nature.com/nrevchem',
  pnaschemistry: 'https://www.pnas.org',
  sciadv: 'https://www.science.org/journal/sciadv',
  science: 'https://www.science.org/journal/science',
  sciencefirstrelease: 'https://www.science.org/journal/science',
  'chemrxiv-tcc': 'https://chemrxiv.org/engage/chemrxiv/search-dashboard?categoryIds=605c704b6c174a001015cca0',
  'chemrxiv-pc': 'https://chemrxiv.org/engage/chemrxiv/search-dashboard?categoryIds=605c704b6c174a001015cc9e'
};

// Extract standard DOI or arXiv ID from article fields
function extractDOI(...fields) {
  const text = fields.flatMap(field => Array.isArray(field) ? field : [field])
    .filter(field => field !== null && field !== undefined)
    .map(field => {
      if (typeof field === 'object') return Object.values(field).join(' ');
      return String(field);
    })
    .join(' ')
    .toLowerCase();
  
  // Look for standard DOI format: 10.xxxx/yyyy
  const doiMatch = text.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i);
  if (doiMatch) {
    let doi = doiMatch[0];
    if (doi.endsWith('.') || doi.endsWith(',') || doi.endsWith(';')) {
      doi = doi.slice(0, -1);
    }
    return doi;
  }
  
  // Look for arXiv identifier
  const arxivMatch = text.match(/arxiv:(\d{4}\.\d{4,5}(v\d+)?)/i);
  if (arxivMatch) {
    return arxivMatch[0];
  }
  
  const arxivMatch2 = text.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i);
  if (arxivMatch2) {
    return `arXiv:${arxivMatch2[1]}`;
  }

  return null;
}

function resolveArticleLinkFromDoi(sourceLink, doi) {
  const cleanedDoi = String(doi || '').trim();
  if (!cleanedDoi) return sourceLink || '';

  if (cleanedDoi.startsWith('arXiv:')) {
    const arxivId = cleanedDoi.replace('arXiv:', '').trim();
    return `https://arxiv.org/abs/${arxivId}`;
  }

  if (/^10\.\d{4,9}\//i.test(cleanedDoi)) {
    return `https://doi.org/${cleanedDoi}`;
  }

  return sourceLink || '';
}

function normalizeArticleForSave(article) {
  if (String(article.feedId || '').startsWith('chemrxiv')) return article;

  const doi = normalizeDoi(article.doi);
  const link = resolveArticleLinkFromDoi(article.link, doi);
  const normalizedArticle = { ...article, doi };

  if (doi && link) {
    normalizedArticle.link = link;
    normalizedArticle.guid = `${link}#doi-${doi}`;
    normalizedArticle.id = generateId(normalizedArticle.guid);
  }

  return normalizedArticle;
}

function repairConfiguredFeedUrls() {
  let repairedCount = 0;
  const feedUrlUpdates = {
    jcp: 'https://pubs.aip.org/rss/site_1000043/1000024.xml'
  };

  db.feeds.forEach(feed => {
    const updatedUrl = feedUrlUpdates[feed.id];
    if (updatedUrl && feed.url !== updatedUrl) {
      feed.url = updatedUrl;
      feed.lastFetched = null;
      repairedCount++;
    }
  });

  return repairedCount;
}

function repairGeneratedFallbackArticleLinks() {
  let repairedCount = 0;

  db.articles.forEach(article => {
    if (String(article.feedId || '').startsWith('chemrxiv')) return;
    if (!String(article.guid || '').includes('#doi-')) return;

    const feed = db.feeds.find(f => f.id === article.feedId);
    const fallbackLink = HOMEPAGES[article.feedId] || (feed && feed.url) || '';
    const guidBase = String(article.guid).split('#doi-')[0];

    if (fallbackLink && guidBase === fallbackLink && article.doi) {
      article.link = fallbackLink;
      article.doi = '';
      repairedCount++;
    }
  });

  return repairedCount;
}

function pruneGeneratedFallbackArticles() {
  const beforeCount = db.articles.length;

  db.articles = db.articles.filter(article => {
    if (String(article.feedId || '').startsWith('chemrxiv')) return true;
    const guid = String(article.guid || '');
    if (guid.includes('#mock-')) return false;
    if (!guid.includes('#doi-')) return true;

    const feed = db.feeds.find(f => f.id === article.feedId);
    const fallbackLink = HOMEPAGES[article.feedId] || (feed && feed.url) || '';
    const guidBase = guid.split('#doi-')[0];
    return !(fallbackLink && guidBase === fallbackLink && !article.doi);
  });

  return beforeCount - db.articles.length;
}

function repairNonChemRxivArticleLinksFromDoi() {
  let repairedCount = 0;

  db.articles.forEach(article => {
    if (String(article.feedId || '').startsWith('chemrxiv')) return;
    const resolvedLink = resolveArticleLinkFromDoi(article.link, article.doi);
    if (resolvedLink && resolvedLink !== article.link) {
      article.link = resolvedLink;
      repairedCount++;
    }
  });

  return repairedCount;
}

// ChemRxiv custom API fetcher (no RSS available)
const CHEMRXIV_CATEGORIES = {
  'chemrxiv-tcc': '605c704b6c174a001015cca0', // Theoretical and Computational Chemistry
  'chemrxiv-pc': '605c704b6c174a001015cc9e'   // Physical Chemistry
};

const CHEMRXIV_CROSSREF_DAYS = 30;
const CHEMRXIV_CROSSREF_ROWS = 100;
const CHEMRXIV_API_BLOCK_COOLDOWN_MS = 6 * 60 * 60 * 1000;
let chemRxivApiBlockedUntil = 0;
const CROSSREF_USER_AGENT = process.env.CROSSREF_USER_AGENT || 'LitScope/1.0 (ChemRxiv metadata fallback)';
const CROSSREF_MAILTO = process.env.CROSSREF_MAILTO || '';
const CROSSREF_MIN_INTERVAL_MS = Number(process.env.CROSSREF_MIN_INTERVAL_MS || 350);
const CROSSREF_MAX_RETRIES = Number(process.env.CROSSREF_MAX_RETRIES || 2);
const crossrefClient = createCrossrefClient({
  userAgent: CROSSREF_USER_AGENT,
  mailto: CROSSREF_MAILTO,
  minIntervalMs: Number.isFinite(CROSSREF_MIN_INTERVAL_MS) ? Math.max(0, CROSSREF_MIN_INTERVAL_MS) : 350,
  maxRetries: Number.isFinite(CROSSREF_MAX_RETRIES) ? Math.max(0, CROSSREF_MAX_RETRIES) : 2
});

const JOURNAL_CROSSREF_FALLBACKS = {
  jcc: { issn: '1096-987X', rows: 20 },
  jcp: { issn: '1089-7690', rows: 20 },
  jctc: { issn: '1549-9618', rows: 20 },
  jpca: { issn: '1520-5215', rows: 20 },
  jpcb: { issn: '1520-5207', rows: 20 },
  jpcc: { issn: '1932-7455', rows: 20 },
  jpcletts: { issn: '1948-7185', rows: 20 },
  pccp: { issn: '1463-9084', rows: 20 },
  chemphyschem: { issn: '1439-7641', rows: 20 },
  natchem: { issn: '1755-4349', rows: 20 },
  natcommun: { issn: '2041-1723', rows: 20 },
  natmat: { issn: '1476-4660', rows: 20 },
  nature: { issn: '1476-4687', rows: 20 },
  pnas: { issn: '1091-6490', rows: 20 },
  pnaschemistry: { issn: '1091-6490', rows: 20 },
  scientificreports: { issn: '2045-2322', rows: 20 },
  acscat: { issn: '2155-5435', rows: 20 },
  acsnano: { issn: '1936-086X', rows: 20 },
  acsnanomat: { issn: '2694-2461', rows: 20 },
  chemmat: { issn: '1520-5002', rows: 20 },
  chemsci: { issn: '2041-6539', rows: 20 },
  faradaydiscussion: { issn: '1364-5498', rows: 20 },
  jacs: { issn: '1520-5126', rows: 20 },
  nanolett: { issn: '1530-6992', rows: 20 },
  natrevchem: { issn: '2397-3358', rows: 20 },
  sciadv: { issn: '2375-2548', rows: 20 },
  science: { issn: '1095-9203', rows: 20 },
  sciencefirstrelease: { issn: '1095-9203', rows: 20 }
};

const CHEMRXIV_CATEGORY_KEYWORDS = {
  'chemrxiv-tcc': [
    'ab initio',
    'algorithm',
    'automated',
    'benchmark',
    'computational',
    'data set',
    'dataset',
    'density functional',
    'dft',
    'electronic structure',
    'force field',
    'free energy',
    'graphical model',
    'machine learning',
    'mlp',
    'molecular dynamics',
    'monte carlo',
    'neural',
    'quantum chemical',
    'quantum chemistry',
    'qsar',
    'reaction template',
    'sampling',
    'scf',
    'simulation',
    'theoretical',
    'trajectory',
    'workflow'
  ],
  'chemrxiv-pc': [
    'catalysis',
    'catalyst',
    'catalytic',
    'charge transfer',
    'dielectric',
    'electrocatalysis',
    'electrochemical',
    'electron transfer',
    'excited state',
    'fluorescence',
    'infrared',
    'kinetic',
    'kinetics',
    'mechanism',
    'nanocluster',
    'oxidation',
    'photochemistry',
    'photoluminescence',
    'phosphorescence',
    'physical chemistry',
    'raman',
    'redox',
    'spectroscopy',
    'spin',
    'surface',
    'thermodynamic',
    'ultrafast',
    'vibrational'
  ]
};

function stripMarkup(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDoi(doi) {
  return String(doi || '').trim().toLowerCase();
}

function getCrossrefTitle(item) {
  const title = Array.isArray(item.title) ? item.title[0] : item.title;
  return stripMarkup(title) || 'Untitled Preprint';
}

function normalizeTitle(title) {
  return stripMarkup(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isCoverOrIndex(title) {
  const t = stripMarkup(title).toLowerCase().replace(/[^a-z0-9\s]+/g, '').trim();
  return (
    t.startsWith('front cover') ||
    t.startsWith('back cover') ||
    t.startsWith('inside front cover') ||
    t.startsWith('inside back cover') ||
    t.startsWith('inside backcover') ||
    t.startsWith('inside frontcover') ||
    t.startsWith('issue information') ||
    t.startsWith('table of contents') ||
    t.startsWith('contents') ||
    t.startsWith('graphic') ||
    t.startsWith('masthead') ||
    t === 'contents list' ||
    t === 'content list'
  );
}

function getCrossrefDateParts(item) {
  return item.published?.['date-parts']?.[0]
    || item.posted?.['date-parts']?.[0]
    || item.created?.['date-parts']?.[0]
    || item.deposited?.['date-parts']?.[0]
    || null;
}

function getCrossrefDate(item) {
  const parts = getCrossrefDateParts(item);
  if (!Array.isArray(parts) || !parts[0]) {
    // No date-parts at all — try created.date-time
    if (item.created?.['date-time']) return new Date(item.created['date-time']).toISOString();
    return null;
  }
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  // If only year is present (no month), prefer the full-precision created.date-time
  if (!month && item.created?.['date-time']) {
    return new Date(item.created['date-time']).toISOString();
  }
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).toISOString();
}

function getCrossrefTimestamp(item) {
  const date = getCrossrefDate(item);
  return date ? new Date(date).getTime() : 0;
}

function getChemRxivDoiBase(doi) {
  return normalizeDoi(doi).replace(/\/v\d+$/i, '').replace(/-v\d+$/i, '');
}

function formatCrossrefAuthors(authors) {
  if (!Array.isArray(authors) || authors.length === 0) return 'Unknown';

  const names = authors.map(author => {
    if (author.name) return author.name;
    return [author.given, author.family].filter(Boolean).join(' ').trim();
  }).filter(Boolean);

  return names.length > 0 ? names.join(', ') : 'Unknown';
}

function crossrefItemToJournalArticle(item, feed, now) {
  const doi = normalizeDoi(item.DOI);
  const link = resolveArticleLinkFromDoi(item.URL || HOMEPAGES[feed.id] || feed.url, doi);
  const guid = `${link}#doi-${doi}`;
  const title = getCrossrefTitle(item);
  const existing = db.articles.find(a => (
    a.id === generateId(guid)
    || (a.feedId === feed.id && normalizeDoi(a.doi) === doi)
    || (
      a.feedId === feed.id
      && !a.doi
      && normalizeTitle(a.title) === normalizeTitle(title)
    )
  ));
  const id = existing ? existing.id : generateId(guid);
  const pubDate = getCrossrefDate(item) || now.toISOString();

  const isRead = resolveArticleReadState(existing, isArticleInReadHistory(doi, link));

  return {
    id,
    feedId: feed.id,
    feedName: feed.name,
    title,
    link,
    guid,
    doi,
    author: formatCrossrefAuthors(item.author),
    pubDate,
    content: stripMarkup(item.abstract) || 'No abstract available.',
    read: isRead,
    starred: existing ? existing.starred : false,
    fetchedAt: existing ? existing.fetchedAt : now.toISOString()
  };
}

async function fetchJournalFromCrossref(feed, count = 20) {
  const config = JOURNAL_CROSSREF_FALLBACKS[feed.id];
  if (!config) return [];

  const apiUrl = new URL(`https://api.crossref.org/journals/${encodeURIComponent(config.issn)}/works`);
  apiUrl.searchParams.set('sort', 'created');
  apiUrl.searchParams.set('order', 'desc');
  apiUrl.searchParams.set('rows', String(Math.max(config.rows || 0, count)));

  const data = await crossrefClient.getJson(apiUrl);
  const now = new Date();
  const seen = new Set();

  return (data.message?.items || [])
    .filter(item => {
      const doi = normalizeDoi(item.DOI);
      if (!doi || seen.has(doi)) return false;
      
      const title = getCrossrefTitle(item);
      if (isCoverOrIndex(title)) return false;

      seen.add(doi);
      return true;
    })
    .slice(0, count)
    .map(item => crossrefItemToJournalArticle(item, feed, now));
}

function chemRxivLinkFromDoi(doi) {
  return `https://chemrxiv.org/doi/abs/${normalizeDoi(doi)}`;
}

function scoreChemRxivCategory(item, feedId) {
  const keywords = CHEMRXIV_CATEGORY_KEYWORDS[feedId] || [];
  const text = [
    getCrossrefTitle(item),
    stripMarkup(item.abstract),
    Array.isArray(item.subject) ? item.subject.join(' ') : ''
  ].join(' ').toLowerCase();

  return keywords.reduce((score, keyword) => (
    text.includes(keyword) ? score + 1 : score
  ), 0);
}

function crossrefItemToChemRxivArticle(item, feed, now) {
  const doi = normalizeDoi(item.DOI);
  const link = chemRxivLinkFromDoi(doi);
  const guid = `${link}#doi-${doi}`;
  const id = generateId(guid);
  const existing = db.articles.find(a => (
    a.id === id
    || (a.feedId === feed.id && normalizeDoi(a.doi) === doi)
  ));
  const pubDate = getCrossrefDate(item) || now.toISOString();

  const isRead = resolveArticleReadState(existing, isArticleInReadHistory(doi, link));

  return {
    id,
    feedId: feed.id,
    feedName: feed.name,
    title: getCrossrefTitle(item),
    link,
    guid,
    doi,
    author: formatCrossrefAuthors(item.author),
    pubDate,
    content: stripMarkup(item.abstract) || 'No abstract available.',
    read: isRead,
    starred: existing ? existing.starred : false,
    fetchedAt: existing ? existing.fetchedAt : now.toISOString()
  };
}

async function fetchChemRxivFromCrossref(feed, count = 20) {
  const fromDate = new Date(Date.now() - CHEMRXIV_CROSSREF_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .split('T')[0];
  const apiUrl = new URL('https://api.crossref.org/works');
  apiUrl.searchParams.set('filter', `prefix:10.26434,from-pub-date:${fromDate}`);
  apiUrl.searchParams.set('sort', 'published');
  apiUrl.searchParams.set('order', 'desc');
  apiUrl.searchParams.set('rows', String(CHEMRXIV_CROSSREF_ROWS));

  const data = await crossrefClient.getJson(apiUrl);
  const now = new Date();
  const seen = new Set();
  const candidates = (data.message?.items || []).reduce((acc, item) => {
    const doi = normalizeDoi(item.DOI);
    const title = getCrossrefTitle(item);
    const doiBase = getChemRxivDoiBase(doi);
    if (!doi || !title || seen.has(doiBase) || isCoverOrIndex(title)) return acc;

    seen.add(doiBase);
    const score = scoreChemRxivCategory(item, feed.id);
    if (score === 0) return acc;

    acc.push({ item: { ...item, DOI: doi }, score });
    return acc;
  }, []);

  return candidates
    .sort((a, b) => getCrossrefTimestamp(b.item) - getCrossrefTimestamp(a.item) || b.score - a.score)
    .slice(0, count)
    .map(({ item }) => crossrefItemToChemRxivArticle(item, feed, now));
}

async function fetchChemRxiv(feed) {
  const categoryId = CHEMRXIV_CATEGORIES[feed.id];
  if (!categoryId) return [];

  if (Date.now() < chemRxivApiBlockedUntil) {
    const error = new Error('ChemRxiv direct API is temporarily unavailable from this network');
    error.status = 403;
    error.isExpectedAccessDenial = true;
    throw error;
  }
  
  const apiUrl = `https://chemrxiv.org/engage/chemrxiv/public-api/v1/items?categoryIds=${categoryId}&limit=20&sort=PUBLISHED_DATE_DESC&searchDateFrom=${new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = new Error(`ChemRxiv API returned ${response.status}`);
    error.status = response.status;
    if (response.status === 403) {
      chemRxivApiBlockedUntil = Date.now() + CHEMRXIV_API_BLOCK_COOLDOWN_MS;
      error.isExpectedAccessDenial = true;
    }
    throw error;
  }
  
  const data = await response.json();
  const now = new Date();
  
  return (data.itemHits || [])
    .map(hit => hit.item || hit)
    .filter(item => !isCoverOrIndex(item.title || ''))
    .map(item => {
    const doi = item.doi || null;
    const link = doi 
      ? `https://chemrxiv.org/doi/abs/${doi}` 
      : `https://chemrxiv.org/engage/chemrxiv/article-details/${item.id || item.preprintId || ''}`;
    const id = generateId(item.id || link);
    
    const existing = db.articles.find(a => a.id === id);
    const pubDate = item.publishedDate || item.statusDate || now.toISOString();

    const isRead = resolveArticleReadState(existing, isArticleInReadHistory(doi, link));
    
    return {
      id,
      feedId: feed.id,
      feedName: feed.name,
      title: item.title || 'Untitled Preprint',
      link,
      guid: item.id || link,
      doi,
      author: (item.authors || []).map(a => `${a.firstName || ''} ${a.lastName || ''}`).join(', ') || 'Unknown',
      pubDate,
      content: item.abstract || 'No abstract available.',
      read: isRead,
      starred: existing ? existing.starred : false,
      fetchedAt: existing ? existing.fetchedAt : now.toISOString()
    };
  });
}

function generateMocks(feed, count = 5) {
  return [];
}

function findArticleIndexForMerge(article) {
  const articleDoi = normalizeDoi(article.doi);
  return db.articles.findIndex(existing => (
    existing.id === article.id
    || (
      articleDoi
      && existing.feedId === article.feedId
      && normalizeDoi(existing.doi) === articleDoi
    )
    || (
      article.link
      && existing.feedId === article.feedId
      && existing.link === article.link
    )
  ));
}

function mergeArticle(article) {
  const normalizedArticle = normalizeArticleForSave(article);
  const idx = findArticleIndexForMerge(normalizedArticle);
  if (idx !== -1) {
    db.articles[idx] = {
      ...normalizedArticle,
      read: db.articles[idx].read,
      starred: db.articles[idx].starred,
      fetchedAt: db.articles[idx].fetchedAt || normalizedArticle.fetchedAt
    };
    return false;
  }

  db.articles.push(normalizedArticle);
  return true;
}

// Fetch a single feed and merge articles
async function fetchAndMergeFeed(feed, progressCallback) {
  if (progressCallback) progressCallback('fetching', feed);
  
  // Handle ChemRxiv custom API feeds (no RSS)
  if (feed.url.startsWith('chemrxiv://')) {
    try {
      const articles = await fetchChemRxiv(feed);
      let newCount = 0;
      articles.forEach(art => {
        if (mergeArticle(art)) newCount++;
      });
      feed.lastFetched = new Date().toISOString();
      feed.status = 'ok';
      feed.errorMessage = null;
      if (progressCallback) progressCallback('done', feed, newCount);
    } catch (err) {
      if (!err.isExpectedAccessDenial) {
        console.error(`Error fetching ChemRxiv feed ${feed.name}:`, err.message);
      }
      const now = new Date();
      try {
        const fallbackArticles = await fetchChemRxivFromCrossref(feed, 20);
        let newCount = 0;
        fallbackArticles.forEach(art => {
          if (mergeArticle(art)) newCount++;
        });
        feed.lastFetched = now.toISOString();
        feed.status = 'fallback';
        const sourceMessage = err.isExpectedAccessDenial
          ? 'ChemRxiv direct API is unavailable from this network.'
          : `ChemRxiv API failed: ${err.message}.`;
        feed.errorMessage = fallbackArticles.length > 0
          ? `${sourceMessage} Loaded verified DOI metadata from Crossref.`
          : `${sourceMessage} No verified fallback metadata was available.`;
        if (progressCallback) progressCallback('fallback', feed, newCount);
      } catch (fallbackErr) {
        console.error(`Error fetching ChemRxiv fallback ${feed.name}:`, fallbackErr.message);
        feed.lastFetched = now.toISOString();
        feed.status = 'fallback';
        const sourceMessage = err.isExpectedAccessDenial
          ? 'ChemRxiv direct API is unavailable from this network.'
          : `ChemRxiv API failed: ${err.message}.`;
        feed.errorMessage = `${sourceMessage} Crossref fallback failed: ${fallbackErr.message}.`;
        if (progressCallback) progressCallback('fallback', feed, 0);
      }
    }
    return;
  }

  let crossrefError = null;
  if (JOURNAL_CROSSREF_FALLBACKS[feed.id]) {
    try {
      const crossrefArticles = await fetchJournalFromCrossref(feed, 20);
      if (crossrefArticles.length > 0) {
        let newCount = 0;
        crossrefArticles.forEach(art => {
          if (mergeArticle(art)) newCount++;
        });
        feed.lastFetched = new Date().toISOString();
        feed.status = 'ok';
        feed.errorMessage = null;
        if (progressCallback) progressCallback('done', feed, newCount);
        return;
      }
    } catch (err) {
      crossrefError = err;
      console.error(`Error fetching Crossref journal feed ${feed.name}:`, err.message);
    }
  }

  try {
    const feedData = await parser.parseURL(feed.url);
    const now = new Date();
    
    let newCount = 0;
    const processedArticles = await Promise.all((feedData.items || [])
      .filter(item => !isCoverOrIndex(item.title || ''))
      .map(async item => {
      const sourceLink = item.link || item.guid || '';
      const guid = item.guid || item.link || '';
      const id = generateId(guid || sourceLink);
      
      // Parse pub date
      let pubDate = now.toISOString();
      if (item.pubDate) {
        pubDate = new Date(item.pubDate).toISOString();
      } else if (item.isoDate) {
        pubDate = new Date(item.isoDate).toISOString();
      }

      // Extract DOI or arXiv ID from metadata
      const doi = extractDoiFromFeedItem(item);
      const link = resolveArticleLinkFromDoi(sourceLink, doi);

      // Check if this article is already in the database
      const existing = db.articles.find(a => a.id === id);

      const isRead = resolveArticleReadState(existing, isArticleInReadHistory(doi, link));
      
      return {
        id,
        feedId: feed.id,
        feedName: feed.name,
        title: item.title || 'Untitled Article',
        link: link,
        guid: guid,
        doi: doi,
        author: item.creator || item.author || 'Staff Writers',
        pubDate: pubDate,
        content: item['content:encoded'] || item.content || item.description || item.contentSnippet || item.summary || 'No abstract available.',
        read: isRead,
        starred: existing ? existing.starred : false,
        fetchedAt: existing ? existing.fetchedAt : now.toISOString()
      };
    }));

    // Merge articles: keep existing ones, append new ones
    processedArticles.forEach(art => {
      if (mergeArticle(art)) newCount++;
    });

    feed.lastFetched = now.toISOString();
    feed.status = 'ok';
    feed.errorMessage = null;

    if (progressCallback) progressCallback('done', feed, newCount);
  } catch (err) {
    console.error(`Error fetching feed ${feed.name}:`, err.message);

    const now = new Date();
    const crossrefMessage = crossrefError
      ? ` Crossref retrieval was unavailable: ${crossrefError.message}.`
      : '';

    feed.lastFetched = now.toISOString();
    feed.status = 'fallback';
    feed.errorMessage = `RSS request failed: ${err.message}.${crossrefMessage} Existing saved articles were kept.`;

    if (progressCallback) progressCallback('fallback', feed, 0);
  }
}

// Express Routes

// 1. GET all feeds
app.get('/api/feeds', (req, res) => {
  // Compute unread counts and newest article date dynamically
  const feedsWithCounts = db.feeds.map(feed => {
    const feedArticles = db.articles.filter(a => a.feedId === feed.id);
    const unreadCount = feedArticles.filter(a => !a.read).length;
    const newestDate = feedArticles.length > 0 
      ? Math.max(...feedArticles.map(a => new Date(a.pubDate).getTime())) 
      : 0;
    return { ...feed, unreadCount, newestDate };
  });
  res.json({ feeds: feedsWithCounts });
});

// 2. POST add new feed
app.post('/api/feeds', async (req, res) => {
  const { name, url, category } = req.body;
  if (!name || !url || !category) {
    return res.status(400).json({ error: 'Name, url, and category are required' });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (db.feeds.find(f => f.id === id)) {
    return res.status(400).json({ error: `Feed with name/id "${name}" already exists` });
  }

  const newFeed = {
    id,
    name,
    url,
    category,
    lastFetched: null,
    status: 'ok',
    errorMessage: null
  };

  db.feeds.push(newFeed);
  saveDB();

  // Async fetch content immediately for the new feed
  fetchAndMergeFeed(newFeed).then(() => {
    saveDB();
  });

  res.status(201).json(newFeed);
});

// 3. PUT edit feed
app.put('/api/feeds/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, url } = req.body;
  const feed = db.feeds.find(f => f.id === id);
  if (!feed) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  if (name) feed.name = name;
  if (category) feed.category = category;
  if (url) {
    feed.url = url;
    feed.lastFetched = null; // force refetch
  }

  saveDB();
  res.json(feed);
});

// 4. DELETE feed
app.delete('/api/feeds/:id', (req, res) => {
  const { id } = req.params;
  const idx = db.feeds.findIndex(f => f.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  // Remove feed
  db.feeds.splice(idx, 1);
  // Remove related articles
  db.articles = db.articles.filter(a => a.feedId !== id);
  
  saveDB();
  res.json({ message: `Feed ${id} and all its articles deleted.` });
});

// 5. GET articles (with extensive filters)
app.get('/api/articles', (req, res) => {
  const { feedId, category, read, starred, search, author, startDate, endDate, sort = 'newest', limit = 50, offset = 0 } = req.query;
  
  let filtered = [...db.articles];

  // Feed filter
  if (feedId) {
    filtered = filtered.filter(a => a.feedId === feedId);
  }

  // Category filter
  if (category && !feedId) {
    const feedsInCategory = db.feeds.filter(f => f.category === category).map(f => f.id);
    filtered = filtered.filter(a => a.feedId && feedsInCategory.includes(a.feedId));
  }

  // Read filter
  if (read !== undefined) {
    const isRead = read === 'true';
    filtered = filtered.filter(a => a.read === isRead);
  }

  // Starred filter
  if (starred !== undefined) {
    const isStarred = starred === 'true';
    filtered = filtered.filter(a => a.starred === isStarred);
  }

  // Author filter
  if (author) {
    const qAuthor = author.toLowerCase();
    filtered = filtered.filter(a => a.author && a.author.toLowerCase().includes(qAuthor));
  }

  // Date range filters
  if (startDate) {
    const start = new Date(startDate);
    filtered = filtered.filter(a => new Date(a.pubDate) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter(a => new Date(a.pubDate) <= end);
  }

  // Search filter
  if (search) {
    const query = search.toLowerCase();
    filtered = filtered.filter(a => 
      (a.title && a.title.toLowerCase().includes(query)) ||
      (a.author && a.author.toLowerCase().includes(query)) ||
      (a.content && a.content.toLowerCase().includes(query)) ||
      (a.feedName && a.feedName.toLowerCase().includes(query)) ||
      (a.doi && a.doi.toLowerCase().includes(query))
    );
  }

  // Sort by the requested research-library order, with publication date as a stable tiebreaker.
  if (sort === 'oldest') {
    filtered.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
  } else if (sort === 'journal') {
    filtered.sort((a, b) => (
      String(a.feedName || '').localeCompare(String(b.feedName || '')) ||
      new Date(b.pubDate) - new Date(a.pubDate)
    ));
  } else {
    filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }

  const total = filtered.length;
  const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    articles: paginated,
    total,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
});

// 6. POST mark article read/unread
app.post('/api/articles/:id/read', (req, res) => {
  const { id } = req.params;
  const { read = true } = req.body;
  const article = db.articles.find(a => a.id === id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  article.read = read;
  if (read) {
    addArticleToReadHistory(article.doi, article.link);
  } else {
    removeArticleFromReadHistory(article.doi, article.link);
  }
  saveDB();
  res.json(article);
});

// 7. POST mark all articles as read (scoped to feed or category)
app.post('/api/articles/read-all', (req, res) => {
  const { feedId, category } = req.body;
  let count = 0;

  db.articles.forEach(article => {
    let match = false;
    if (feedId && article.feedId === feedId) {
      match = true;
    } else if (category && !feedId) {
      const feedsInCategory = db.feeds.filter(f => f.category === category).map(f => f.id);
      if (feedsInCategory.includes(article.feedId)) {
        match = true;
      }
    } else if (!feedId && !category) {
      match = true; // All articles
    }

    if (match && !article.read) {
      article.read = true;
      addArticleToReadHistory(article.doi, article.link);
      count++;
    }
  });

  if (count > 0) {
    saveDB();
  }

  res.json({ success: true, markedReadCount: count });
});

// 8. POST mark article starred/unstarred
app.post('/api/articles/:id/star', (req, res) => {
  const { id } = req.params;
  const { starred = true } = req.body;
  const article = db.articles.find(a => a.id === id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  article.starred = starred;
  saveDB();
  res.json(article);
});

// 9. SSE Feed Refresh endpoint for real-time progress bar
let clients = [];
let refreshInProgress = false;
app.get('/api/refresh-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);
  
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

function broadcastRefreshProgress(data) {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// Trigger manual refresh
app.post('/api/refresh', async (req, res) => {
  if (refreshInProgress) {
    return res.status(409).json({ status: 'already-running' });
  }

  const feedId = req.body && req.body.feedId ? req.body.feedId : null;
  refreshInProgress = true;
  res.json({ status: 'started' }); // Return immediately

  const feedsToFetch = feedId 
    ? db.feeds.filter(f => f.id === feedId)
    : db.feeds;

  let index = 0;
  const total = feedsToFetch.length;

  try {
    broadcastRefreshProgress({ type: 'start', total });

    for (const feed of feedsToFetch) {
      await fetchAndMergeFeed(feed, (status, f, newCount) => {
        if (status !== 'fetching') {
          index++;
        }
        broadcastRefreshProgress({
          type: 'progress',
          current: Math.min(index, total),
          total,
          feedId: f.id,
          feedName: f.name,
          status,
          newCount,
          message: f.errorMessage
        });
      });
    }

    const prunedFallbackArticles = pruneGeneratedFallbackArticles();
    const repairedArticleLinks = repairNonChemRxivArticleLinksFromDoi();
    if (prunedFallbackArticles > 0) {
      console.log(`Pruned ${prunedFallbackArticles} generated fallback article(s) after refresh.`);
    }
    if (repairedArticleLinks > 0) {
      console.log(`Repaired ${repairedArticleLinks} non-ChemRxiv article DOI link(s) after refresh.`);
    }

    saveDB();
    broadcastRefreshProgress({ type: 'complete', total });
  } catch (err) {
    console.error('Unexpected refresh failure:', err);
    broadcastRefreshProgress({ type: 'error', message: err.message });
  } finally {
    refreshInProgress = false;
  }
});

// 10. POST reset DB to default feeds and clear articles
app.post('/api/reset', (req, res) => {
  db.feeds = DEFAULT_FEEDS.map(f => ({
    ...f,
    lastFetched: null,
    status: 'ok',
    errorMessage: null
  }));
  db.articles = [];
  saveDB();
  res.json({ message: 'Database reset to default journal feeds' });
});

// 11. GET dashboard states for client initialization
app.get('/api/status', (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  
  res.json({
    settings: db.settings,
    totalArticles: db.articles.length,
    unreadArticles: db.articles.filter(a => !a.read).length,
    todayUnreadArticles: db.articles.filter(a => !a.read && new Date(a.pubDate) >= startOfToday).length,
    starredArticles: db.articles.filter(a => a.starred).length
  });
});

// 12. POST update settings
app.post('/api/settings', (req, res) => {
  const { theme, viewMode, showUnreadOnly } = req.body;
  if (theme !== undefined) db.settings.theme = theme;
  if (viewMode !== undefined) db.settings.viewMode = viewMode;
  if (showUnreadOnly !== undefined) db.settings.showUnreadOnly = showUnreadOnly;
  
  saveDB();
  res.json(db.settings);
});

// Load the database first and start server
loadDB();
const repairedFeedUrls = repairConfiguredFeedUrls();
const repairedFallbackLinks = repairGeneratedFallbackArticleLinks();
const prunedFallbackArticles = pruneGeneratedFallbackArticles();
const repairedArticleLinks = repairNonChemRxivArticleLinksFromDoi();
if (repairedFeedUrls > 0 || repairedFallbackLinks > 0 || prunedFallbackArticles > 0 || repairedArticleLinks > 0) {
  if (repairedFeedUrls > 0) {
    console.log(`Repaired ${repairedFeedUrls} feed URL(s).`);
  }
  if (repairedFallbackLinks > 0) {
    console.log(`Cleared ${repairedFallbackLinks} generated fallback DOI link(s).`);
  }
  if (prunedFallbackArticles > 0) {
    console.log(`Pruned ${prunedFallbackArticles} generated fallback article(s).`);
  }
  if (repairedArticleLinks > 0) {
    console.log(`Repaired ${repairedArticleLinks} non-ChemRxiv article DOI link(s).`);
  }
  saveDB();
}
app.listen(PORT, () => {
  console.log(`LitScope Academic Journal aggregator running at http://localhost:${PORT}`);
});
