# Architecture Overview

A one-page map of how the app works. Details live in the code; each module starts with a short `@ai-` header that says what it does.

## Data flow

```
Browser                                   Next.js server                         External
───────                                   ──────────────                         ────────
useAlbums ─► progressive-loader ─► /api/musicbrainz/[...path] ─► rate limiter ─► MusicBrainz
  │            (IndexedDB copy)    /api/musicbrainz/collections                   (~1 req/s per IP)
  │
  ├─► /api/prefetch/start ─► prefetch queue ('low' priority) ─► MusicBrainz, barcode lookups
  │
AlbumDetailsPanel
  ├─► /api/release-groups/[mbid] ─► server cache, else MusicBrainz ('high' priority)
  └─► /api/streaming-links ─► server cache, else MusicBrainz links + barcode lookups
                               (Deezer, Apple Music, Spotify*, Tidal*; * with credentials)

CoverArtImage ─► /api/image ─► Cover Art Archive thumbnails ─► .image-cache/ (WebP, plus .missing markers for covers that don't exist, 7 days)
```

## Loading a collection

1. The page reads the active collection ID from preferences (`usePreferences`, localStorage).
2. `progressive-loader.ts` serves the IndexedDB copy if one exists. It checks the album count on MusicBrainz (one request, at most every 10 minutes) and reloads in the background only when the count changed, plus a full reload once a day.
3. Without a copy, `release-groups-helper.ts` loads the collection in pages of 100 through the `/api/musicbrainz` proxy.
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

All server caches live in one SQLite file, `DATA_DIR/cache.db` (default `.cache/cache.db`), table `cache_entries` (`database.ts`). Every write goes to disk at once (WAL mode), so there is no periodic save and nothing to lose on a crash or deploy.

| Cache | Content | Fresh for |
|---|---|---|
| `release-group-cache` | Release group metadata + release MBIDs | 60 days |
| `release-store` | Individual releases (group key: their release group) | 60 days |
| `streaming-links-cache` | Album streaming links and barcode lookups | 30 days (1 hour after a failed lookup) |
| `url-checks` (in `streaming-links-cache.ts`) | Whether a streaming URL is alive, per URL | 30 days |

- Stale-while-revalidate: entries are never deleted for age. Past its fresh time an entry is still served; a stale album is queued for a low-priority refresh (click, or the next collection load), stale album links are refreshed in the background, and stale barcode results and URL checks are looked up again inside that refresh.
- Fresh times of a day or more get ±15% random jitter (`jitteredTtlMs`), so albums loaded in one prefetch do not all go stale on the same day. At 60 days, a 1,700-album collection needs about 28 album refreshes a day.
- On first start, the JSON files of older versions (`.cache/<name>.json`) are imported (expired entries as stale) and renamed to `*.imported`, so upgrading fetches nothing again.
- Clicks and the prefetch share in-flight fetches (`release-group-fetches.ts`), so the same album is never fetched twice at once.
- Singletons live on `globalThis`, so every route bundle shares one instance and one database connection.

Client side, IndexedDB (`utils/db/`) keeps the collection and album details for offline-fast loading (the daily collection refresh keeps stored details); preferences live in localStorage.

## Rate limiting

- `lib/rate-limiter.ts` is a shared queue: MusicBrainz requests are released at least 1.1 s apart, user requests (`'high'`) before background work (`'low'`). A 503 pauses all requests (`Retry-After`, default 10 s).
- iTunes lookups: 3.1 s apart (about 20 per minute allowed).
- All limits are enforced on the server; client code never adds its own delays.
- MusicBrainz limits per IP, so servers on the same network share one budget.

## Authentication

OAuth2 with PKCE against MusicBrainz (`/api/auth/*`). Tokens stay in httpOnly cookies; the client only knows the expiry. `AuthProvider` and `PreferencesProvider` (root layout) hold one shared instance each, with one refresh timer for the whole app. Setup: [oauth_setup.md](oauth_setup.md).

## Security notes

- Every outgoing request from a route checks its target: the MusicBrainz proxy only forwards a few entity lookups, the image route only fetches Cover Art Archive and archive.org, streaming URL checks only contact known streaming hosts, and redirects are followed hop by hop against the same allowlists.
- Inputs (MBIDs, barcodes, URLs, country codes) are validated before they become cache keys or URL paths.
- Secrets (OAuth, Spotify, Tidal) are server-only environment variables, never `NEXT_PUBLIC_`.
