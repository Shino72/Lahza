import { describe, expect, it } from 'vitest';
import { initialCategories } from '../../src/content/categories';
import { demoArticles, demoHomepageSlots, demoTicker } from '../../src/content/demo/articles';
import {
  featuredArticles,
  findTranslation,
  isPubliclyVisible,
  paginate,
  publicArticles,
  tickerFor,
  visibleCategories,
} from '../../src/content/query';
import type { Article } from '../../src/content/types';

const now = new Date('2026-10-23T12:00:00Z');
const base = demoArticles.find((a) => a.id === 'a-egypt-1')!;
const variant = (overrides: Partial<Article>): Article => ({ ...base, ...overrides });

describe('public visibility', () => {
  it('shows only published articles whose publish time has passed', () => {
    expect(isPubliclyVisible(variant({ status: 'published' }), now)).toBe(true);
    for (const status of ['draft', 'in_review', 'approved', 'archived'] as const) {
      expect(isPubliclyVisible(variant({ status }), now)).toBe(false);
    }
    expect(isPubliclyVisible(variant({ publishAt: '2026-10-23T12:00:01Z' }), now)).toBe(false);
  });

  it('lists public articles per language, newest first', () => {
    const ar = publicArticles(demoArticles, 'ar', now);
    expect(ar.every((a) => a.lang === 'ar' && a.status === 'published')).toBe(true);
    const times = ar.map((a) => Date.parse(a.publishAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe('categories', () => {
  it('defines the ten required sections with Arabic and English names', () => {
    expect(initialCategories.map((c) => [c.name.en, c.name.ar])).toEqual([
      ['Egypt', 'مصر'],
      ['Politics', 'سياسة'],
      ['Arab & World', 'عرب وعالم'],
      ['Economy', 'اقتصاد'],
      ['Sports', 'رياضة'],
      ['Entertainment', 'فن'],
      ['Drama', 'دراما'],
      ['Crime & Incidents', 'حوادث'],
      ['Technology', 'تكنولوجيا'],
      ['Lifestyle', 'لايف ستايل'],
    ]);
    expect(new Set(initialCategories.map((c) => c.slug)).size).toBe(10);
  });

  it('hides invisible categories and respects order', () => {
    const hidden = initialCategories.map((c) => (c.id === 'drama' ? { ...c, visible: false } : c));
    const reordered = hidden.map((c) => (c.id === 'sports' ? { ...c, order: 0 } : c));
    const result = visibleCategories(reordered);
    expect(result.map((c) => c.id)).not.toContain('drama');
    expect(result[0]?.id).toBe('sports');
  });
});

describe('homepage', () => {
  const published = publicArticles(demoArticles, 'ar', now);

  it('keeps editor order and skips non-public slotted articles', () => {
    const featured = featuredArticles(demoHomepageSlots, published);
    expect(featured[0]?.id).toBe('a-egypt-1');
    expect(featured.map((a) => a.id)).not.toContain('a-draft-1');
  });

  it('drops ticker items that link to non-public articles', () => {
    const items = tickerFor([...demoTicker, { id: 'x', lang: 'ar', text: 'leak', articleId: 'a-draft-1' }], published, 'ar');
    expect(items.map((i) => i.id)).not.toContain('x');
    expect(items.every((i) => i.lang === 'ar')).toBe(true);
  });
});

describe('helpers', () => {
  it('paginates and clamps out-of-range pages', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 1, 12)).toMatchObject({ page: 1, totalPages: 3 });
    expect(paginate(items, 9, 12).items).toEqual([24]);
    expect(paginate([], 1, 12)).toMatchObject({ page: 1, totalPages: 1, items: [] });
  });

  it('links Arabic and English versions only when both are public', () => {
    const en = publicArticles(demoArticles, 'en', now);
    expect(findTranslation(base, en)?.id).toBe('e-egypt-1');
    expect(findTranslation(demoArticles.find((a) => a.id === 'a-egypt-2')!, en)).toBeUndefined();
  });
});
