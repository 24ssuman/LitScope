# LitScope

Local Express app for tracking recent chemistry and computational chemistry articles from RSS feeds, arXiv category queries, and ChemRxiv-style preprint sources. It supports saved reading queues, live refresh progress, journal management, library filtering, DOI search, and one-click citation copying.

## Structure

- `server.js` runs the API server, feed refresh logic, persistence, and CSV archive export.
- `db.json` stores feeds, articles, and UI settings.
- `articles_archive.csv` mirrors saved article metadata for spreadsheet use.
- `public/` contains the browser UI.

## Run

You need Node.js and npm installed in the workspace. From the project directory, install the dependencies first, then start the app:

```bash
npm install
npm start
```

The default server URL is `http://localhost:3000`.

Crossref requests are serialized and automatically retried after temporary rate limits. Optional environment variables are `CROSSREF_MAILTO` for a contact address, `CROSSREF_MIN_INTERVAL_MS` for request spacing (default `350`), and `CROSSREF_MAX_RETRIES` for retry count (default `2`). The server also rejects a second refresh while one is already running.

The Journals panel (left side) groups journals by publisher (for example ACS, RSC, APS, and Wiley), while each feed retains its saved category for filtering and read actions. The toolbar **Refresh** button always refreshes every configured journal, regardless of the active sidebar tab. Each journal keeps a `lastFetchedArticle` checkpoint; after the source is read, only entries before that newest-first checkpoint are merged. If a source has rotated past the checkpoint, LitScope recovers only article identities that are not already saved for that journal.

## Research workflow

- Use the **All** tab to filter by journal, author, and date, then order results by date or journal.
- Search accepts article titles, authors, journal names, abstracts, and DOI fragments.
- Open any article to copy a simple share-ready citation, or press `c` when it is selected.

## Layout and color palettes

The masthead holds the view tabs (Today, New, Saved, All), search, Refresh, the palette picker, the light/dark toggle, and the shortcuts help. The Journals panel sits on the left (it scrolls on its own, automatically scrolls to the journal you are reading, and slides in from the left on small screens), articles fill the rest, and opening an article raises a reader sheet from the bottom. Pick a color palette (Ocean, Forest, Ember, Orchid, Rosé, Solarized, Graphite) from the palette button; each has light and dark variants. The palette choice is remembered in the browser (`localStorage`), not in `db.json`.

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

The `homepage` field is optional and supplies a safe fallback link when an article has no DOI. The optional `crossref: { issn, rows }` field enables the same Crossref fallback used by the current catalog. Publisher folders are inferred from known publisher domains, with unknown publishers shown by hostname. Newly shipped default entries are added to an existing local library without replacing its saved feeds, articles, or settings.

Run `npm test` after changing the catalog. The registry validation tests catch duplicate IDs, malformed feed URLs, invalid Crossref metadata, and accidental removal of the current feed shape.
