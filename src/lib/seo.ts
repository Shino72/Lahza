import { siteName } from '../config/site';
import type { Article, Category } from '../content/types';

export function absoluteUrl(site: URL | undefined, path: string): string {
  if (!site) throw new Error('`site` must be configured to build absolute URLs');
  return new URL(path, site).toString();
}

export interface Alternate {
  hreflang: string;
  href: string;
}

/** NewsArticle structured data built only from stored article fields. */
export function newsArticleJsonLd(args: {
  article: Article;
  category: Category | undefined;
  url: string;
  imageUrl?: string;
  logoUrl: string;
}) {
  const { article, category, url, imageUrl, logoUrl } = args;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: url,
    headline: article.title.slice(0, 110),
    description: article.seoDescription ?? article.summary,
    inLanguage: article.lang,
    datePublished: article.publishAt,
    dateModified: article.updatedAt,
    author: [{ '@type': 'Person', name: article.author }],
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: siteName[article.lang],
      logo: { '@type': 'ImageObject', url: logoUrl },
    },
  };
  if (category) data.articleSection = category.name[article.lang];
  if (imageUrl) data.image = [imageUrl];
  if (article.tags.length > 0) data.keywords = article.tags.join(', ');
  return data;
}

/** Serialises JSON-LD safely for embedding in a script element. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
