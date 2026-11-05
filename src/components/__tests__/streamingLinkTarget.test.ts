import { describe, expect, it } from 'vitest';
import { linkTargetProps } from '../StreamingLinksSection';

describe('linkTargetProps', () => {
  it('opens web links in a new tab', () => {
    expect(linkTargetProps('https://open.spotify.com/album/1')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it.each(['spotify://album/1', 'tidal://album/1', 'music:///de/album/x/1'])(
    'opens app link %s in the current tab',
    (href) => {
      expect(linkTargetProps(href)).toEqual({});
    },
  );
});
