/**
 * @ai-file lib
 * @ai-description Opens a web page from user-editable data (MusicBrainz links) without reaching private networks
 * @ai-dependencies node:dns, node:net
 * @ai-features
 * - http(s) only, default ports only; hostnames must resolve to public addresses only (no localhost,
 *   LAN, Tailscale or link-local), checked again for every redirect (followed by hand, at most 4)
 * - Reads only the first 64 KB of the page (enough for the html tag and meta tags), 8 s timeout
 * - Never throws: status null when the page could not be reached or was not allowed
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;
const MAX_BYTES = 64 * 1024;
// Some review sites answer scripts with 403; a browser-like User-Agent gets the normal page more often
const USER_AGENT = 'Mozilla/5.0 (compatible; Collectionz review link check; +https://github.com/tmdecker/collection-browser-for-musicbrainz)';

export interface PageStart {
  status: number | null;
  /** The first 64 KB of the page, when it answered 2xx with HTML */
  html?: string;
}

function ipv4IsPublic(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this network, private, loopback, multicast/reserved
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT (Tailscale)
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  return true;
}

export function ipIsPublic(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4IsPublic(ip);
  if (version !== 6) return false;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPublic(mapped[1]);
  if (lower === '::' || lower === '::1') return false;
  if (/^f[cd]/.test(lower)) return false; // unique local
  if (/^fe[89ab]/.test(lower)) return false; // link-local
  if (/^ff/.test(lower)) return false; // multicast
  return true;
}

/** True when the URL is http(s) on a default port and its host resolves to public addresses only */
export async function isPublicWebUrl(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.port && url.port !== '80' && url.port !== '443') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return ipIsPublic(host);
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|lan|home|ts\.net)$/i.test(host)) return false;
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every(address => ipIsPublic(address.address));
  } catch {
    return false;
  }
}

async function readStart(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, MAX_BYTES));
}

/**
 * Open a public web page and read its first 64 KB
 */
export async function fetchPublicPageStart(address: string): Promise<PageStart> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return { status: null };
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let redirects = 0; ; redirects++) {
      if (!(await isPublicWebUrl(url))) return { status: null };
      const response = await fetch(url, {
        redirect: 'manual',
        signal,
        cache: 'no-store',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        if (redirects >= MAX_REDIRECTS) return { status: null };
        url = new URL(location, url);
        continue;
      }
      const isHtml = (response.headers.get('content-type') ?? '').includes('html');
      if (!response.ok || !isHtml) {
        await response.body?.cancel();
        return { status: response.status };
      }
      return { status: response.status, html: await readStart(response) };
    }
  } catch {
    return { status: null };
  }
}
