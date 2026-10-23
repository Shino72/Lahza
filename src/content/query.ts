import type { Article, Category, HomepageSlot, Lang, TickerItem } from './types';

/**
 * Public visibility rule. The database policy for anonymous reads mirrors this:
 * status = 'published' AND publish_at <= now().
 */
export function isPubliclyVisible(article: Article, now: Date): boolean {
  return article.status === 'published' && Date.parse(article.publishAt) <= now.getTime();
}

export function byNewest(a: Article, b: Article): number {
  return Date.parse(b.publishAt) - Date.parse(a.publishAt);
}

export function publicArticles(articles: Article[], lang: Lang, now: Date): Article[] {
  return articles.filter((a) => a.lang === lang && isPubliclyVisible(a, now)).sort(byNewest);
}

export function visibleCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.visible).sort((a, b) => a.order - b.order);
}

/** Resolves homepage slots to public articles in editor order, skipping anything not public. */
export function featuredArticles(slots: HomepageSlot[], published: Article[]): Article[] {
  const byId = new Map(published.map((a) => [a.id, a]));
  return [...slots]
    .sort((a, b) => a.position - b.position)
    .map((slot) => byId.get(slot.articleId))
    .filter((a): a is Article => a !== undefined);
}

export function tickerFor(items: TickerItem[], published: Article[], lang: Lang) {
  const byId = new Map(published.map((a) => [a.id, a]));
  return items
    .filter((item) => item.lang === lang)
    // A ticker entry that points at a non-public article is dropped rather than leaking a link.
    .filter((item) => item.articleId === undefined || byId.has(item.articleId))
    .map((item) => ({ ...item, article: item.articleId ? byId.get(item.articleId) : undefined }));
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * perPage, current * perPage),
    page: current,
    totalPages,
  };
}

export function findTranslation(article: Article, published: Article[]): Article | undefined {
  if (!article.translationKey) return undefined;
  return published.find((a) => a.translationKey === article.translationKey && a.lang !== article.lang);
}

export function relatedArticles(article: Article, published: Article[], limit: number): Article[] {
  return published
    .filter((a) => a.id !== article.id && a.lang === article.lang && a.categoryId === article.categoryId)
    .sort(byNewest)
    .slice(0, limit);
}
