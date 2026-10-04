# Public UI

Static frontend served by `server.js`.

## Files

- `index.html` defines the app shell and dialogs.
- `app.js` handles API calls, rendering, library filters, article actions, citation copying, and refresh status.
- `styles.css` contains the app theme and responsive layout.
- `favicon.svg` is the browser icon.

The toolbar Refresh action always requests all configured journals. The server applies each journal's persisted `lastFetchedArticle` checkpoint so only newly available source entries are added.

Opening a publisher or DOI link records the publisher visit as an `external` suggestion signal and marks the article read through the existing read-history API. Explicit read/dismiss actions use the separate negative `read` learning signal; automatic read state from opening the drawer or visiting the publisher remains neutral.

The Suggested view is backed by a local versioned neural ranker. Its richer feature schema includes paper text, author identity, feed/category/source metadata, and document-shape signals. Bulk **Mark all read** feedback is batch-scaled so it remains negative evidence without overwhelming stronger individual actions.

Suggested results are requested and rendered as up to three numbered pages of 20 papers. Page navigation uses the server-provided ranked window, so changing pages does not independently rerank or alter article interaction behavior.

The bottom **Mark as read** action is scoped to the currently visible page; it does not mark the rest of the library read.

## Adding a journal

Use the `+` button beside the LitScope logo, then enter a journal name, its HTTP(S) RSS or arXiv API query URL, and a category. The new feed is fetched immediately and is stored with the rest of the local feed configuration. The server returns the created feed ID, so journal names with spaces or punctuation continue to open correctly after adding them.
