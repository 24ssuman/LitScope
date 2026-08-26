# LitScope

Local Express app for tracking recent chemistry and computational chemistry articles from RSS feeds, arXiv category queries, and ChemRxiv-style preprint sources. It supports saved reading queues, live refresh progress, journal management, library filtering, DOI search, and one-click citation copying.

## Structure

- `server.js` runs the API server, feed refresh logic, persistence, and CSV archive export.
- `db.json` stores feeds, articles, and UI settings.
- `articles_archive.csv` mirrors saved article metadata for spreadsheet use.
- `public/` contains the browser UI.
- `paper-suggestions.js` contains the local online neural ranker and abstract extraction helpers.
- `suggestion-pagination.js` defines the bounded Suggested-page contract shared by the API and its tests.
- `suggestion_events.jsonl` is an ignored append-only local log of captured suggestion/read interactions and stable article snapshots for future model replay.

## Run

```bash
npm start
```

The default server URL is `http://localhost:3000`.

Crossref requests are serialized and automatically retried after temporary rate limits. Optional environment variables are `CROSSREF_MAILTO` for a contact address, `CROSSREF_MIN_INTERVAL_MS` for request spacing (default `350`), and `CROSSREF_MAX_RETRIES` for retry count (default `2`). The server also rejects a second refresh while one is already running.

The toolbar **Refresh** button always refreshes every configured journal, regardless of the active sidebar tab. Each journal keeps a `lastFetchedArticle` checkpoint; after the source is read, only entries before that newest-first checkpoint are merged. If a source has rotated past the checkpoint, LitScope recovers only article identities that are not already saved for that journal.

## Research workflow

- Use **All articles** to filter by journal, author, and date, then order results by date or journal.
- Search accepts article titles, authors, journal names, abstracts, and DOI fragments.
- Open any article to copy a simple share-ready citation, or press `c` when it is selected.

## Suggested papers

The **Suggested** sidebar tab ranks recent papers from every journal with a local hybrid recommender. Its version 4 online neural model uses a 512-feature hashed encoder and 16 hidden units. The encoder learns title and abstract terms, phrases, word fragments, individual author identities, journal/feed/category/source identity, DOI publisher prefixes, and lightweight document-shape signals such as author count and title/abstract overlap. A content-interest profile generalizes clicked papers to similar text, while the final feed adds freshness, exploration, and journal diversity. It starts cold, then learns positive signals from active interactions in every feed—opening an article, visiting the publisher page, and starring or unstarring it. An explicit **Mark read** or **Mark all read** action is also a negative preference signal, so papers you dismiss can lower the rank of similar papers. A bulk **Mark all read** remains negative but is scaled by batch size and class balance so hundreds of dismissals cannot drown out rarer individual positive actions. Opening the in-app drawer and visiting a publisher page still persist the article as read, but those automatic state updates remain neutral; the publisher visit keeps its positive `external` signal. When a publisher exposes a fuller abstract, that text is added as a lighter follow-up signal for the same active interaction.

The current model and cached fuller abstracts remain in ignored local `suggestions.json`; captured interaction records are appended to ignored local `suggestion_events.jsonl` with event metadata and a stable paper snapshot. When the feature schema changes, LitScope preserves the preceding ranker as a temporary compatibility blend and rebuilds the new feature model from eligible replay records. This keeps older aggregate learning available while letting richer features learn from the auditable event history. Neither store overwrites the article database or read/star state. Events accumulated before the replay log was added cannot be reconstructed exactly from raw events; passive visibility was never captured.

Publisher abstract enrichment is best-effort and asynchronous. A blocked or slow publisher cannot prevent the article drawer or normal feed reading from working.

The Suggested tab presents the top-ranked queue across up to three numbered pages, with 20 papers per page. The page controls preserve one ranked ordering; when more candidates exist, the UI labels the displayed top 60 separately from the full candidate count.

Each Suggested page ends with **Mark as read**, which marks only that page's papers and keeps the existing explicit read signal and read-history persistence.

## Add another journal

Any journal with an HTTP(S) RSS feed or arXiv API query can be added from the app with the `+` button. Enter its display name, source URL, and category; LitScope validates the URL, saves the feed, downloads its articles, and keeps it available across restarts in the local database.

To ship another journal as part of the default catalog, add one entry to [`journal-config.js`](./journal-config.js):

```js
{
  id: 'example-journal',
  name: 'Example Journal',
  url: 'https://publisher.example/example.rss',
  category: 'Chem'
}
```

The `homepage` field is optional and supplies a safe fallback link when an article has no DOI. The optional `crossref: { issn, rows }` field enables the same Crossref fallback used by the current catalog. The shipped `arXiv:stat-mech` and `arXiv:chem-ph` entries independently query the official Atom API for `cond-mat.stat-mech` and `physics.chem-ph`; both remain separate from the ChemRxiv API/Crossref fallback. New default entries appear on a fresh database or after using **Reset database**; existing local `db.json` data is not overwritten.

Run `npm test` after changing the catalog. The registry validation tests catch duplicate IDs, malformed feed URLs, invalid Crossref metadata, and accidental removal of the current feed shape.
