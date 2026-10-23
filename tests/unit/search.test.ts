import { describe, expect, it } from 'vitest';
import { initialCategories } from '../../src/content/categories';
import { demoArticles } from '../../src/content/demo/articles';
import { publicArticles } from '../../src/content/query';
import { buildSearchIndex, normalizeText, searchIndex, searchTerms } from '../../src/lib/search';

const now = new Date('2026-10-23T12:00:00Z');
const hrefFor = (a: { lang: string; slug: string }) => `/${a.lang}/news/${a.slug}/`;

describe('normalizeText', () => {
  it('folds alef, ya, ta marbuta and hamza variants', () => {
    expect(normalizeText('أإآا')).toBe('اااا');
    expect(normalizeText('مستشفى')).toBe('مستشفي');
    expect(normalizeText('المكتبة')).toBe(normalizeText('المكتبه'));
    expect(normalizeText('مسؤول')).toBe('مسوول');
  });

  it('strips diacritics and tatweel', () => {
    expect(normalizeText('مُحَمَّد')).toBe('محمد');
    expect(normalizeText('اقتـــصاد')).toBe('اقتصاد');
  });

  it('converts Arabic-Indic digits and lowercases Latin text', () => {
    expect(normalizeText('٢٠٢٦ News')).toBe('2026 news');
  });

  it('drops punctuation and single-character terms', () => {
    expect(searchTerms('«مصر»، و الاقتصاد!')).toEqual(['مصر', 'الاقتصاد']);
  });
});

describe('searchIndex', () => {
  const arPublished = publicArticles(demoArticles, 'ar', now);
  const index = buildSearchIndex(arPublished, initialCategories, 'ar', hrefFor);

  it('matches regardless of Arabic spelling variants', () => {
    const results = searchIndex(index, 'مكتبه عامه');
    expect(results.map((r) => r.href)).toContain('/ar/news/new-public-library-opens/');
  });

  it('requires every term to match', () => {
    expect(searchIndex(index, 'مكتبة سباحة')).toHaveLength(0);
  });

  it('never indexes drafts, articles in review or scheduled articles', () => {
    const hrefs = index.map((entry) => entry.href);
    expect(hrefs).not.toContain('/ar/news/unpublished-draft-story/');
    expect(hrefs).not.toContain('/ar/news/story-in-review/');
    expect(hrefs).not.toContain('/ar/news/scheduled-future-story/');
    expect(searchIndex(index, 'مسودة')).toHaveLength(0);
  });

  it('returns nothing for an empty query', () => {
    expect(searchIndex(index, '   ')).toEqual([]);
  });

  it('searches English case-insensitively', () => {
    const en = buildSearchIndex(publicArticles(demoArticles, 'en', now), initialCategories, 'en', hrefFor);
    expect(searchIndex(en, 'LIBRARY')[0]?.href).toBe('/en/news/new-public-library-opens/');
  });
});
