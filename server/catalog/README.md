# Catalog

`create_catalog(store)` reads SQLite only. SQL filters and sorts before pagination. Local pages contain 24 entries. Imported data remains available offline.

`create_sync(store, images, options?)` imports public Cinemeta metadata without an account or API key. The optional `on_titles(ids)` callback can return a promise. Publication awaits it, and callback failures retain the job for retry. Shutdown aborts source requests and drains publication before storage closes.

Title and episode requests use the interactive queue. They wake an idle importer, promote matching queued work (a promoted discovery returns to background rotation after one batch), and can run between upstream requests from discovery or filter enrichment. Interactive jobs keep FIFO order. Discovery jobs retain their durable cursors and use the batch interval only between bulk units. The API queues attribution exports separately from metadata publication and drains that queue during shutdown.

## Endpoints and discovery

Source: `https://v3-cinemeta.strem.io`.

- `manifest.json` supplies genre labels for movie and series `top` catalogs.
- `catalog/{movie|series}/top/{extras}.json` accepts `genre`, `search`, and `skip` extras. Extras use URL-encoded values separated by `&`.
- Discovery advances `skip` by 50. Short pages do not end a scan. Empty or repeated pages do. Completed discovery waits seven days, or the metadata freshness interval if longer, before restarting. Unchanged titles keep their stored rows and skip the `on_titles` callback.
- Search returns a bounded result set and does not support skip-based pagination. Each search imports one response per selected type. If an anime or genre filter needs missing fields, those results receive detail imports before the search finishes.
- `meta/{movie|series}/{imdb_id}.json` supplies detail. Series detail also supplies episode videos.

Movie, series, and anime discovery rotate through persistent cursors. Anime discovery reads both Animation catalogs. Classification requires an explicit Anime genre, or an Animation genre with Japan in the source country list. Other animation is not classified as anime.

Trending jobs read the first 10 `top` pages per list (movie, series, anime) at most once every 24 hours and store each run as a dated rank snapshot plus the current rank on the catalog row. `genres.ts` merges duplicate source genres, splits combined ones and hides unwanted ones for entries, facets and filters.

IMDb IDs identify movies and series. Episode IDs use `parent_imdb:season:episode`. Coordinates must be explicit integers from 0 through 99999. Conflicting IDs or episode numbers are rejected. Season zero is retained; episodes sort by season and episode.

## Freshness and retention

Catalog publication refreshes supplied metadata and artwork fields. Absent fields preserve richer Cinemeta detail.

Full-detail freshness is separate from catalog publication. Only successful detail publication updates its marker. Fresh series detail covers its imported episodes and episode-list requests. Catalog refresh cannot make stale detail fresh.

Metadata refresh does not remove local titles or personal records. Local browsing order is SQL-only. Source responses and jobs use the `cinemeta` cache namespace. Cached responses contain only consumed metadata fields; catalog responses exclude videos.

## Requests and artwork

Requests are spaced by one second; batches by 30 seconds. The shared upstream queue keeps interactive requests ahead of queued discovery requests while preserving request spacing. HTTP requests allow three attempts, a 15-second attempt timeout, and a 45-second budget that starts when the request leaves the queue. Connection failures, rate limits and `Retry-After` set a shared cooldown without completing the job. Origin failures pause background discovery only; interactive jobs retry on their own delay. Non-origin publication failures retry their own job without blocking unrelated imports.

The source registers only supplied poster and episode thumbnail URLs. Backdrops are not cached: the API returns the full-resolution metahub origin URL (live.metahub.space/background/large, 3840×2160) and the browser loads it directly. Registration failures do not block metadata or other images. Imports neither download images nor query another artwork service. The artwork worker prefetches posters and episode stills two titles at a time and publishes each title as it finishes. Image requests share a six-download limit, with at most two background downloads. Visible requests take priority over queued background work.

Credits use `source: 'cinemeta'`, the supplying meta URL, and the image source's terms URL. Posters from IMDb's CDN retain IMDb conditions; MetaHub images retain MetaHub terms. No author or free-content license is inferred. The media allowlist controls accepted image URLs.
