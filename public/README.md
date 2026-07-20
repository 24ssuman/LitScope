# Public UI

Static frontend served by `server.js`.

## Files

- `index.html` defines the app shell and dialogs.
- `app.js` handles API calls, rendering, library filters, article actions, citation copying, and refresh status.
- `styles.css` contains the app theme and responsive layout.
- `favicon.svg` is the browser icon.

## Adding a journal

Use the `+` button beside the LitScope logo, then enter a journal name, its HTTP(S) RSS feed URL, and a category. The new feed is fetched immediately and is stored with the rest of the local feed configuration. The server returns the created feed ID, so journal names with spaces or punctuation continue to open correctly after adding them.
