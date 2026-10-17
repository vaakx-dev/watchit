# Watchit redesign — front-end foundation (round 1)

Round 1 built the shared layer from the approved proposal: tokens, base styles, shared
components, the new shell and routes. Round 2 builds the pages on top of it. The API
contract is in `design/redesign-api.md`. Import types from `src/catalog/types.ts` and
`src/library/types.ts` and don't redeclare them.

> **Testing against the live server (`0.0.0.0:5173`): pick the `dev` profile, never `dry`.**
> `dry` is the owner's real library. A fresh browser context starts on the "Who's watching?"
> screen; choose `dev` there and type its PIN from `D:\app\watchit-dev-pin.txt` before you click
> anything that saves. dev is an admin: never change, demote or delete dry. Try lockouts only on a
> throwaway profile you create and delete yourself.

## Tokens: `src/styles/tokens.css`

Use the variables and don't hard-code colours. `main.tsx` imports the styles in this
order: font, tokens, base, icons, shell, catalog, tonight, discover, title, playback, personal,
my_shows, rankings, settings, profiles, loading.

| Group | Tokens |
|---|---|
| Surfaces | `--bg #0a0a0b`, `--s1`, `--s2`, `--s3` (raise a surface instead of adding a border), `--line` (bars, tab rails), `--rule` (list row dividers), `--scrim` (dark fill over artwork) |
| Text | `--t1` primary, `--t2` secondary (7.7:1), `--t3` labels and hints (4.6:1) |
| Eye accents | `--want`, `--watching`, `--paused`, `--watched`, `--dropped`, `--fav`. These are the only accents. White stays the action colour. |
| Status hook | Any element with `data-status="want|watching|paused|watched|dropped|favorite"` gets `--status` set to that colour. Tab underlines, the status button tint and the eye colour use it. |
| Stars and IMDb | `--star #fafafa`, `--star-off #6b6b73`, `--imdb` |
| Type | `--font` (Archivo Variable, self-hosted from `@fontsource-variable/archivo/wdth.css`), `--type-display 54`, `--type-page 28`, `--type-section 18`, `--type-body 15`, `--type-card 13`, `--type-meta 12` |
| Space | `--space-1…7` = 4, 8, 12, 16, 24, 32, 48. `--gutter` = clamp(16px, 4vw, 56px). Use the `.page-gutter` class for horizontal padding. |
| Radius | `--radius-poster 6`, `--radius-still 5`, `--radius-button 8`, `--radius-panel 10`, `--radius-full` (chips, icon buttons) |
| Layout | `--poster-width` (shelf card width: about 7 per row at 1440, 104px on phones), `--bar-height 56px`, `--tabs-height 60px` |

## Base classes: `src/styles/base.css`

- `.display`: condensed caps (850, wdth 66%). Use it **only for title names**, as
  `Heading` does. Page and section headings use normal width.
- `.meta`: row of meta items with `·` separators, 12/500 in `--t2`. Put an `ImdbScore`
  last (hero) and it gets no separator.
- Buttons, one set: `.button` plus `.primary` (white, for Play and the main action),
  `.secondary` (12% white) or `.ghost` (text only). Add `.small` for the 30px size.
  Icons inside are 16px.
- Icon button, one style: `.icon-button` (36px circle on `--s2`). Modifiers: `.ghost`,
  `.small` (30px, for rows), `.on-image` (blurred scrim over artwork). It needs an
  `aria-label`. `aria-pressed="true"` inverts it, which the Save toggle uses.
- Focus is a global 2px white ring with a 3px offset. Disabled is 40% opacity. Don't
  override either.
- `.page`, `.page-title`, `.page-body`, `.section-header`, `.empty-state`, `.back-link`
  are styled for the components below.

## Shared components

| Component | Path | Props / notes |
|---|---|---|
| `Page` | `src/ui/page.tsx` | `{ title, children }`. Page section with the 28px h1. Every top-level page uses it. |
| `SectionHeader` | `src/ui/section_header.tsx` | `{ id, title, link?: { href, label }, children? }`. h2 with an optional "See all →" link and controls on the right. |
| `Choices` | `src/ui/choices.tsx` | `{ label, options: Choice<T>[], value, on_change, look?: 'chips' \| 'segmented' \| 'tabs' }`. `Choice = { value, label, icon?, count?, status? }`. Buttons use `aria-pressed` in a labelled group. Use `'chips'` for filters, `'segmented'` for view switches (Tiers / Ranked) and `'tabs'` for the underline tabs. Set `status` and the active underline takes that eye colour. |
| `EmptyState` | `src/ui/empty_state.tsx` | `{ icon?, title, children? }`. The children name the next step, such as a `<p>` and a `.button` link. |
| `Icon`, `Eye` | `src/ui/icon.tsx`, `src/ui/eye.tsx` | Mask icons from `public/icons`. `settings` and `film` are new; `heart` is gone (favourite is the heart pupil). |
| `Card` | `src/catalog/components/card.tsx` | `{ entry: CatalogEntry, library }`. 2:3 poster, title clamped to 2 lines, then `IMDb · year · two genres`. The IMDb score shows only when `imdb_rating` is set. The eye overlay shows when a status or favourite is set, and on hover or focus otherwise (always on touch screens). |
| `RankedCard` | `src/catalog/components/ranked_card.tsx` | `{ rank, entry, library }`. Outlined number next to a `Card`, for Trending rows and the top 10. Put it inside a `Shelf`. |
| `TitleGrid` | `src/catalog/components/title_grid.tsx` | `{ entries, library }`. Fills columns of at least 160px (7 at 1440). Phones get 3 columns. |
| `Shelf` | `src/catalog/components/shelf.tsx` | `{ title, link?, children }`. `SectionHeader` plus a horizontal row that scrolls edge to edge, with prev/next buttons on hover devices. Children set their own width: `Card` uses `--poster-width`. For 16:9 Continue cards, give the child its own width (280px desktop, 190px phone). |
| `Artwork` | `src/catalog/components/artwork.tsx` | `{ src, eager?, label? }`. Pass `label` (the title) wherever a poster can be missing. A missing or broken image then shows the title on a tile tinted from the title. |
| `ImdbScore` | `src/catalog/components/imdb_score.tsx` | `{ score }`. Renders nothing for null or undefined. |
| `Hero` | `src/catalog/components/hero.tsx` | `{ title, reason, progress, library }`. The Tonight hero. Uses the backdrop, or a blurred poster when there is none. Holds the reason line, display title, meta and synopsis, then Play or Continue from `progress.next`, the labelled status button and Details. The title page uses its own `TitleHero` in `catalog/pages/title_hero.tsx`, with the poster, rating and credits. |
| Skeletons | `src/catalog/components/skeleton.tsx` | `HeroSkeleton()`, `ShelfSkeleton({ title })`, `GridSkeleton()`, `EpisodeSkeleton()`. They pulse, and stop under reduced motion. |
| `CatalogStatus` | `src/catalog/components/status.tsx` | Loading or error message with "Try again". |
| `StatusControls` | `src/library/components/status.tsx` | `{ title, library, labelled? }`. The eye menu is the only place to set status and favourite. Each status is a labelled row; the current one is tinted in its colour with a check, and tapping it again clears it. Favourite is a switch row under a divider. Desktop opens a popover below the trigger (above when it doesn't fit), left-aligned and kept in the viewport. Phones and touch screens (`(max-width: 640px), (pointer: coarse)`) get a bottom sheet with a scrim, "Status" and the title name, closed by the scrim, Escape, the close button or a swipe down. Arrow keys, Home and End move between rows; Escape and Tab close and return focus to the trigger. The rows live in `status_menu.tsx`, placement and keys in `library/menu.ts`. `labelled` gives the proposal's status button: eye, label (or "Favourite" / "Add status") and chevron on a 16% status tint. Use it next to Play. |
| `TrailerAction` | `src/catalog/components/trailer.tsx` | `{ title, trailers }`. Secondary "Trailer" button with the `film` icon; renders nothing without trailers. Opens a modal `<dialog>` with a 16:9 `youtube-nocookie.com` embed that autoplays, plus "Trailer n" chips when there are several. Closes on the close button, Escape or a scrim click, which unloads the player. Full width on phones. |
| `StatusEye` | `src/library/components/eye.tsx` | `{ status, favorite?, recommended? }`. Sets `data-status`, so it takes the colour. `recommended` adds a check badge (bottom-right, gap in the outline) in the status colour, white with no status. |
| `RatingControl` / `TitleRating` | `src/library/components/rating.tsx`, `title_rating.tsx` | Same API as before. Stars are `--star` on `--star-off` and the value shows next to them. Set the size with `--star-size` on a parent `.rating-control`: 22px title page, 17px default (seasons), 14px rows. Hit area is ≥ 32px. Place the stars on a solid or darkened area, never over raw artwork. |

## Profiles: `src/profiles/`

| Piece | Path | Notes |
|---|---|---|
| `ProfileGate` | `profile_gate.tsx` | Rendered by `main.tsx`. Loads `GET /api/profiles` and `GET /api/session`; shows the full-screen picker when this device has no valid session, otherwise renders `App` with the session's profile. |
| `ProfilePicker` | `profile_picker.tsx` | "Who's watching?" tiles (avatar, name, lock badge when `has_pin`). A tile without a PIN signs in at once; one with a PIN opens `PinPad`. Signed in (the `#/profiles` page) it adds "Sign out" and "Manage profiles" (admins, plus an "Add profile" tile) or "Edit profile" (non-admins, their own form). Before sign-in, "Add profile" shows only while no profile exists. |
| `PinPad` | `pin_pad.tsx` | Four dots, 3×4 round keys (68px, 76px on phones), Cancel and Delete. Digit keys, Backspace and Escape work from the keyboard. Submits on the 4th digit; a wrong PIN shakes the dots red, clears them and shows the server message; 429 disables the keys with an m:ss countdown. |
| `ProfileList` | `profile_list.tsx` | Admin "Manage profiles": a row per profile with Admin badge, PIN status, "You" and Edit, then "Add profile" and Done. |
| `ProfileForm` | `profile_form.tsx` | Add or rename. When editing it also shows `PinSettings` (`pin_settings.tsx`: set, change or remove; own PIN changes need the current PIN, admins reset others without it), and for admins `AdminSetting` (`admin_setting.tsx`) and `ProfileDelete` (`profile_delete.tsx`, typed-name confirm). The last profile and the only admin can't be deleted or demoted. |
| `ProfileAvatar` | `avatar.tsx` | `{ name, id? }`. Initial on a tile tinted with one of the eye accents, picked from the id. Size comes from `--avatar` on the parent. |
| Session | `session.ts`, `api.ts` | `active_session` (`{ token, profile }`) is read from `localStorage['watchit:session']` once per page load. `start_session` stores a new session, `end_session` drops it; both go to `#/` and reload. `api.ts` wraps the profile endpoints. |

A page load serves exactly one profile. The fetch client adds `X-Watchit-Session` to every
request and calls `end_session` on any 401, and the session response cache (`src/cache/responses.ts`) is stored per profile.
Switching reloads the page, so hooks, the optimistic library state and in-flight requests
from the previous profile are dropped, and the cache never serves one profile's data to
another. Picking the current profile just goes to Tonight.

The header shows the current profile's avatar after Settings on every width (phones keep the
5-tab bar); it links to `#/profiles`. Styles are in `src/styles/profiles.css`.

## Shell and routing

- `src/shell/header.tsx`: desktop top bar with the brand, Tonight, Discover, My shows,
  Rankings, `SearchField`, a Settings icon button and the profile avatar. Below 760px only
  the brand, Settings and the avatar remain. The search field appears only on `#/search`.
- `src/shell/tab_bar.tsx`: 5-tab bottom bar on phones (Tonight, Discover, Search,
  My shows, Rankings). `body` gets bottom padding for it.
- `src/shell/destinations.ts`: label, href and icon for each destination.
- `src/shell/search_field.tsx`: press `/` to focus. It submits to `search_route(q)`,
  and its value resets when you leave search. On an empty `#/search` the app focuses
  the field.

Routes (`src/navigation/route.ts`):

| Hash | Route | Renders now |
|---|---|---|
| `#/` | `{ view: 'tonight' }` | `catalog/pages/home.tsx` (old shelves, restyled) |
| `#/discover?type=movie\|series\|anime` | `{ view: 'discover', kind }` | `catalog/pages/collection.tsx` (type chips, genre and sort selects) |
| `#/mine?status=<Shelf>`, `#/mine?view=recent` | `{ view: 'mine', shelf }` (default `watching`) | `library/pages/my_shows.tsx`: status tabs with local counts. Saved and Recently opened show grids. The status tabs are placeholders. |
| `#/rankings` | `{ view: 'rankings' }` | `library/pages/rankings.tsx` (placeholder) |
| `#/search?q=` | `{ view: 'search', query }` | `Collection` |
| `#/profiles` | `{ view: 'profiles' }` | `profiles/profile_picker.tsx` (switch and manage profiles) |
| `#/settings`, `#/title/:id`, `#/watch/:id` | unchanged | unchanged |

The old routes are replaced in history: `#/movies|series|anime` go to
`#/discover?type=…`, `#/saved` to `#/mine?status=saved` and `#/history` to
`#/mine?view=recent`. Build links with `discover_route(kind)`, `mine_route(shelf)` and
`search_route(q)`. Don't write the strings by hand.

**Adding a page:**

1. Add the view to the `Route` union and parse it in `parse_route`. Add a builder if
   other pages link to it, and a test in `route.test.ts`.
2. Create the page in its feature folder (`<feature>/pages/<name>.tsx`) wrapped in
   `<Page title>`.
3. Render it in `src/app.tsx` behind `route.view === '<view>'`.
4. For a top-level destination, add it to `destinations.ts` and to both bars.

Filter changes write the hash (see `change_kind` in `collection.tsx`). `route_key` in
`app.tsx` uses only the view for `discover` and `mine`, so changing a filter or tab
doesn't scroll to the top or move focus.

## Loading behaviour

`use_import_page` in `src/catalog/api.ts` polls every 2.5 s while a page has no items
and is waiting for an import, so lists no longer sit on a skeleton for up to 30 s. Once
items show, it backs off from 1.5 s, doubling up to 30 s, until the missing artwork
arrives.

## Conventions

- snake_case for functions, variables and files. PascalCase for components. Keep files
  small and organised by feature (`catalog/`, `library/`, `playback/`, `shell/`, `ui/`
  for feature-neutral pieces). No comments, no dead code.
- Styles live in `src/styles/<feature>.css` and use tokens. When you remove markup,
  remove its CSS too.
- Copy: no tracked-out caps eyebrows. When a label is needed it states a reason, for
  example "#1 trending in Series". Empty states name the next step.
- Every icon-only control has an `aria-label`. Pressed states use `aria-pressed`. The
  current nav item uses `aria-current="page"`.

## Left for round 2

- **Tonight:** Continue watching (`GET /api/library/continue`), a trending hero with the
  "#N trending in …" reason, and a Trending row with `RankedCard`. The
  `use_trending` hook in `catalog/use_trending.ts` reads `GET /api/trending`.
- **Discover:** Trending and Top rated sorts, genre chips with "More genres"
  (`GenreOption.minor`) and Hide Watched/Dropped (`hide=`). The selects in
  `collection.tsx` are still the old controls.
- **Title page:** season picker, compact episode rows with the watched eye and a 30px
  play icon button, the up-next highlight, season rating on the season bar,
  "Continue S1 E4" from `progress.next`, and a poster beside the copy on desktop. The
  action row is Play, the labelled eye, Trailer (when there is one) and Save; there is
  no separate favourite button. The episode list now lives in
  `catalog/pages/title_episodes.tsx`.
- **Player:** source chips with the remembered `playback_source`, the "Finished?"
  prompt and the season sidebar. `playback/*` only got token colours and the new button
  classes.
- **My shows:** lists per status from `GET /api/library/titles` (use its `counts`
  instead of the local ones), list and grid views, and a type filter.
- **Rankings:** tiers and the ranked list (`GET /api/rankings`), drag to reorder
  (`PATCH /api/rankings/:id`).
- **Settings:** split into Playback, Library and Advanced sections.
