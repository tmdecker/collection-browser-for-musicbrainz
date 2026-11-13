import { describe, expect, it } from 'vitest';
import { pageTitle } from '../PageTitle';

describe('pageTitle', () => {
  it('names the album and the collection before the app name', () => {
    expect(pageTitle('Low – David Bowie', "Tim's Records")).toBe("Low – David Bowie · Tim's Records · Collectionz");
  });

  it('leaves out parts that are not known yet', () => {
    expect(pageTitle(null, '')).toBe('Collectionz');
    expect(pageTitle(undefined, 'Collections')).toBe('Collections · Collectionz');
  });
});
