import { describe, expect, it } from 'vitest';
import { ipIsPublic, isPublicWebUrl } from '@/lib/safe-page-fetch';

describe('ipIsPublic', () => {
  it('refuses loopback, private, Tailscale and link-local addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.10', '100.103.144.57', '169.254.169.254', '0.0.0.0', '::1', 'fd7a:115c::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(ipIsPublic(ip), ip).toBe(false);
    }
  });

  it('allows public addresses', () => {
    expect(ipIsPublic('151.101.1.140')).toBe(true);
    expect(ipIsPublic('2a04:4e42::396')).toBe(true);
  });
});

describe('isPublicWebUrl', () => {
  it('refuses other schemes, ports, credentials and local names without a DNS lookup', async () => {
    expect(await isPublicWebUrl(new URL('file:///etc/passwd'))).toBe(false);
    expect(await isPublicWebUrl(new URL('http://example.com:3002/'))).toBe(false);
    expect(await isPublicWebUrl(new URL('http://user:pw@example.com/'))).toBe(false);
    expect(await isPublicWebUrl(new URL('http://localhost/'))).toBe(false);
    expect(await isPublicWebUrl(new URL('https://ubuntu-server.tail553cd7.ts.net/'))).toBe(false);
    expect(await isPublicWebUrl(new URL('http://127.0.0.1/'))).toBe(false);
    expect(await isPublicWebUrl(new URL('http://[::1]/'))).toBe(false);
  });
});
