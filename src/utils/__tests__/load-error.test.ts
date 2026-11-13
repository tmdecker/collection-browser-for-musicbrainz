import { describe, expect, it } from 'vitest';
import { loadErrorMessage } from '../load-error';

describe('loadErrorMessage', () => {
  it('explains busy, unknown, private and unreachable', () => {
    expect(loadErrorMessage({ response: { status: 503 } })).toMatch(/busy/);
    expect(loadErrorMessage({ response: { status: 429 } })).toMatch(/busy/);
    expect(loadErrorMessage({ response: { status: 404 } }, 'series')).toBe("MusicBrainz doesn't know this series, or it is private.");
    expect(loadErrorMessage({ response: { status: 401 } })).toMatch(/private/);
    expect(loadErrorMessage({ request: {}, message: 'Network Error' })).toMatch(/Couldn't reach/);
  });

  it('keeps other messages', () => {
    expect(loadErrorMessage(new Error('Invalid data returned from collection handler'))).toBe('Invalid data returned from collection handler');
    expect(loadErrorMessage({ response: { status: 500 }, message: 'Request failed with status code 500' })).toBe('Request failed with status code 500');
    expect(loadErrorMessage('oops')).toBe('Unknown error');
  });
});
