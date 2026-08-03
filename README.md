# LitScope

Local Express app for tracking recent chemistry and computational chemistry articles from RSS feeds and ChemRxiv-style preprint sources. It supports saved reading queues, live refresh progress, journal management, library filtering, DOI search, and one-click citation copying.

## Structure

- `server.js` runs the API server, feed refresh logic, persistence, and CSV archive export.
- `db.json` stores feeds, articles, and UI settings.
- `articles_archive.csv` mirrors saved article metadata for spreadsheet use.
- `public/` contains the browser UI.
- `paper-suggestions.js` contains the local online neural ranker and abstract extraction helpers.
- `suggestion_events.jsonl` is an ignored append-only local log of captured suggestion/read interactions and stable article snapshots for future model replay.

## Run

```bash
npm start
```

The default server URL is `http://localhost:3000`.

Crossref requests are serialized and automatically retried after temporary rate limits. Optional environment variables are `CROSSREF_MAILTO` for a contact address, `CROSSREF_MIN_INTERVAL_MS` for request spacing (default `350`), and `CROSSREF_MAX_RETRIES` for retry count (default `2`). The server also rejects a second refresh while one is already running.

## Research workflow

- Use **All articles** to filter by journal, author, and date, then order results by date or journal.
- Search accepts article titles, authors, journal names, abstracts, and DOI fragments.
- Open any article to copy a simple share-ready citation, or press `c` when it is selected.

## Suggested papers

The **Suggested** sidebar tab ranks recent papers from every journal with a local hybrid recommender. A small online neural model learns title, author, abstract, and journal features; a content-interest profile generalizes clicked papers to similar text; and the final feed uses freshness, exploration, and journal diversity signals. It starts cold, then learns from active interactions in every feed—opening an article, visiting the publisher page, and starring or unstarring it. When a publisher exposes a fuller abstract, that text is added as a lighter follow-up signal for the same active interaction. The current model keeps passive visibility and read/seen state neutral, while the raw history log records explicit read/unread transitions as `trainingEligible: false` records for possible future use. The current model and cached fuller abstracts remain in ignored local `suggestions.json`; captured interaction records are appended to ignored local `suggestion_events.jsonl` with event metadata and a stable paper snapshot. This raw log is the replayable history for future model changes and does not overwrite the existing article database or read/star state. Events accumulated before this log was added cannot be reconstructed from the current model file; passive visibility was never captured.

Publisher abstract enrichment is best-effort and asynchronous. A blocked or slow publisher cannot prevent the article drawer or normal feed reading from working.

## Add another journal

Any journal with an HTTP(S) RSS feed can be added from the app with the `+` button. Enter its display name, RSS URL, and category; LitScope validates the URL, saves the feed, downloads its articles, and keeps it available across restarts in the local database.

To ship another journal as part of the default catalog, add one entry to [`journal-config.js`](./journal-config.js):

```js
{
  id: 'example-journal',
  name: 'Example Journal',
  url: 'https://publisher.example/example.rss',
  category: 'Chem'
}
```

The `homepage` field is optional and supplies a safe fallback link when an article has no DOI. The optional `crossref: { issn, rows }` field enables the same Crossref fallback used by the current catalog. ChemRxiv entries remain the only special non-RSS source and keep their existing API/fallback path. A new default entry appears on a fresh database or after using **Reset database**; existing local `db.json` data is not overwritten.

Run `npm test` after changing the catalog. The registry validation tests catch duplicate IDs, malformed feed URLs, invalid Crossref metadata, and accidental removal of the current feed shape.
