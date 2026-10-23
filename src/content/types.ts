export type Lang = 'ar' | 'en';

export type LocalizedText = Record<Lang, string>;

/** Editorial workflow states. Only `published` articles whose `publishAt` has passed are public. */
export type ArticleStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export type ArticleBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'quote'; text: string; cite?: string };

export interface ArticleImage {
  /** Absent until a photograph is uploaded through the CMS; a neutral placeholder is rendered instead. */
  src?: string;
  width?: number;
  height?: number;
  alt: string;
  caption?: string;
}

export interface Article {
  id: string;
  lang: Lang;
  slug: string;
  status: ArticleStatus;
  /** ISO 8601 timestamp in UTC. */
  publishAt: string;
  updatedAt: string;
  categoryId: string;
  title: string;
  subtitle?: string;
  summary: string;
  body: ArticleBlock[];
  author: string;
  image: ArticleImage;
  tags: string[];
  /** Shared by the Arabic and English versions of the same story. */
  translationKey?: string;
  seoTitle?: string;
  seoDescription?: string;
  /** Marks preview fixtures so they are labelled and never indexed. */
  isSample?: boolean;
}

export interface Category {
  id: string;
  slug: string;
  order: number;
  visible: boolean;
  name: LocalizedText;
  description: LocalizedText;
}

export interface HomepageSlot {
  articleId: string;
  position: number;
}

export interface TickerItem {
  id: string;
  lang: Lang;
  text: string;
  articleId?: string;
}
