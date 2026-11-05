# Architecture Overview

A one-page map of how the app works. Details live in the code; each module starts with a short `@ai-` header that says what it does.

## Data flow

```
Browser                                   Next.js server                         External
───────                                   ──────────────                         ────────
CollectionsPage ─────────────────► /api/musicbrainz/collections ─┐
  (collection list in localStorage)                                │
useAlbums ─► progressive-loader ─► /api/musicbrainz/[...path] ─────┴► rate limiter ─► MusicBrainz
  │            (IndexedDB copy)      (collection page copy, SQLite)                    (~1 req/s per IP)
  │
  ├─► /api/prefetch/start ─► prefetch queue ('low' priority) ─► MusicBrainz, barcode lookups
  │
AlbumDetailsPanel
  ├─► /api/release-groups/[mbid] ─► server cache, else MusicBrainz ('high' priority)
  ├─► /api/streaming-links ─► server cache, else MusicBrainz links + barcode lookups
  │                            (Deezer, Apple Music, Spotify*, Tidal*; * with credentials)
  └─► /api/plex/albums ─► Plex Media Server (PLEX_TOKEN), releases matched via the release cache

CoverArtImage ─► /api/image ─► Cover Art Archive thumbnails ─► .image-cache/ (WebP, plus .missing markers for covers that don't exist, 7 days)
```

## Pages and navigation

| Route | Page |
|---|---|
| `/` | Redirects to the collection or series opened last, or to `/collections` on a first visit |
| `/collections` | Home (`CollectionsPage`): recently opened, "Open by MBID or URL", the signed-in user's collections grouped by entity type |
| `/collection/<mbid>` | A release group collection (album grid) or a series collection (`SeriesCollectionPage`, its series as cards or rows) |
| `/series/<mbid>` | A release group series; `?collection=<mbid>` when opened from a series collection, for the breadcrumb back |
| `/config` | Settings |

- `/collection/<mbid>` needs the collection's entity type before it renders; it comes from the stored collection list or is looked up once and remembered (`utils/collection-info.ts`). Paths are built in `utils/collection-routes.ts`.
- The header has the breadcrumb ("Collections / name", on phones a back arrow) and the account button (`UserAvatarButton`: profile, Settings, Log in or Log out).
- `CollectionFootnote` floats in the bottom-left corner with the name and count; it opens to the series homepage (`useSeriesHomepage`, from the series' URL relationships), the MusicBrainz link and Reload.

## Loading a collection

1. The page takes the collection or series MBID from its URL and stores it as the last opened one (`usePreferences`, localStorage).
2. `progressive-loader.ts` serves the IndexedDB copy if one exists. It checks the album count on MusicBrainz (one request, at most every 10 minutes) and reloads in the background only when the count changed, plus a full reload once a day.
3. Without a copy, `release-groups-helper.ts` loads the collection in pages of 100 through the `/api/musicbrainz` proxy (a series in one request through the series lookup). The proxy answers collection pages from its own copy (`collection-page-cache`), so a new browser loads a large collection in about a second; background refreshes send `x-mb-refresh: 1` for live data, which also updates the copy. A copy made while signed in is only served to signed-in requests.
4. Series lack genres, tags and ratings in the initial response; `/api/enhance-metadata` fills them in the background.
5. After loading, the client posts all MBIDs to `/api/prefetch/start` (skipped with `PREFETCH_ENABLED=false`).

## Album details and streaming links

- `/api/release-groups/[mbid]` returns release group, releases, tracklist and labels from the server cache, or fetches them (preferred release: oldest official, see `utils/release-selection.ts`).
- `/api/streaming-links?releaseGroup=<mbid>&country=DE` returns one result per album, resolved on the server by `lib/album-streaming-links.ts` from two sources (earlier wins):
  1. URL relationships of every release (best release, then Digital Media, XW, the rest): one live link per platform, a dead link falls back to the next release's link for that platform. Liveness checks are cached per URL for 24 hours
  2. The release barcode at Deezer and Apple Music (no key) and Spotify and Tidal (with client credentials), `lib/barcode-links.ts`
- The result is cached per album and country, fresh for 30 days (stale links are served and refreshed in the background), or 1 hour when a barcode provider failed (timeouts and rate limits are retried, real "nothing found" is kept). The prefetch writes the same entry, so prefetched albums open with their links at once
- All cache access goes through `getRgStreamingLinks` / `setRgStreamingLinks` in `streaming-links-cache.ts`

## Server caches (`src/lib/cache/`)

All server caches live in one SQLite file, `DATA_DIR/cache.db` (default `.cache/cache.db`), table `cache_entries` (`database.ts`). Every write goes to disk at once (WAL mode), so there is no periodic save and nothing to lose on a crash or deploy. The WAL file is kept small: `journal_size_limit` is 64 MB, and a `wal_checkpoint(TRUNCATE)` runs after the startup import and after each prefetch run.

| Cache | Content | Fresh for |
|---|---|---|
| `release-group-cache` | Release group metadata + release MBIDs | 60 days |
| `release-store` | Individual releases (group key: their release group) | 60 days |
| `streaming-links-cache` | Album streaming links and barcode lookups | 30 days (1 hour after a failed lookup) |
| `url-checks` (in `streaming-links-cache.ts`) | Whether a streaming URL is alive, per URL | 30 days |
| `collection-page-cache` | Collection listing pages (100 release groups each), per URL and signed in or not | Served at any age; refreshed by the browser's count check and daily reload |

- Stale-while-revalidate: entries are never deleted for age. Past its fresh time an entry is still served; a stale album is queued for a low-priority refresh (click, or the next collection load), stale album links are refreshed in the background, and stale barcode results and URL checks are looked up again inside that refresh.
- Fresh times of a day or more get ±15% random jitter (`jitteredTtlMs`), so albums loaded in one prefetch do not all go stale on the same day. At 60 days, a 1,700-album collection needs about 28 album refreshes a day.
- On first start, the JSON files of older versions (`.cache/<name>.json`) are imported (expired entries as stale) and renamed to `*.imported`, so upgrading fetches nothing again.
- Clicks and the prefetch share in-flight fetches (`release-group-fetches.ts`), so the same album is never fetched twice at once.
- Singletons live on `globalThis`, so every route bundle shares one instance and one database connection.

Client side, IndexedDB (`utils/db/`) keeps the collection and album details for offline-fast loading (the daily collection refresh keeps stored details). localStorage holds the preferences, the recently opened list (`utils/recently-opened.ts`, at most 8), the signed-in user's collection list and each collection's type and name (`utils/collection-info.ts`, refreshed in the background at most once a minute), and series homepages (`utils/series-homepage.ts`, one week).

## Rate limiting

- `lib/rate-limiter.ts` is a shared queue: MusicBrainz requests are released at least 1.1 s apart, user requests (`'high'`) before background work (`'low'`). A 503 pauses all requests (`Retry-After`, default 10 s).
- iTunes lookups: 3.1 s apart (about 20 per minute allowed).
- All limits are enforced on the server; client code never adds its own delays.
- MusicBrainz limits per IP, so servers on the same network share one budget.

## Authentication

OAuth2 with PKCE against MusicBrainz (`/api/auth/*`). Tokens stay in httpOnly cookies; the client only knows the expiry. `/api/auth/login?returnTo=<path>` keeps the page the login started from in a short-lived cookie (5 minutes, same-site paths only, `utils/return-to.ts`); the callback returns there with `auth_success` or `auth_error`, which `AuthResultToast` shows and removes from the address. `AuthProvider` and `PreferencesProvider` (root layout) hold one shared instance each, with one refresh timer for the whole app. The login asks for offline access (`access_type=offline`) so MusicBrainz issues a refresh token; if none comes back, the callback repeats the login once with the consent page forced (`approval_prompt=force`). Only a rejected refresh token (400/401 from MusicBrainz) clears the auth cookies; network errors, 429 and 5xx answer 503 and the client retries with backoff (30 s doubling to 5 min). Setup: [oauth_setup.md](oauth_setup.md).

## Security notes

- Every outgoing request from a route checks its target: the MusicBrainz proxy only forwards a few entity lookups, the image route only fetches Cover Art Archive and archive.org, streaming URL checks only contact known streaming hosts, and redirects are followed hop by hop against the same allowlists.
- Inputs (MBIDs, barcodes, URLs, country codes) are validated before they become cache keys or URL paths.
- Secrets (OAuth, Spotify, Tidal) are server-only environment variables, never `NEXT_PUBLIC_`.
