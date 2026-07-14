# Log

## 2026-07-14 10:10:00 PDT

- Adopted `LitScope` as the product and private GitHub repository name.
- Replaced every source-level reference to the prior product identity with `LitScope`, including the UI wordmark and page title, runtime user-agent, startup message, package metadata, and source-file headers.
- Reasoning: the selected name better describes a literature-discovery and reading workspace without suggesting an association with another product.

## 2026-07-14 10:00:00 PDT

- Identified `db.json`, `read_history.json`, and `articles_archive.csv` as the project's persisted local article library, read-state, and archive data.
- Added `.gitignore` rules for those files, dependency installs, environment files, conventional local-state folders, and editor/OS metadata.
- Updated `PLAN.md` for GitHub repository setup.
- Reasoning: source code and reproducible configuration should be versioned, but the user's local reading history and article archive must remain private and untracked.

## 2026-07-08 10:25:01 PDT

- Created local instruction and planning files: `AGENTS.md`, `PLAN.md`, and `LOG.md`.
- Reasoning: the workspace instructions require these files before implementation work, and they provide a local record of constraints, plan, and decisions.

## 2026-07-08 10:26:26 PDT

- Inspected `server.js`, `public/app.js`, `db.json`, and the current ChemRxiv records.
- Verified that ChemRxiv API calls return a `403` Cloudflare challenge from this environment.
- Checked existing ChemRxiv DOI metadata through Crossref and confirmed several stored fallback titles do not match their DOI links.
- Reasoning: the user reported ChemRxiv links opening a valid but incorrect paper, so the investigation focused on title/DOI consistency rather than only URL reachability.

## 2026-07-08 10:31:23 PDT

- Replaced hardcoded ChemRxiv mock DOI/title pairs with a Crossref-backed ChemRxiv metadata fallback.
- Added a repair pass for existing saved ChemRxiv articles so stored title/link pairs are rewritten from DOI metadata during refresh.
- Updated refresh progress output to report fallback metadata instead of saying ChemRxiv generated offline mocks.
- Ran `node --check server.js` and `node --check public/app.js`.
- Reasoning: ChemRxiv direct API access is blocked here, so fallback records must be sourced from DOI metadata to prevent valid-but-wrong paper links.

## 2026-07-08 10:32:53 PDT

- Ran the app locally on port `3100` and refreshed only `chemrxiv-tcc` and `chemrxiv-pc`.
- Confirmed both ChemRxiv feeds used the Crossref fallback after ChemRxiv returned `403`, and both repaired saved records.
- Checked saved ChemRxiv records against Crossref title metadata; no mismatches were found among records that Crossref returned before rate limiting one follow-up request.
- Verified there are no duplicate saved ChemRxiv DOI rows.
- Added `README.md` and `public/README.md`.
- Reasoning: the database and CSV need to reflect corrected metadata now, not only after a future user-triggered refresh.

## 2026-07-08 10:33:42 PDT

- Re-ran syntax checks for `server.js` and `public/app.js`.
- Confirmed the temporary verification server on port `3100` was stopped.
- Reviewed the final workspace file list and verified all newly created files remain inside the current working directory.
- Reasoning: final verification should leave no running local process and should confirm the requested workspace-only file organization.

## 2026-07-08 10:41:13 PDT

- Started a new pass on the mark-all-read workflow after the user reported it still did not move to the expected journal.
- Re-read the client navigation code and confirmed the existing post-action jump was category-agnostic.
- Reasoning: the fix needs to keep navigation within the current category and emit a clear message when that category has no unread journals left.

## 2026-07-08 10:42:15 PDT

- Patched `public/app.js` with a category-aware unread-feed helper and wired it into both mark-all-read and refresh-complete flows.
- Reused the same helper to keep feed ordering consistent with the sidebar.
- Reasoning: the user wants the app to stay inside the current category when it advances to the next unread journal, and to say something when no unread journals remain there.

## 2026-07-08 10:43:19 PDT

- Rewrote `PLAN.md` so it matches the current mark-all-read/navigation task instead of the earlier ChemRxiv investigation.
- Reasoning: the workspace notes should describe the work that was just completed, not the previous task that has already been handled.

## 2026-07-08 10:49:06 PDT

- Started the paper-link repair pass after the user reported regular journal paper links are not opening the exact papers.
- Clarified scope based on the user's follow-up: ChemRxiv links already work and should not be changed.
- Counted saved records: 259 non-ChemRxiv articles have DOI metadata, and 68 of those look like fallback-generated homepage links.
- Reasoning: DOI resolver URLs are publisher-neutral and match examples like JCP `https://doi.org/10.1063/5.0338828`, but ChemRxiv should be left alone.

## 2026-07-08 10:49:54 PDT

- Added a regular-journal DOI/arXiv link resolver in `server.js`.
- Updated RSS processing and non-ChemRxiv fallback generation to set article links from DOI metadata when a DOI exists.
- Added a startup repair pass for existing non-ChemRxiv saved article links; ChemRxiv records are explicitly skipped.
- Ran `node --check server.js` and `node --check public/app.js`.
- Reasoning: the UI already opens `article.link`, so correcting that field fixes card actions and drawer external links consistently.

## 2026-07-08 10:51:53 PDT

- Updated the configured JCP RSS URL to the current AIP RSS endpoint shown on the JCP journal page.
- Added startup cleanup for older non-ChemRxiv fallback-generated records so fake fallback DOIs are cleared instead of being exposed as paper links.
- Re-ran syntax checks for `server.js` and `public/app.js`.
- Reasoning: DOI links are only useful when the DOI is real; old offline mocks should not pretend to have exact paper links.

## 2026-07-08 10:53:15 PDT

- Added a JCP-specific Crossref fallback keyed by ISSN `1089-7690`.
- Verified Crossref returns current JCP records with real `10.1063/...` DOI values.
- Re-ran syntax checks for `server.js` and `public/app.js`.
- Reasoning: if AIP's RSS endpoint is blocked by Cloudflare, the app can still load real JCP article metadata and exact DOI resolver links instead of generic mocks.

## 2026-07-08 10:56:16 PDT

- Changed JCP refresh behavior to prefer Crossref before RSS because AIP RSS is reachable but does not expose DOI fields.
- Added pruning for older generated non-ChemRxiv fallback rows so fake records no longer remain in the active database/archive.
- Updated Crossref article merging to upgrade existing same-title RSS rows that previously lacked DOI metadata.
- Re-ran syntax checks for `server.js` and `public/app.js`.
- Reasoning: for JCP, Crossref provides the exact DOI resolver links the user requested, while RSS article-page URLs alone do not.

## 2026-07-08 10:57:17 PDT

- Ran the app on temporary port `3105`, pruned 68 generated fallback rows, and refreshed only JCP.
- Verified JCP now has real `10.1063/...` DOI links from Crossref.
- Verified all 211 non-ChemRxiv articles with DOI metadata use `https://doi.org/<doi>` links.
- Verified ChemRxiv records still use their existing non-`doi.org` ChemRxiv links.
- Confirmed the temporary server was stopped after verification.
- Reasoning: the final database should contain exact DOI resolver links for real DOI-bearing records while preserving the already-working ChemRxiv behavior.

## 2026-07-09 08:28:19 PDT

- Restarted the link investigation after the user clarified that newly fetched articles are still getting incorrect links across all non-ChemRxiv journal types.
- Counted remaining generated `#mock-` records in the saved database and found placeholder homepage links across multiple journals.
- Reasoning: any generated placeholder article cannot have an exact paper URL, so correctness requires replacing the fake fallback path with verified DOI metadata or no new article.

## 2026-07-09 08:29:04 PDT

- Expanded the non-ChemRxiv Crossref fallback map to cover the configured built-in journals by ISSN.
- Changed Crossref journal fetches to use the journal works endpoint sorted by published date, avoiding date filters that missed PCCP records.
- Updated fallback pruning to remove existing non-ChemRxiv `#mock-` rows and stopped the network-failure path from generating new mock articles.
- Ran `node --check server.js` and `node --check public/app.js`.
- Reasoning: exact article links require verified DOI metadata; if no verified metadata is available, creating a fake article with a homepage link is worse than showing no new article.

## 2026-07-09 08:31:23 PDT

- Ran the app on temporary port `3106`; startup pruned 213 generated fallback articles from the saved database.
- Triggered a full refresh and verified all built-in non-ChemRxiv feed IDs are covered by Crossref ISSN fallback configuration.
- Verified there are 0 remaining non-ChemRxiv `#mock-` articles and 0 non-ChemRxiv DOI articles whose links are not `https://doi.org/<doi>`.
- Verified PCCP now has DOI links such as `https://doi.org/10.1039/d5cp02051d`.
- Verified ChemRxiv still has 0 `doi.org` links, preserving its existing ChemRxiv link behavior.
- Confirmed the temporary server on port `3106` was stopped.
- Reasoning: the saved data and future refresh path should now avoid homepage/fake links for newly fetched journal articles.

## 2026-07-09 08:33:28 PDT

- Started a hardening pass so refreshes and future new-article paths enforce DOI links at the merge boundary.
- Re-read the RSS DOI extraction and article merge functions.
- Reasoning: branch-specific DOI fixes work today, but merge-time normalization prevents future fetch paths from saving DOI articles with bad links.

## 2026-07-09 08:34:12 PDT

- Added merge-time normalization for non-ChemRxiv articles so any fetched DOI is saved with a DOI resolver link and DOI-derived GUID.
- Expanded RSS DOI extraction to include common DOI fields such as `dc:identifier`, `prism:doi`, summaries, categories, descriptions, and encoded content.
- Changed the old mock generator to return no articles and added refresh-completion cleanup for generated fallback rows and DOI-link repairs.
- Reasoning: link correctness should be enforced at the save boundary and after every refresh, not only inside individual fetch branches.

## 2026-07-09 08:36:44 PDT

- Ran `node --check server.js` and `node --check public/app.js`.
- Ran the app on temporary port `3107`; startup pruned 217 stale generated fallback articles.
- Triggered a full refresh and verified 28 non-ChemRxiv feeds have Crossref fallback coverage.
- Verified there are 0 non-ChemRxiv generated mock records and 0 non-ChemRxiv DOI records whose links differ from `https://doi.org/<doi>`.
- Verified PCCP records continue to use DOI resolver links such as `https://doi.org/10.1039/d5cp02051d`.
- Confirmed the temporary server on port `3107` was stopped.
- Reasoning: refresh and new-article save paths now enforce exact DOI links, and the saved database matches that invariant.

## 2026-07-09 18:06:50 PDT

- Started a user-experience improvement pass for the research dashboard and reviewed the existing frontend, API filters, and local project documentation.
- Identified useful missing research workflows: narrowing the full library to a journal, sorting result sets, searching directly by DOI, and copying a normalized citation from the article detail drawer.
- Also found that the toast container was not cached in the client DOM map, which can prevent user feedback messages from rendering.
- Reasoning: these changes build on the existing reader without changing feed data or refresh behavior, while making discovery and reference management substantially faster.

## 2026-07-09 18:12:20 PDT

- Added journal and sort selectors to the full-library search panel, alongside the existing author/date filters; populated journal choices from the configured feeds.
- Extended the article API to search DOI fragments and support newest, oldest, and journal-first result ordering.
- Added a detail-drawer citation action with a clipboard fallback, `c` keyboard shortcut, and `/` shortcut to focus search. The copied citation uses the article's authors, publication year, title, journal, and DOI resolver (or article link when no DOI is present).
- Added request sequencing to prevent a slow earlier filter request from replacing the results of a newer request.
- Fixed the missing toast-container DOM reference so the app can reliably surface refresh, error, and copy feedback.
- Updated `README.md` and `public/README.md` to describe the new research workflow and retained the required project notes.
- Verified `node --check public/app.js` and `node --check server.js`. In browser checks against a temporary local server, confirmed: filter controls render, JCC filtering produces 18 results, journal sorting begins with ACS Cat., DOI search returns the exact JCC DOI record, citation copy produces `Davide Luciani, Anna Lombardo, Emilio Benfenati (2026). The Chemical Smiler : CHEMICal Abstraction Leading to SMILEs of Reference. JCC. https://doi.org/10.1002/jcc.70463`, and rapid journal filter changes retain the final all-journals result set.
- Reasoning: the new controls make the article archive more useful for real literature review, while request sequencing and feedback repair keep the interactions dependable.

## 2026-07-09 18:15:06 PDT

- Began a read-only diagnosis of the error reported on the Today updates page.
- Updated the local plan before investigation and will inspect the browser state, running server, and Today article API path before proposing any code change.
- Reasoning: the request is to identify the cause, so the application should not be modified until the failure is evidenced.

## 2026-07-09 18:16:22 PDT

- Confirmed the in-app browser is pointed at `http://localhost:3011`, where the page shell remains from a prior local session but no server process is listening.
- Observed the Today view's visible `Error loading articles.` message and repeated failed live-update connection messages in the browser console.
- Verified `http://localhost:3011/api/status` cannot connect, while `http://localhost:3000/api/status` returns HTTP 200 and the corresponding Today API request returns a valid empty result (`0` articles).
- Traced the failure to `loadArticles()` in `public/app.js`: its API request fails because the origin is offline and the catch handler correctly replaces the stream with the generic loading error. The SSE warning has the same cause.
- Reasoning: this is an environment/server-address issue, not an article-data or Today-filter defect. No application code was changed during diagnosis.

## 2026-07-10 08:40:39 PDT

- Began a read-only feasibility check for displaying genuine article TOC graphics in Cards view.
- The scope explicitly excludes generated or fabricated images; only image URLs supplied by publishers, official feeds, or article metadata will be considered.
- Reasoning: availability must be established source by source before changing the UI or ingestion pipeline.

## 2026-07-10 08:43:39 PDT

- Confirmed Cards view already renders a thumbnail whenever an article has `imageUrl`, and the RSS path already extracts enclosures, media fields, and images embedded in official feed content.
- Counted 795 saved articles and found zero with `imageUrl`; the live Cards view likewise rendered 51 cards with zero thumbnail elements.
- Identified the ingestion cause: built-in journals prefer Crossref, Crossref records explicitly set `imageUrl: null`, and the successful Crossref branch returns before the official RSS image extractor runs.
- Sampled official publisher feeds without modifying saved data. Wiley exposed publisher-hosted graphical assets for 7 of 8 current JCC items and 14 of 14 ChemPhysChem items. Nature Communications and PNAS feeds exposed no image elements in the sample. ACS returned a Cloudflare 403, the configured RSC PCCP feed returned 404, and the Science Advances feed returned 410.
- Tested two Wiley image URLs from the official feeds; both returned HTTP 403 from this environment, so direct hot-linking would not currently be reliable even though the metadata contains genuine publisher image URLs.
- Reasoning: official TOC graphics can be supported only where the publisher exposes an accessible image. A safe implementation should enrich Crossref records from official metadata by DOI, validate publisher origin and image response, and leave cards text-only when no verified image is available. No generated substitutes should be used.

## 2026-07-10 08:45:05 PDT

- Started implementation of publisher-only TOC enrichment at the user's request.
- The implementation boundary is: match official feed records to Crossref articles by DOI or normalized title, accept only approved publisher-hosted image URLs that return an image response, and retain text-only cards for unavailable or blocked images.
- Reasoning: strict validation prevents unrelated page art, journal covers, invented substitutes, and broken hotlinks from being presented as article TOC graphics.

## 2026-07-10 08:52:02 PDT

- Added `toc-images.js` with an explicit feed-to-publisher-host allowlist, DOI-first and unique-title fallback matching, unsafe artwork-name rejection, HTTPS enforcement, redirect revalidation, image content-type checks, a 10 MB size ceiling, and request timeouts.
- Enabled enrichment only for JCC and ChemPhysChem, the two feeds verified to contain article-level publisher graphics. The configuration can be extended after another publisher is verified.
- Updated the Crossref-first refresh path to fetch official feed metadata for TOC candidates, match candidates to Crossref articles, and save only candidates that pass validation with `imageSource: publisher-feed` provenance.
- Applied the same validation to the direct RSS path so unverified images cannot bypass the safeguards. Existing Crossref DOI resolver links and read/star state remain unchanged.
- Added `referrerpolicy="no-referrer"`, descriptive publisher-image alternative text, and HTML attribute escaping to the Cards view; the drawer follows the same no-referrer policy.
- Added six automated tests covering the feed allowlist, host/protocol restrictions, DOI/title matching, ambiguous and untitled records, successful image responses, 403 responses, HTML responses, oversized images, and offsite redirects. `npm test` passes all six tests, and syntax checks pass for the server and client.
- Refreshed JCC and ChemPhysChem through the updated path. Their official candidates were correctly discovered but rejected because the publisher image host returned 403; the database therefore contains zero stored images and zero unverified images, while all DOI links remain exact.
- Verified the live Cards view renders text-only without broken thumbnails or browser errors when publisher images are inaccessible. Restarted the primary app server on port 3000 with the updated backend and stopped temporary verification servers.
- Updated the root and public README files to document publisher-only TOC behavior and the intentional text-only fallback.
- Reasoning: the implementation now adds genuine publisher graphics when they are verifiably accessible, while failing closed for blocked, missing, ambiguous, unsafe, or unverifiable artwork and never generating substitutes.

## 2026-07-14 00:00:00 PDT

- Started removal of the TOC-image feature at the user's request.
- Confirmed ChemRxiv retrieval is unrelated to TOC enrichment: `fetchFeed()` dispatches `chemrxiv://` feeds to `fetchChemRxiv()`, which calls ChemRxiv's category API and falls back to Crossref DOI metadata when that API fails.
- Reasoning: removing publisher-image code must not alter the independent ChemRxiv ingest and fallback behavior.

## 2026-07-14 08:04:53 PDT

- Removed the TOC-image module and its tests, Crossref/RSS image-enrichment calls, image fields in newly fetched articles, Cards and drawer image rendering, related styles, and TOC documentation.
- Left `fetchChemRxiv()`, `fetchChemRxivFromCrossref()`, and the `chemrxiv://` dispatch unchanged.
- Verified `node --check server.js`, `node --check public/app.js`, and `npm test` (no test files remain) all pass. Started the app on port 3114 and confirmed `/api/status` responds successfully; then stopped the temporary server.
- Reasoning: the application now has no TOC-image behavior while retaining its separate ChemRxiv API/fallback retrieval path.

## 2026-07-14 09:30:58 PDT

- Investigated the refresh error log and traced the repeated Crossref `429` responses through the full refresh path.
- Found three request multipliers: the server accepts overlapping refresh jobs, an RSS failure can repeat the same journal Crossref request, and each ChemRxiv fallback repairs every saved ChemRxiv DOI through an additional individual Crossref request.
- Confirmed the accompanying publisher `403`, `404`, and `410` responses are separate feed-access failures; they become noisy because Crossref is already rate-limited and cannot provide the intended fallback.
- Reasoning: the durable fix is to bound Crossref request rate and retry behavior while removing redundant request bursts, rather than special-casing the journals visible in one error log.

## 2026-07-14 09:35:09 PDT

- Added a shared Crossref client that serializes requests, spaces them by 350 ms by default, deduplicates identical in-flight URLs, retries temporary `429`/gateway failures, and honors `Retry-After` within a bounded delay.
- Removed the second identical journal Crossref call after an RSS failure and removed the refresh-time loop that queried Crossref once for every saved ChemRxiv DOI. Current ChemRxiv fallback still retrieves a verified Crossref result set and merges it normally.
- Added a server-side refresh lock returning HTTP `409` for an overlapping refresh and client feedback for that state. Added cleanup so an unexpected refresh error releases the lock.
- Added `crossref-client.test.js` with four passing tests for `Retry-After`, retry behavior, in-flight deduplication, and exhausted retries. Syntax checks pass for the server, client, and Crossref module.
- Started the app on port 3115, issued two refresh requests concurrently, and observed one HTTP `200` start plus one HTTP `409` `already-running` response. The accepted JPC C refresh completed with `status: ok`, `errorMessage: null`, and an updated `lastFetched`; the temporary server was then stopped.
- Updated the root README with Crossref throttling settings and the single-refresh rule.
- Reasoning: a full refresh now generates a bounded sequence of Crossref calls instead of overlapping and duplicating them, while preserving existing saved articles whenever both live sources are unavailable.
- Restarted the main app process on port 3000 and confirmed `/api/status` responds successfully, so the running dashboard is using the updated refresh implementation.
- Stopped the app process listening on port 3000 at the user's request and confirmed no process remains bound to that port.

## 2026-07-14 09:36:00 PDT

- Started investigation of the report that unread/new articles are not appearing in the feed navigation.
- Scope includes the persisted article `read` state, the feed counts returned by the API, and the sidebar's collapsed/expanded rendering behavior.
- Reasoning: a correct count alone is insufficient if the corresponding feed is hidden in the visible navigation.

## 2026-07-14 09:45:31 PDT

- Removed the `feed.lastFetched` date heuristic from all journal RSS, journal Crossref, ChemRxiv API, and ChemRxiv Crossref article constructors. It had marked a first-seen item as read solely because its publication date preceded a previous refresh, even when the item had never appeared in the app.
- Added a shared read-state helper: saved articles retain their stored state; first-seen articles are unread unless their DOI/link is already in the explicit read-history ledger.
- Added unread totals to category headers as well as the existing per-feed unread badges, making new items visible even before expanding a category.
- Added two read-state tests; all six project tests pass, and both server and client syntax checks pass.
- Verified the temporary local UI on port 3116: 30 feed rows render, four feeds show individual unread badges, and the category totals (`3` and `16`) match the 19-item New Articles badge. The temporary server will be stopped after verification.
- Reasoning: newness is now based on whether the user has already read or saved the article, not on a potentially delayed publisher/Crossref publication timestamp.
- Stopped the temporary verification server on port 3116; port 3000 remains stopped as requested.

## 2026-07-14 09:47:00 PDT

- Investigated the repeated ChemRxiv `403` output after startup/refresh.
- Confirmed the direct ChemRxiv category endpoint is access-blocked in this environment, while the existing Crossref path is the verified fallback for those feeds.
- Reasoning: a direct-source `403` should not be logged as an application failure each time a successful fallback can provide the articles.

## 2026-07-14 09:57:28 PDT

- Added a six-hour in-process cooldown after ChemRxiv returns `403`. During that window, both ChemRxiv feeds skip the blocked direct API and immediately use Crossref.
- Suppressed terminal error output for this expected access denial when Crossref fallback succeeds; unexpected direct-source failures and any failed Crossref fallback are still logged.
- Restarted the app on port 3000. Refreshed Theo/Comp and then Phys Chem: both completed with `status: fallback` and the message `Loaded verified DOI metadata from Crossref`, without emitting the prior direct-API `403` errors.
- Verified `node --check server.js` and all six tests pass.
- Reasoning: the dashboard still fetches ChemRxiv articles through verified metadata, while the known blocked source no longer pollutes refresh output or receives repeated requests.
