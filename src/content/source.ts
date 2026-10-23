import { initialCategories } from './categories';
import { demoArticles, demoHomepageSlots, demoTicker } from './demo/articles';
import type { Article, Category, HomepageSlot, TickerItem } from './types';

export interface ContentSnapshot {
  kind: 'demo' | 'empty';
  articles: Article[];
  categories: Category[];
  homepageSlots: HomepageSlot[];
  ticker: TickerItem[];
}

/**
 * Selects where public content comes from. Until the database source is
 * implemented, "demo" serves labelled preview fixtures and anything else
 * serves an empty site rather than invented content.
 */
export function loadContent(source = import.meta.env.LAHZA_CONTENT_SOURCE ?? 'demo'): ContentSnapshot {
  if (source === 'demo') {
    return {
      kind: 'demo',
      articles: demoArticles,
      categories: initialCategories,
      homepageSlots: demoHomepageSlots,
      ticker: demoTicker,
    };
  }
  return { kind: 'empty', articles: [], categories: initialCategories, homepageSlots: [], ticker: [] };
}
