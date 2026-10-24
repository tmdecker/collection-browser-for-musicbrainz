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
  ├─► /api/validate-url, /api/streaming-links (Odesli, only with key)
  └─► /api/barcode-links ─► Deezer, Apple Music, Spotify*, Tidal*      (* with credentials)

CoverArtImage ─► /api/image ─► Cover Art Archive thumbnails ─► .image-cache/ (WebP)
```

## Loading a collection

1. The page reads the active collection ID from preferences (`usePreferences`, localStorage).
2. `progressive-loader.ts` serves the IndexedDB copy if one exists. It checks the album count on MusicBrainz (one request, at most every 10 minutes) and reloads in the background only when the count changed, plus a full reload once a day.
3. Without a copy, `release-groups-helper.ts` loads the collection in pages of 100 through the `/api/musicbrainz` proxy.
4. Series lack genres, tags and ratings in the initial response; `/api/enhance-metadata` fills them in the background.
5. After loading, the client posts all MBIDs to `/api/prefetch/start` (skipped with `PREFETCH_ENABLED=false`).

## Album details and streaming links

- `/api/release-groups/[mbid]` returns release group, releases, tracklist and labels from the server cache, or fetches them (preferred release: oldest official, see `utils/release-selection.ts`).
- Streaming links come from three sources, merged so earlier sources win:
  1. URL relationships stored on MusicBrainz releases (checked for liveness via `/api/validate-url`)
  2. Odesli, only when `ODESLI_API_KEY` is set (keyless access was shut down)
  3. The release barcode at Deezer and Apple Music (no key) and Spotify and Tidal (with client credentials), `lib/barcode-links.ts`

## Server caches (`src/lib/cache/`)

| Cache | Content | TTL |
|---|---|---|
| `release-group-cache` | Release group metadata + release MBIDs | 30 days |
| `release-store` | Individual releases, shared across release groups | 30 days |
| `streaming-links-cache` | Odesli results and barcode lookups | 7 days |

- Loaded from `.cache/*.json` at server start (`src/instrumentation.ts`), before the first request.
- Saved every 5 minutes and on shutdown. Writes go to a temp file that is renamed into place, so an interrupted save never corrupts the file. Each entry keeps its real expiry across restarts.
- Singletons live on `globalThis`, so every route bundle shares one instance.

Client side, IndexedDB (`utils/db/`) keeps the collection and album details for offline-fast loading; preferences live in localStorage.

## Rate limiting

- `lib/rate-limiter.ts` is a shared queue: MusicBrainz requests are released at least 1.1 s apart, user requests (`'high'`) before background work (`'low'`). A 503 pauses all requests (`Retry-After`, default 10 s).
- Odesli: 6 s between requests. iTunes lookups: 3.1 s apart (about 20 per minute allowed).
- All limits are enforced on the server; client code never adds its own delays.
- MusicBrainz limits per IP, so servers on the same network share one budget.

## Authentication

OAuth2 with PKCE against MusicBrainz (`/api/auth/*`). Tokens stay in httpOnly cookies; the client only knows the expiry. `AuthProvider` and `PreferencesProvider` (root layout) hold one shared instance each, with one refresh timer for the whole app. Setup: [oauth_setup.md](oauth_setup.md).

## Security notes

- Every outgoing request from a route checks its target: the MusicBrainz proxy only forwards a few entity lookups, the image route only fetches Cover Art Archive and archive.org, streaming URL checks only contact known streaming hosts, and redirects are followed hop by hop against the same allowlists.
- Inputs (MBIDs, barcodes, URLs, country codes) are validated before they become cache keys or URL paths.
- Secrets (OAuth, Odesli, Spotify, Tidal) are server-only environment variables, never `NEXT_PUBLIC_`.
