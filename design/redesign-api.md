# Watchit redesign — API contract

Status: **implemented** (all endpoints below are live on the dev server). Types live in
`src/catalog/types.ts` and `src/library/types.ts`; import them, don't redeclare.

Conventions (unchanged): JSON, snake_case, `Cache-Control: no-store`, errors are
`{ "error": string }` with 4xx/5xx. Pages are 24 items, `page` is 1-based,
`has_next` tells you whether another page exists. `artwork_status` / `imports`
are the same polling hints as today (poll while `pending` and items lack artwork).

Everything below is additive: existing fields and endpoints keep working, except that personal
endpoints now need a profile (next section).

> **Agents and testers: use the `dev` profile, never `dry`.** `dry` holds the owner's real
> library on the live server (`0.0.0.0:5173`). dev has a PIN; read it from
> `D:\app\watchit-dev-pin.txt` (outside the project, so Vite can't serve it), sign in with
> `POST /api/profiles/2/session {"pin":"…"}` and send the returned token as `X-Watchit-Session`.
> dev is an admin: never rename, delete, demote or change the PIN of dry, and never sign in as dry.
> In the browser pick `dev` on the "Who's watching?" screen and type the PIN. Five wrong PINs lock
> the profile and your IP for 30 s or more.

---

## Profiles

Netflix-style profiles with optional 4-digit PINs. Every personal record belongs to one profile; the
catalog, title snapshots, trending, images, cache settings (`/api/cache`) and the metadata
cache stay global. The migration moved all existing personal data to a profile named `dry`
and created an empty `dev` profile; a later migration made both admins and gave dev a random PIN.

```ts
type Avatar = { kind: 'eyes'; seed: number } | { kind: 'image'; url: string };
type Profile = { id: number; name: string; created_at: string; is_admin: boolean; has_pin: boolean; avatar: Avatar }; // src/profiles/types.ts
type ProfileSession = { token: string; profile: Profile };
type SessionState = { profile: Profile | null };
```

PINs and their hashes are never returned; `has_pin` says whether one is set.

**Sessions.** A device signs in with `POST /api/profiles/:id/session` and gets a random token. The
server stores only its SHA-256 hash (with `profile_id`, `created_at`, `last_used_at`). The client
keeps `{ token, profile }` in `localStorage['watchit:session']` and sends the token in the
`X-Watchit-Session` header (`SESSION_HEADER`) from `src/catalog/client.ts`. A custom header can't be
sent cross-origin without CORS, and writes also keep the same-origin check. Sessions last until
sign-out, switching profile on that device, the profile's PIN changing, or the profile being deleted.
The old `X-Watchit-Profile` header is ignored. These answer **401** without a valid session:

- `GET /api/library`, `/api/library/titles`, `/api/library/continue`, `/api/rankings`
- `GET /api/titles/:id` (its `playback_source` and `progress` are personal)
- `GET /api/catalog` and `/api/trending` **only when `hide=` is set** (hidden statuses are the profile's)
- `PATCH /api/library/:id`, `/api/library/:id/seasons/:season`, `/api/library/:id/playback`, `/api/rankings/:id`
- every profile write below except signing in (and creating the very first profile)

On a 401 the front end drops its stored session and reloads to the picker.

| Endpoint | Body | Who | Response |
|---|---|---|---|
| `GET /api/profiles` | | anyone | `Profile[]`, oldest first |
| `POST /api/profiles/:id/session` | `{ "pin"?: "1234" }` | anyone (PIN if set) | 201 `ProfileSession`; ends the session sent with it |
| `GET /api/session` | | anyone | `SessionState` for the sent token |
| `DELETE /api/session` | | anyone | `{ "profile": null }`; signs this device out |
| `POST /api/profiles` | `{ "name": string }` | admin (anyone while no profile exists) | 201 `Profile` |
| `PATCH /api/profiles/:id` | `{ "name"?: string, "is_admin"?: boolean }` | name: self or admin; `is_admin`: admin | `Profile` |
| `PATCH /api/profiles/:id/pin` | `{ "pin": "1234" \| null, "current_pin"?: "0000" }` | self (needs `current_pin` if a PIN is set) or admin (no current PIN) | `Profile` |
| `DELETE /api/profiles/:id` | `{ "confirm": "<current name>" }` | admin | remaining `Profile[]` |
| `GET /api/profiles/:id/avatar` | | anyone | the photo as `image/webp`; 404 without one |
| `PUT /api/profiles/:id/avatar` | raw image, `Content-Type: image/*`, up to 5 MB | self or admin | `Profile` |
| `DELETE /api/profiles/:id/avatar` | | self or admin | `Profile`, back to the eyes |
| `POST /api/profiles/:id/avatar/shuffle` | | self or admin | `Profile` with a new eyes seed |

- Names are trimmed, 1–24 characters, no control characters, unique ignoring case. Errors are 400.
- PINs are exactly 4 ASCII digits (400 otherwise). They are stored as scrypt hashes with a per-profile
  salt (`profile_pins`) and compared in constant time.
- Wrong or missing PIN: **403** `Wrong PIN. 3 tries left before a pause.` After 5 failures for a profile
  or for a client IP the next tries get **429** with `Retry-After` (seconds): 30 s, doubling per further
  failure up to 15 min. Counters live in `pin_attempts`, so restarts keep them; a correct PIN clears
  them and setting a profile's PIN clears that profile's counter. Profiles without a PIN never hit the limit.
- Changing, resetting or removing a PIN revokes that profile's other sessions (the caller's own
  session is kept when it changes its own PIN).
- The first profile ever created is an admin; later ones aren't. The last admin can't be demoted or
  deleted and the last profile can't be deleted (400).
- Non-admins get **403** for creating, deleting, `is_admin`, and renaming or setting the PIN of others.
- `DELETE` needs the profile's exact current name in `confirm` and removes all its personal rows and
  sessions. Unknown ids are 404.
- Avatars: without a photo, `avatar` is `{ kind: 'eyes', seed }` and the client draws the Watchit eye from
  `"<id>:<seed>"` (`src/profiles/avatar.tsx`), so renaming keeps it. Uploads are decoded with sharp, auto-rotated,
  stripped of metadata, centre-cropped to 256×256 and stored as WebP q80 in `profile_avatars`; non-images get 400,
  other content types 415, bodies over 5 MB 413. `url` carries `?v=<updated_at>`; that URL is cached as immutable,
  others revalidate with the ETag.
- Writes share the same-origin check (403 for a foreign `Origin`). Other methods are 405.

Runtime constants you can import: `CATALOG_SORTS` (`src/catalog/types.ts`), `SHELVES`, `LIBRARY_SORTS`,
`STATUSES`, `RATINGS` (`src/library/types.ts`). New types: `CatalogSort`, `GenreOption`, `TrendingKind`,
`TrendingEntry`, `TrendingPage`, `TrendingQuery`, `Shelf`, `LibrarySort`, `LibraryQuery`, `SeriesProgress`,
`LibraryItem`, `LibraryPage`, `ContinuePage`, `RankedItem`, `RankingTier`, `Rankings`, `PlaybackPreference`, `Trailer`.
Changed: `CatalogEntry.imdb_rating?`, `Title.popularity?`, `Title.trailers?`, `CatalogPage.genres: GenreOption[]`,
`CatalogQuery.sort: CatalogSort`, `CatalogQuery.hide?`, `TitleResult.playback_source`, `TitleResult.progress`.

---

## Shared changes

### `CatalogEntry` (every card, every list)

```ts
type CatalogEntry = {
  id: string; title: string; year: number | null; artwork: string;
  genres: string[];            // CHANGED: normalised labels, duplicates merged, hidden genres removed
  kind: MediaKind; anime: boolean;
  imdb_rating?: number | null; // NEW: 0.1–10, one decimal. Server always sends it (null = unknown).
};
```

- **Cards: show `genres.slice(0, 2)`.** Order is Cinemeta's, after merging.
- `imdb_rating` is optional in the type only so old fixtures compile; the API
  always includes it. Episodes always have `null`.
- Ratings fill in as the background import re-reads Cinemeta (see coverage notes
  at the end); until a title is re-imported it is `null`.

### Genre normalisation

Applied to `CatalogEntry.genres`, `Title.genres`, the genre facet and the
`genre=` filter. Source of truth: `server/catalog/genres.ts`.

| Source genre(s)            | Becomes                    |
|----------------------------|----------------------------|
| Sci-Fi, Science Fiction    | Science Fiction (`science-fiction`) |
| Sci-Fi & Fantasy           | Science Fiction + Fantasy  |
| Action & Adventure         | Action + Adventure         |
| War & Politics             | War                        |
| Reality, Reality-TV        | Reality-TV (`reality-tv`)  |
| Talk, Talk-Show            | Talk-Show (`talk-show`)    |
| Kids                       | Family                     |
| Adult                      | hidden (removed everywhere; titles themselves are still listed) |

`minor: true` ("More genres"): Reality-TV, Talk-Show, Game-Show, News, Soap, TV Movie, Short.

```ts
type GenreOption = { id: string; label: string; minor: boolean };
```

---

## Changed endpoints

### `GET /api/catalog` (Discover)

Query params (existing + new):

| param  | values | default | notes |
|--------|--------|---------|-------|
| `page` | 1… | 1 | |
| `kind` | `all` `movie` `series` `anime` | `all` | |
| `sort` | `newest` `title` **`trending`** **`top_rated`** | `newest` | |
| `query`| text ≤ 200 | | |
| `genre`| canonical genre id from the facet, e.g. `science-fiction` | | old ids such as `sci-fi` still match only titles tagged exactly that |
| **`hide`** | comma list of eye statuses, e.g. `watched,dropped` | none | excludes titles whose own status is in the list (the legacy watched flag counts as `watched`) |

- `sort=trending`: titles in the latest trending snapshot first, by rank (for `all`
  the movie and series lists are interleaved: both #1s, then both #2s …, ties by newest),
  then every other title by newest. `kind=anime` uses the anime list. Trending covers the top ~500 per list.
- `sort=top_rated`: titles with enough popularity to qualify (see "Top rated
  guard") by `imdb_rating` desc, then the rest by `imdb_rating` desc, unrated last.

Response: `CatalogPage` (unchanged shape; `genres` is now `GenreOption[]`).

```json
{ "items": [{ "id": "tt0903747", "title": "Breaking Bad", "year": 2008, "artwork": "/api/images/…?v=…",
    "genres": ["Crime", "Drama"], "kind": "series", "anime": false, "imdb_rating": 9.5 }],
  "page": 1, "has_next": true,
  "genres": [{ "id": "action", "label": "Action", "minor": false }, { "id": "news", "label": "News", "minor": true }],
  "freshness": { "updated_at": "…", "stale": false }, "imports": { … }, "artwork_status": { … } }
```

### `GET /api/titles/:id` (title page and watch page)

New top-level fields on `TitleResult`:

```ts
type TitleResult = {
  title: Title;                      // title.imdb_rating, title.genres normalised, title.trailers always an array
  freshness: Freshness;
  playback_source: string | null;    // NEW: remembered provider id ("vidsrc", "2embed", …). For an episode id this is the series' choice.
  progress: SeriesProgress | null;   // NEW: for a series (or an episode: its series), last opened + next episode; null for movies
  imports?: ImportStatus; artwork_status?: ArtworkStatus;
};
type SeriesProgress = {
  last: EpisodeEntry | null;  // most recently opened episode
  next: EpisodeEntry | null;  // episode after `last`; if nothing opened yet, S1E1 (first non-special); null when caught up or episodes not imported yet
  opened_at: string | null;   // ISO time `last` was opened
};
```

"Continue S1 E4" on the title page = `progress.next`.

`title.trailers: Trailer[]` (`type Trailer = { id: string }`) lists YouTube video ids in Cinemeta's
order, for `https://www.youtube-nocookie.com/embed/<id>`. Only Cinemeta `trailers` entries of type
`Trailer` whose `source` matches `/^[A-Za-z0-9_-]{11}$/` are kept, without duplicates. Episodes always
have `[]`. The type marks it optional because snapshots stored before this field lack it; the API
sends `[]` for them. Cinemeta's `trailerStreams[].title` is just the title name, so it isn't stored.

### `PATCH /api/library/:id` (unchanged request/response)

Side effect on rankings when `rating` changes on a movie/series:
- first rating, or rating raised → title goes to the **bottom** of its new tier;
- rating lowered → title goes to the **top** of its new tier;
- rating cleared (`null`) → title leaves the rankings.

The player keeps calling `library.remember(id)` (`{ opened: true }`) with the
**episode** id; that is what records the last opened episode per series. No change needed.

### `PATCH /api/library/:id/seasons/:season` — rate or mark a season

Body is exactly one of `{ "rating": Rating | null }` (returns `LibrarySnapshot`) or `{ "watched": boolean }`.
`watched: true` sets every stored episode of that season (only that season; specials only when `:season` is `0`)
to status `watched` in one transaction; `false` clears the status of those that are `watched`. It returns
`SeasonWatched = LibrarySnapshot & { progress: SeriesProgress }`, so Up next moves past the season. The series'
own status is never changed. While the series' episode import is pending it answers **409** with
`Retry-After: 2`; the client retries.

---

## New endpoints

### `GET /api/trending` — trending lists (hero, "Trending this week" row, top 10)

| param  | values | default |
|--------|--------|---------|
| `kind` | `all` `movie` `series` `anime` | `all` |
| `page` | 1… | 1 |
| `hide` | comma list of statuses (e.g. all five = "titles I haven't marked") | none |

```ts
type TrendingEntry = CatalogEntry & { rank: number }; // 1-based rank in its kind's list (for kind=all: in the movie or series list, see item.kind)
type TrendingPage = { items: TrendingEntry[]; page: number; has_next: boolean;
  day: string | null;            // snapshot date "YYYY-MM-DD" (UTC); null = no snapshot recorded yet
  imports?: ImportStatus;         // pending while the first snapshot is being fetched
  artwork_status?: ArtworkStatus };
```

```json
{ "items": [{ "id": "tt22084616", "title": "Spider-Man: Brand New Day", "year": 2026, "artwork": "…",
    "genres": ["Action", "Adventure"], "kind": "movie", "anime": false, "imdb_rating": 8, "rank": 1 }],
  "page": 1, "has_next": true, "day": "2026-10-16", "imports": { … }, "artwork_status": { … } }
```

Hero label: `#${item.rank} trending in ${label}` where `label` is the list you asked for (`kind=anime` → Anime),
or for `kind=all` the item's own kind (`movie` → Movies, `series` → Series). For "top 5 I haven't marked yet" pass
`hide=want,watching,paused,watched,dropped`; the ranks stay the list positions (they skip hidden titles, they aren't renumbered).

### `GET /api/titles/:id/related` — Prequels & sequels, More like this

Session optional: with `X-Watchit-Session`, titles the profile marked watched or dropped go to the end of `similar`.

```ts
type FranchiseEntry = CatalogEntry & { position: number; current: boolean }; // position: 1-based place in the whole franchise
type RelatedTitles = {
  franchise: { name: string | null; items: FranchiseEntry[] } | null; // null when fewer than 2 members are in the catalog
  similar: CatalogEntry[];  // up to 12, same kind, never the title itself or its franchise
  pending: boolean;         // Wikidata lookup or franchise imports still running: poll
  artwork_status?: ArtworkStatus };
```

- **Franchise** comes from Wikidata (`query.wikidata.org/sparql`, no key) by IMDb id (P345): the smallest
  "part of the series" (P179) holding the title, ordered by "series ordinal" (P1545) then publication date (P577);
  without one, up to 4 "follows"/"followed by" (P155/P156) steps each way, by date. At most 15 items around
  the current one are returned. Members not in the catalog get the usual single-title import and appear on a later poll.
- Lookups run in the background one at a time (1 s apart, 20 s timeout) and never block `GET /api/titles/:id`.
  Cached in `metadata_cache` under `wikidata:franchise:v1:<imdb id>`: 30 days when found, 7 days when not, 1 h after a failure
  (the previous result is kept and served meanwhile). `server/related/`.
- **Similar** is local: candidates share at least two normalised genres (one for single-genre titles), then
  score = shared genres ×2 + shared director/cast ×1.5 + year closeness + `imdb_rating`/5 + same anime flag. ~30–80 ms.

### `GET /api/library/titles` — My shows

| param  | values | default |
|--------|--------|---------|
| `status` | `want` `watching` `paused` `watched` `dropped` `favorite` `recommended` `saved` `recent` | `watching` |
| `kind` | `all` `movie` `series` `anime` | `all` |
| `sort` | `recent` (last opened, newest first) `title` `newest` (year) `rating` (your rating, then rank position) | `recent` |
| `page` | 1… | 1 |

`recent` is the old History: every movie/series you opened, with episode opens
folded into their series. Episodes are never listed as items.

**Recommended** is a per-profile on/off flag like `favorite`, independent of status: `PersonalEntry.recommended: boolean`
(in `GET /api/library`, title responses and `LibraryItem.entry`), set with `PATCH /api/library/:id { recommended: boolean }`,
stored as a row in `personal_recommended (profile_id, id)`.

```ts
type Shelf = Status | 'favorite' | 'recommended' | 'saved' | 'recent';
type LibraryItem = {
  title: CatalogEntry;
  entry: PersonalEntry;            // the title's own personal entry (defaults if only episodes were opened)
  opened_at: string | null;        // latest open of the title or any of its episodes
  progress: SeriesProgress | null; // series only
};
type LibraryPage = { items: LibraryItem[]; page: number; has_next: boolean;
  total: number;                    // items in this shelf for this kind
  counts: Record<Shelf, number>;    // per-tab counts for this kind
  artwork_status?: ArtworkStatus };
```

Season ratings for the rows come from the existing `GET /api/library` → `seasons[series_id]`.

### `GET /api/library/continue` — Continue watching row

| param  | values | default |
|--------|--------|---------|
| `kind` | `all` `movie` `series` `anime` | `all` |
| `page` | 1… | 1 |

Titles whose status is `watching` or `paused`, most recently opened first
(never-opened ones last). Response `ContinuePage = { items: LibraryItem[]; page; has_next; artwork_status? }`.
For series, `progress.next` is the "Next · S2 E5" episode; `entry.status`
distinguishes Paused. Series whose episodes aren't imported yet get an import
queued; `progress.next` fills in on a later poll.

### `PATCH /api/library/:id/playback` — remember the chosen source

Body `{ "source": "vidsrc" }` (provider id, `[a-z0-9-]`, ≤ 32 chars) or `{ "source": null }` to forget.
For an episode id the choice is stored on its series ("remembered per title").
Response `PlaybackPreference = { id: string; source: string | null }` where `id` is the id it was stored under.
Read it back from `GET /api/titles/:id` → `playback_source`.

### `GET /api/rankings` — tiers and ranked list

| param  | values | default |
|--------|--------|---------|
| `kind` | `all` `movie` `series` `anime` | `all` |

```ts
type RankedItem = LibraryItem & {
  rank: number;      // 1-based position in the whole ranked list (for this kind)
  position: number;  // 1-based position inside its tier (for this kind)
};
type RankingTier = { rating: Rating; items: RankedItem[] };  // only non-empty tiers, 5 → 0.5
type Rankings = { kind: CatalogKind; tiers: RankingTier[] };
```

Only movies and series you rated (episode ratings are excluded; season
ratings stay in `GET /api/library`). Inside a tier: manual order first, then
titles never moved by last opened. Not paginated (it's your ratings).
"≤ 3.5" style grouping is a front-end choice.

### `PATCH /api/rankings/:id` — reorder inside a tier

Body `{ "before": "<id>" }` to place `:id` directly above another title of the
**same rating**, or `{ "before": null }` to move it to the bottom of its tier.
Optional `?kind=` only selects which `Rankings` view comes back. 400 if `:id`
isn't rated or `before` has a different rating. Response: `Rankings`.

---

## Data notes

**Trending refresh.** A background job per list (`trending:movie`, `trending:series`, `trending:anime`) reads
Cinemeta `catalog/{movie|series}/top` pages 1–10 (anime: the `genre=Animation` top lists of both types, keeping
titles classified as anime, interleaved series/movie) at most once every 24 h, through the same rate-limited
queue as the rest of the import (1 request/s, interactive requests jump ahead). ~40 requests/day. Responses
can come from the metadata cache (`metadata_hours`, default 24 h). Each run is stored as a dated snapshot
(table `trending`, 30 days of history) and as `catalog.trending_rank` / `catalog.anime_rank` for sorting.
Depth: ~500 ranked titles per list (movie 495, series 500, anime 483 on 2026-10-16).

**Trending stability.** Cinemeta regenerates `top` a few times a day (`Last-Modified` 08:03 GMT, CDN
`max-age` 4 h). Within a generation the order is fully stable (today's snapshot vs a crawl 25 min earlier:
top 100 identical, position for position). Over ~4 weeks it churns a lot (2026-09-20 vs 2026-10-16 —
movies: top-10 overlap 2, top-50 27, top-100 60, top-300 206; series: 3, 24, 61, 228). Day-to-day churn isn't
measured yet; the history table makes it a one-line query after a few days. The list order is not
Cinemeta's `popularity` score (#1 25.6, #2 1.8), so the position is what's stored.

**IMDb rating coverage.** Cinemeta provides `imdbRating` (string, `""` when unknown) on ~96 % of metas
(sampled at depths 0–20 000: movies 239/249, series 240/250). There is **no vote count** in Cinemeta
(catalog or meta), so none is stored. Stored coverage grows as the background crawl re-reads the catalog
(it now keeps `imdbRating` and `popularity`): 5 135 of 38 055 titles (13.5 %) right after the change, plus
the ~1 500 trending titles; the full movie list takes roughly half a day at the current crawl pace. Titles
that were only ever imported by a search fill in when their detail page is opened.

**Top rated guard.** No votes, so the guard uses Cinemeta's current `popularity` (Stremio score):
titles with a rating and popularity ≥ 0.2 come first (roughly the top ~1 500 movies / ~3 000 series),
then every other rated title by rating, then unrated titles. Popularity is a recent-activity score, so this
is a proxy, not a vote floor. Exact votes would need another source (e.g. IMDb's `title.ratings.tsv`).

**Anime classification** is unchanged: Animation + any Japanese country counts as anime, so US/Japan
co-productions (e.g. Toy Story 3) appear in the anime list.

**Profiles schema.** `profiles (id, name UNIQUE COLLATE NOCASE, created_at, is_admin, avatar_seed)`, `profile_avatars (profile_id, image, updated_at)`, `profile_pins (profile_id, salt, hash)`, `sessions (token_hash, profile_id, created_at, last_used_at)` and `pin_attempts (scope, failures, locked_until)` (scope `profile:<id>` or `client:<ip>`), from `server/storage/access_schema.ts`. Its one-time migration adds `is_admin`, makes dry, dev and the oldest profile admins and writes dev's new PIN to `D:\app\watchit-dev-pin.txt` (`STREAMIT_DEV_PIN_FILE` overrides it); a copy of the database from just before it is in `D:\app\streamit-backup-2026-10-16\data-before-pins\`. `personal`,
`personal_status`, `personal_favorites`, `personal_recommended`, `season_ratings`, `ranking_positions` and `playback_sources`
have a leading `profile_id` (`REFERENCES profiles(id) ON DELETE CASCADE`) in a composite primary key,
and the `library_entries` / `library_titles` views carry `profile_id`; filter them by it. The
one-time migration (`server/storage/profile_schema.ts`) renames the old tables, recreates them,
copies every row to `dry`, adds `dev` and checks foreign keys, all in one transaction. A copy of
the database from just before it is in `D:\app\streamit-backup-2026-10-16\data-before-profiles\`.

**Schema (additive).** New `catalog` columns `imdb_rating`, `popularity`, `trending_rank`, `anime_rank`;
tables `trending`, `ranking_positions`, `playback_sources`; views `library_entries`, `library_titles`;
indexes for the new sorts. Cinemeta response cache key moved to `cinemeta:response:v3:` (the projection
changed); the old `v2` rows (~29 MB) are no longer read.

**Trailers.** Cinemeta sends `trailers: [{ source, type }]` (and `trailerStreams: [{ ytId, title }]`, the
`Trailer` entries of the same list) on both catalog and meta responses. Sampled 2026-10-16 across movie and
series `top` lists at skips 0–2 000: 474 of 497 titles (95 %) have at least one trailer; types were 841
`Trailer`, 1 `Teaser`, 1 `Clip`. The projection now keeps `trailers`, so the response cache key moved to
`cinemeta:response:v4:` (the `v3` rows are no longer read). Catalog crawls fill `trailers` in as they
re-read pages. A movie or series snapshot without the field counts as stale detail
(`detail_fresh` in `server/catalog/freshness.ts`), so opening its title page queues the usual
per-title import and the page polls (`awaiting_refresh`) until it lands; nothing re-crawls the catalog.
