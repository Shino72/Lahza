import { defaultSettings } from '../config/site';
import { initialCategories } from './categories';
import { demoArticles, demoHomepageSlots, demoTicker } from './demo/articles';
import {
  byNewest,
  featuredArticles,
  findTranslation,
  isPubliclyVisible,
  paginate,
  publicArticles,
  relatedArticles,
  tickerFor,
  visibleCategories,
} from './query';
import type { Article, Category, Lang, SiteSettings, TickerItem } from './types';
import { buildSearchIndex, searchIndex } from '../lib/search';

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

export type TickerEntry = TickerItem & { article?: Article };

/** Read access to public content. Implementations must return published content only. */
export interface PublicRepository {
  readonly kind: 'demo' | 'supabase';
  settings(): Promise<SiteSettings>;
  categories(): Promise<Category[]>;
  latest(lang: Lang, options: { page?: number; perPage: number; categoryId?: string }): Promise<Page<Article>>;
  article(lang: Lang, slug: string): Promise<Article | null>;
  translationOf(article: Article): Promise<Article | null>;
  related(article: Article, limit: number): Promise<Article[]>;
  homepage(lang: Lang): Promise<{ featured: Article[]; ticker: TickerEntry[] }>;
  search(lang: Lang, query: string): Promise<Article[]>;
  isGone(lang: Lang, slug: string): Promise<boolean>;
  allPublished(): Promise<Article[]>;
}

/** Labelled sample fixtures for previews without a database. */
export function demoRepository(now: () => Date = () => new Date()): PublicRepository {
  const published = (lang: Lang) => publicArticles(demoArticles, lang, now());
  return {
    kind: 'demo',
    settings: async () => defaultSettings,
    categories: async () => visibleCategories(initialCategories),
    latest: async (lang, { page = 1, perPage, categoryId }) => {
      const items = published(lang).filter((a) => !categoryId || a.categoryId === categoryId);
      return paginate(items, page, perPage);
    },
    article: async (lang, slug) => published(lang).find((a) => a.slug === slug) ?? null,
    translationOf: async (article) => findTranslation(article, published(article.lang === 'ar' ? 'en' : 'ar')) ?? null,
    related: async (article, limit) => relatedArticles(article, published(article.lang), limit),
    homepage: async (lang) => {
      const list = published(lang);
      return { featured: featuredArticles(demoHomepageSlots, list), ticker: tickerFor(demoTicker, list, lang) };
    },
    search: async (lang, query) => {
      const list = published(lang);
      const index = buildSearchIndex(list, initialCategories, lang, (a) => a.id);
      const ids = searchIndex(index, query).map((e) => e.href);
      return ids.map((id) => list.find((a) => a.id === id)!).filter(Boolean);
    },
    isGone: async () => false,
    allPublished: async () =>
      demoArticles.filter((a) => isPubliclyVisible(a, now())).sort(byNewest),
  };
}
