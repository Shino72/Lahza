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

/** Meta description: the SEO description, else the summary, else the opening paragraph. */
export function articleDescription(article: Article): string {
  const first = article.body.find((b) => b.type === 'paragraph');
  const text = article.seoDescription || article.summary || (first && 'text' in first ? first.text : '') || article.title;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
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
    description: articleDescription(article),
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
