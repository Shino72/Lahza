import { describe, expect, it } from 'vitest';
import { cairoLocalToUtc, errorKey, PASSWORD_RULE, safeNext, slugify, utcToCairoLocal } from '../../src/lib/server/admin';

describe('Cairo time conversion', () => {
  it('converts local Cairo time to UTC in winter and summer', () => {
    expect(cairoLocalToUtc('2026-01-15T10:00')).toBe('2026-01-15T08:00:00.000Z');
    expect(cairoLocalToUtc('2026-07-15T10:00')).toBe('2026-07-15T07:00:00.000Z');
  });

  it('round-trips', () => {
    for (const iso of ['2026-01-15T08:00:00.000Z', '2026-07-15T07:00:00.000Z']) {
      expect(cairoLocalToUtc(utcToCairoLocal(iso))).toBe(iso);
    }
  });

  it('rejects malformed input', () => {
    expect(cairoLocalToUtc('tomorrow')).toBeNull();
  });
});

describe('helpers', () => {
  it('slugifies English titles', () => {
    expect(slugify('Égypt’s New Metro Line: 3 Stations!')).toBe('egypt-s-new-metro-line-3-stations');
    expect(slugify('عنوان عربي')).toBe('');
  });

  it('only redirects inside the dashboard', () => {
    expect(safeNext('/admin/articles/')).toBe('/admin/articles/');
    expect(safeNext('https://evil.example/admin/')).toBe('/admin/');
    expect(safeNext('//evil.example')).toBe('/admin/');
    expect(safeNext(null)).toBe('/admin/');
  });

  it('enforces the password policy', () => {
    expect(PASSWORD_RULE.test('Short1A')).toBe(false);
    expect(PASSWORD_RULE.test('alllowercase123')).toBe(false);
    expect(PASSWORD_RULE.test('Lahza-Newsroom-2026')).toBe(true);
  });

  it('never exposes raw database errors', () => {
    expect(errorKey({ code: '42501' })).toBe('forbidden');
    expect(errorKey({ code: 'XX000' })).toBe('failed');
  });
});
