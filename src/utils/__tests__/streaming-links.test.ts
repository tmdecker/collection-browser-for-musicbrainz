import { describe, expect, it } from 'vitest';
import { isStreamingUrl } from '@/utils/streaming-links';

describe('isStreamingUrl', () => {
  it('accepts known platforms and their subdomains', () => {
    expect(isStreamingUrl('https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv')).toBe(true);
    expect(isStreamingUrl('https://music.apple.com/us/album/123')).toBe(true);
    expect(isStreamingUrl('https://www.deezer.com/album/1')).toBe(true);
    expect(isStreamingUrl('https://someartist.bandcamp.com/album/x')).toBe(true);
  });

  it('rejects lookalike hosts and internal addresses (SSRF)', () => {
    expect(isStreamingUrl('https://open.spotify.com.evil.example/album/1')).toBe(false);
    expect(isStreamingUrl('https://evilbandcamp.com/album/1')).toBe(false);
    expect(isStreamingUrl('http://127.0.0.1:3000/?x=open.spotify.com')).toBe(false);
    expect(isStreamingUrl('http://169.254.169.254/latest/meta-data/#deezer.com')).toBe(false);
  });

  it('rejects other schemes, credentials and custom ports', () => {
    expect(isStreamingUrl('file:///etc/passwd?open.spotify.com')).toBe(false);
    expect(isStreamingUrl('https://user:pw@open.spotify.com/album/1')).toBe(false);
    expect(isStreamingUrl('https://open.spotify.com:8443/album/1')).toBe(false);
    expect(isStreamingUrl('not a url')).toBe(false);
  });
});
