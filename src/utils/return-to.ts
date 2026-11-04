/**
 * @ai-file utility
 * @ai-description Where to send the browser after the OAuth login: the page the login started from
 * @ai-features Same-origin path validation (no open redirect), auth result query parameter
 */

/** Cookie that carries the starting page through the OAuth round trip */
export const RETURN_TO_COOKIE = 'mb_oauth_return_to';

const MAX_LENGTH = 2048;

/**
 * Returns the value if it is a path on this site, otherwise '/'
 * Security: only plain paths starting with a single '/' are accepted, so '//evil.com', '/\evil.com'
 * or 'https://evil.com' can never turn the login into an open redirect. API routes are refused too
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || value.length > MAX_LENGTH) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  // Control characters (tabs, newlines) are dropped by URL parsers and could hide a second slash
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'http://localhost');
    if (url.origin !== 'http://localhost') return '/';
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return '/';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
}

/** Adds the login result (auth_success / auth_error) to the return path, keeping its own query */
export function withAuthResult(returnTo: string, key: 'auth_success' | 'auth_error', value: string): string {
  const url = new URL(safeReturnTo(returnTo), 'http://localhost');
  url.searchParams.delete('auth_success');
  url.searchParams.delete('auth_error');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}
