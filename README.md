# Watchit

Local movie, series, and anime catalog with Cinemeta metadata and artwork, plus embedded playback. No signup or API key is required for catalog access.

## Run

Requires Node.js 22.13+ and npm.

```sh
npm install
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173`.

```sh
npm run build
npm run preview
```

Both servers bind to loopback. Preview includes the Node API; static-only hosting is not supported.

## Storage

`data/` contains SQLite, downloaded images, provider mappings, and attribution records. Set `STREAMIT_DATA_DIR` to use another directory outside `public/`. Stop the app before backing up this directory.

Catalog reads use SQLite. Background workers import Cinemeta catalogs and cache the image URLs supplied with their metadata. A new library needs network access for its first import. Existing titles remain readable when the source is unavailable.

The browser keeps up to 32 recent API responses per profile in the current tab, within a bounded session cache. Reloads render cached pages and confirmed library state first, then refresh from SQLite in the background. Pending personal changes are not stored in this browser cache. Settings are always read from the server.

Profiles keep ratings, watch status, favourites, rankings, history and playback sources apart. Each device signs in to a profile on the "Who’s watching?" screen and stays signed in until it signs out or switches; the avatar in the header switches or manages profiles. A profile can have a 4-digit PIN, set under Edit profile. Edit profile also sets the picture: upload a photo (cropped to a square) or shuffle the generated eye. Five wrong PINs pause tries for 30 seconds, doubling up to 15 minutes. Admins add, rename and delete profiles, reset PINs and grant admin; other profiles change only their own name and PIN. When testing against the live server, use the `dev` profile, never `dry`; dev's PIN is in `D:\app\watchit-dev-pin.txt`. The API is in `design/redesign-api.md`.

Movies and series use IMDb IDs, such as `tt0133093`. Episode IDs combine the parent IMDb ID, season, and episode, such as `tt0903747:1:2`.

Movie, show, season, and episode ratings are independent and do not expire. Ratings use half-star steps from 0.5 to 5 and save when you finish selecting. Arrow keys adjust a rating; Delete clears it.

Watch status supports want to watch, watching, paused, watched, and dropped. The eye menu is available on title pages and catalog cards. Want is white, watching green, watched blue, paused yellow, and dropped red. Favourite is a switch in the same menu; it replaces the pupil with a pink heart without changing watch status.

Selections update immediately and save in the background. Failed changes roll back without discarding later selections. Favourites, My list, and history are stored independently. Opening or rating a title does not mark it watched.

## Cache settings

| Setting | Default | Behavior |
| --- | --- | --- |
| Metadata freshness | 24 hours | Refresh Cinemeta metadata and image references. Existing titles remain readable. |
| Image freshness | 30 days | Reuse downloaded images. |
| Image stale fallback | 7 days | Serve expired images during refresh failures. Set to 0 to disable. |
| Image budget | 1,024 MiB | Evict least recently used files on download. |

Change these in Settings / Cache.

- `STREAMIT_SYNC=off`: stop both background workers.
- `STREAMIT_ARTWORK=off`: stop background image downloads only.
- `/api/imports`: metadata import status.
- `/api/artwork`: artwork status.

Image requests can still download missing or expired files when background workers are disabled. Visible images take priority over background poster prefetching. Backdrops load on demand, without holding up posters. Fresh, versioned artwork is reusable from the browser cache for its remaining image lifetime; stale and unversioned images still require server validation.

## Playback mappings

The player keeps episode navigation visible beside the video on desktop and below it on narrow screens. Seasons have separate ratings; episode rows have no rating controls. The current episode rating is above the video. Sources and previous/next controls are below it.

Most players use stored IMDb or TMDB identifiers. Episodes require a series identifier and explicit season and episode numbers.

For 1Anime, add mappings to `data/providers.json`, using the local title or episode ID and its verified 32-character lowercase hexadecimal video ID:

```json
{
  "tt0877057:1:1": {
    "one_anime": "0123456789abcdef0123456789abcdef"
  }
}
```

Replace both example values with the actual identifiers. Player frames are unsandboxed and may open provider-controlled tabs. Cross-origin playback progress is unavailable.

## Source records

[attribution/](attribution/README.md) indexes source references and generated credits. Generated records and manual documents are stored under `<data directory>/attribution/`.

## Checks

```sh
npm run typecheck
npm test
npm run build
```
