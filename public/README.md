# Public UI

Static frontend served by `server.js`.

## Files

- `index.html` defines the app shell and dialogs. Element IDs are the contract with `app.js`; restyle freely but keep them.
- `app.js` handles API calls, rendering, library filters, article actions, citation copying, and refresh status.
- `styles.css` contains the "Paper & Ink" design system (warm paper desk with floating reading sheets, serif headlines, mono metadata), light/dark themes, and responsive layout.
- `favicon.svg` is the browser icon.

The sidebar folders group journals by publisher, using publisher metadata derived from configured journal URLs. Feed categories remain saved separately for filtering and read actions. The toolbar Refresh action always requests all configured journals. The server applies each journal's persisted `lastFetchedArticle` checkpoint so only newly available source entries are added.

## Adding a journal

Use the `+` button beside the LitScope logo, then enter a journal name, its HTTP(S) RSS or arXiv API query URL, and a category. The new feed is fetched immediately and is stored with the rest of the local feed configuration. The server returns the created feed ID, so journal names with spaces or punctuation continue to open correctly after adding them.
