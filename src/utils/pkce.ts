/**
 * @ai-file utility
 * @ai-description PKCE (Proof Key for Code Exchange) utility functions for OAuth2 flow
 * @ai-dependencies Web Crypto API
 * @ai-features Code verifier/challenge generation, CSRF state, SHA-256 hashing, Base64-URL encoding
 */

/**
 * Generate a random code verifier for PKCE
 * @returns Base64-URL encoded random string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generate a code challenge from a code verifier using SHA-256
 * @param codeVerifier - The code verifier to hash
 * @returns Base64-URL encoded SHA-256 hash
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

/**
 * Generate a random state parameter for CSRF protection
 * @returns Base64-URL encoded random string
 */
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Base64-URL encode a Uint8Array
 * @param array - The array to encode
 * @returns Base64-URL encoded string
 */
function base64URLEncode(array: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
