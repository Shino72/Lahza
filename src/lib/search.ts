import type { Article, ArticleBlock, Category, Lang } from '../content/types';

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

/** Folds common Arabic spelling variants so searches match regardless of how a word was typed. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function blockText(block: ArticleBlock): string {
  switch (block.type) {
    case 'list':
      return block.items.join(' ');
    case 'image':
      return block.caption ?? '';
    default:
      return block.text;
  }
}

export function searchTerms(query: string): string[] {
  return normalizeText(query)
    .split(' ')
    .filter((term) => term.length > 1)
    .slice(0, 8);
}

export interface SearchEntry {
  href: string;
  title: string;
  summary: string;
  category: string;
  publishAt: string;
  text: string;
}

export function buildSearchIndex(
  articles: Article[],
  categories: Category[],
  lang: Lang,
  hrefFor: (article: Article) => string,
): SearchEntry[] {
  const names = new Map(categories.map((c) => [c.id, c.name[lang]]));
  return articles.map((a) => {
    const category = names.get(a.categoryId) ?? '';
    const body = a.body.map(blockText).join(' ');
    return {
      href: hrefFor(a),
      title: a.title,
      summary: a.summary,
      category,
      publishAt: a.publishAt,
      text: normalizeText([a.title, a.summary, category, a.tags.join(' '), body].join(' ')),
    };
  });
}

/** Every term must appear; title matches rank above body matches. */
export function searchIndex(index: SearchEntry[], query: string, limit = 50): SearchEntry[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  return index
    .filter((entry) => terms.every((term) => entry.text.includes(term)))
    .map((entry) => {
      const title = normalizeText(entry.title);
      const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 2 : 1), 0);
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score || Date.parse(b.entry.publishAt) - Date.parse(a.entry.publishAt))
    .slice(0, limit)
    .map(({ entry }) => entry);
}
