import { describe, expect, it } from 'vitest';
import { homepageDomain, pickOfficialHomepage } from '../series-homepage';

describe('pickOfficialHomepage', () => {
  it('returns the official homepage url', () => {
    expect(pickOfficialHomepage([
      { type: 'wikidata', 'target-type': 'url', url: { resource: 'https://www.wikidata.org/wiki/Q1' } },
      { type: 'official homepage', 'target-type': 'url', url: { resource: 'https://www.bluenote.com/tone-poet/' } },
    ])).toBe('https://www.bluenote.com/tone-poet/');
  });

  it('prefers a homepage that has not ended', () => {
    expect(pickOfficialHomepage([
      { type: 'official homepage', 'target-type': 'url', ended: true, url: { resource: 'http://old.example.com' } },
      { type: 'official homepage', 'target-type': 'url', ended: false, url: { resource: 'https://example.com' } },
    ])).toBe('https://example.com');
  });

  it('returns null without a homepage or with a non-web url', () => {
    expect(pickOfficialHomepage(undefined)).toBeNull();
    expect(pickOfficialHomepage([{ type: 'part of', 'target-type': 'release_group' }])).toBeNull();
    expect(pickOfficialHomepage([{ type: 'official homepage', 'target-type': 'url', url: { resource: 'javascript:alert(1)' } }])).toBeNull();
  });
});

describe('homepageDomain', () => {
  it('drops the protocol, www. and the path', () => {
    expect(homepageDomain('https://www.bluenote.com/tone-poet/')).toBe('bluenote.com');
    expect(homepageDomain('http://records.example.org')).toBe('records.example.org');
  });
});
