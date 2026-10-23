# Public UI

Static frontend served by `server.js`.

## Files

- `index.html` defines the app shell and dialogs. Element IDs are the contract with `app.js`; restyle freely but keep them.
- `app.js` handles API calls, rendering, library filters, article actions, citation copying, refresh status, and the color palette picker.
- `styles.css` contains the "Console" design system: top masthead with view tabs and search, Journals panel on the left (independently scrollable), article stream on the right, bottom-sheet article reader, and a responsive mobile layout.
  - Colors come from palettes. Each palette sets six inputs (`--desk`, `--sheet`, `--ink`, `--accent`, `--accent-2`, `--on-accent`) for dark and light themes; all other colors derive from them. To add a palette, add its dark + light rules in `styles.css` and one `{ id, name }` entry to `PALETTES` in `app.js`.
  - The active palette is `<html data-palette="…">`, saved in `localStorage` under `litscope.palette.v1` and applied by an inline script in `index.html` before first paint.
- `favicon.svg` is the browser icon.

The Journals panel folders group journals by publisher, using publisher metadata derived from configured journal URLs. Feed categories remain saved separately for filtering and read actions. The toolbar Refresh action always requests all configured journals. The server applies each journal's persisted `lastFetchedArticle` checkpoint so only newly available source entries are added.

## Adding a journal

Use the `+` button at the top of the Journals panel, then enter a journal name, its HTTP(S) RSS or arXiv API query URL, and a category. The new feed is fetched immediately and is stored with the rest of the local feed configuration. The server returns the created feed ID, so journal names with spaces or punctuation continue to open correctly after adding them.

Use a journal's edit control to delete that journal. Publisher sections containing only user-added journals show a trash button to remove the section and its downloaded articles together. In a section that also contains built-in journals, remove added journals individually. Both actions require confirmation; read-history records are kept.
