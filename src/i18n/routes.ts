import type { Article, Category, Lang } from '../content/types';

export const languages: Lang[] = ['ar', 'en'];
export const defaultLang: Lang = 'ar';

export const dir = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr');
export const otherLang = (lang: Lang): Lang => (lang === 'ar' ? 'en' : 'ar');
export const isLang = (value: unknown): value is Lang => value === 'ar' || value === 'en';

export const paths = {
  home: (lang: Lang) => `/${lang}/`,
  category: (lang: Lang, category: Pick<Category, 'slug'>, page = 1) =>
    page > 1 ? `/${lang}/category/${category.slug}/page/${page}/` : `/${lang}/category/${category.slug}/`,
  article: (article: Pick<Article, 'lang' | 'slug'>) => `/${article.lang}/news/${article.slug}/`,
  search: (lang: Lang) => `/${lang}/search/`,
  advertise: (lang: Lang) => `/${lang}/advertise/`,
  about: (lang: Lang) => `/${lang}/about/`,
  privacy: (lang: Lang) => `/${lang}/privacy/`,
};
