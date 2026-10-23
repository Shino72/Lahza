import { publicArticles, visibleCategories } from '../content/query';
import { loadContent } from '../content/source';
import type { Article, Category, Lang } from '../content/types';

/** Public content for one language, resolved at render time. */
export function publicSiteData(lang: Lang, now = new Date()) {
  const content = loadContent();
  const categories = visibleCategories(content.categories);
  const published = publicArticles(content.articles, lang, now);
  const categoryById = new Map<string, Category>(content.categories.map((c) => [c.id, c]));
  return {
    content,
    categories,
    published,
    categoryById,
    inCategory: (categoryId: string): Article[] => published.filter((a) => a.categoryId === categoryId),
  };
}

export const CATEGORY_PAGE_SIZE = 12;
