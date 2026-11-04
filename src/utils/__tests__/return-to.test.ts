import { describe, expect, it } from 'vitest';
import { safeReturnTo, withAuthResult } from '../return-to';

describe('safeReturnTo', () => {
  it('keeps paths on this site with their query', () => {
    expect(safeReturnTo('/collections')).toBe('/collections');
    expect(safeReturnTo('/collection/abc?x=1')).toBe('/collection/abc?x=1');
  });

  it('falls back to / for anything that could leave the site', () => {
    for (const value of [
      null,
      undefined,
      '',
      'collections',
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      '/\t/evil.com',
      'javascript:alert(1)',
      '/api/auth/login',
      '/api',
      '/' + 'a'.repeat(3000),
    ]) {
      expect(safeReturnTo(value)).toBe('/');
    }
  });
});

describe('withAuthResult', () => {
  it('adds the login result and keeps the page query', () => {
    expect(withAuthResult('/collections', 'auth_success', 'true')).toBe('/collections?auth_success=true');
    expect(withAuthResult('/collection/abc?x=1', 'auth_error', 'Access denied')).toBe(
      '/collection/abc?x=1&auth_error=Access+denied'
    );
  });

  it('replaces an earlier login result and never leaves the site', () => {
    expect(withAuthResult('/collections?auth_error=old', 'auth_success', 'true')).toBe('/collections?auth_success=true');
    expect(withAuthResult('//evil.com', 'auth_success', 'true')).toBe('/?auth_success=true');
  });
});
