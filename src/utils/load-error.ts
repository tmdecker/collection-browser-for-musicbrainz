/**
 * @ai-file utility
 * @ai-description Plain-language reason a collection or series failed to load, for the error box
 * @ai-features
 * - MusicBrainz busy (503/429), unknown or private (404/401/403), unreachable (no answer at all)
 * - Anything else keeps its own message
 */

type LoadError = { response?: { status?: number }; request?: unknown; message?: string };

/** What to tell the user when loading the albums of a collection or series failed */
export const loadErrorMessage = (err: unknown, kind: 'collection' | 'series' = 'collection'): string => {
  const error = (err && typeof err === 'object' ? err : {}) as LoadError;
  const status = error.response?.status;
  if (status === 503 || status === 429) return 'MusicBrainz is busy right now.';
  if (status === 404) return `MusicBrainz doesn't know this ${kind}, or it is private.`;
  if (status === 401 || status === 403) return `This ${kind} is private. Log in as its owner to see it.`;
  if (status === undefined && error.request) return "Couldn't reach MusicBrainz. Check your connection.";
  return error.message || 'Unknown error';
};
