import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backOff = vi.fn();
vi.mock('@/lib/rate-limiter', () => ({ waitForRateLimit: () => Promise.resolve(), backOffMusicBrainz: () => backOff() }));

import { musicBrainzFetch } from '@/lib/musicbrainz-fetch';

const URL_ = 'https://musicbrainz.org/ws/2/release-group/x?fmt=json';

describe('musicBrainzFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    backOff.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pauses after a 503 and tries again', async () => {
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 503 })).mockResolvedValueOnce(new Response('{}'));
    const response = await musicBrainzFetch(URL_);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(backOff).toHaveBeenCalledTimes(1);
  });

  it('returns the last 503 when MusicBrainz stays busy', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('busy', { status: 503 })));
    const response = await musicBrainzFetch(URL_, { retries: 1 });
    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tries again after a network error, then throws it', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = musicBrainzFetch(URL_, { retries: 2 });
    const assertion = expect(result).rejects.toThrow('fetch failed');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry bugs and sends the token and a timeout', async () => {
    fetchMock.mockResolvedValue(new Response('{}'));
    await musicBrainzFetch(URL_, { accessToken: 'secret' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer secret');
    expect(init.headers['User-Agent']).toBeTruthy();
    expect(init.signal).toBeInstanceOf(AbortSignal);

    fetchMock.mockRejectedValue(new Error('unexpected bug'));
    await expect(musicBrainzFetch(URL_)).rejects.toThrow('unexpected bug');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
