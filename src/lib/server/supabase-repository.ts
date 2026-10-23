import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultSettings } from '../../config/site';
import type { Page, PublicRepository, TickerEntry } from '../../content/repository';
import type { Article, ArticleBlock, ArticleImage, Category, Lang, SiteSettings } from '../../content/types';
import { parseBody } from '../article-body';

export const LIST_COLUMNS =
  'id, lang, slug, status, category_id, title, subtitle, summary, byline, tags, cover_media_id, translation_group, seo_title, seo_description, publish_at, updated_at';
export const FULL_COLUMNS = `${LIST_COLUMNS}, body`;

export interface ArticleRow {
  id: string;
  lang: Lang;
  slug: string;
  status: Article['status'];
  category_id: string;
  title: string;
  subtitle: string;
  summary: string;
  byline: string;
  tags: string[];
  cover_media_id: string | null;
  translation_group: string | null;
  seo_title: string;
  seo_description: string;
  publish_at: string | null;
  updated_at: string;
  body?: unknown;
}

export interface MediaRow {
  id: string;
  path: string;
  width: number;
  height: number;
  alt_ar: string;
  alt_en: string;
  caption_ar: string;
  caption_en: string;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  sort_order: number;
  visible: boolean;
}

export const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  slug: row.slug,
  order: row.sort_order,
  visible: row.visible,
  name: { ar: row.name_ar, en: row.name_en },
  description: { ar: row.description_ar, en: row.description_en },
});

export type MediaResolver = (media: MediaRow) => string;

export function mediaImage(media: MediaRow | undefined, lang: Lang, fallbackAlt: string, src: MediaResolver): ArticleImage {
  if (!media) return { alt: fallbackAlt };
  return {
    src: src(media),
    width: media.width,
    height: media.height,
    alt: (lang === 'ar' ? media.alt_ar : media.alt_en) || fallbackAlt,
    caption: (lang === 'ar' ? media.caption_ar : media.caption_en) || undefined,
  };
}

export function mediaIdsOf(rows: ArticleRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.cover_media_id) ids.add(row.cover_media_id);
    for (const block of parseBody(row.body ?? [])) {
      if (block.type === 'image') ids.add(block.mediaId);
    }
  }
  return [...ids];
}

export function toArticle(row: ArticleRow, media: Map<string, MediaRow>, src: MediaResolver): Article {
  const body: ArticleBlock[] = parseBody(row.body ?? []).flatMap((block): ArticleBlock[] => {
    if (block.type !== 'image') return [block];
    const m = media.get(block.mediaId);
    // An image that is not available to this reader is left out rather than shown broken.
    return m ? [{ ...block, image: mediaImage(m, row.lang, block.caption ?? row.title, src) }] : [];
  });
  return {
    id: row.id,
    lang: row.lang,
    slug: row.slug,
    status: row.status,
    publishAt: row.publish_at ?? row.updated_at,
    updatedAt: row.updated_at,
    categoryId: row.category_id,
    title: row.title,
    subtitle: row.subtitle || undefined,
    summary: row.summary,
    body,
    author: row.byline,
    image: mediaImage(row.cover_media_id ? media.get(row.cover_media_id) : undefined, row.lang, row.title, src),
    tags: row.tags,
    translationKey: row.translation_group ?? undefined,
    seoTitle: row.seo_title || undefined,
    seoDescription: row.seo_description || undefined,
  };
}

export function settingsFromRows(rows: { key: string; value: unknown }[]): SiteSettings {
  const map = new Map(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
  const contact = map.get('contact') as Partial<SiteSettings['contact']> | undefined;
  const leadership = map.get('leadership') as unknown as
    | { roleAr: string; roleEn: string; nameAr: string; nameEn: string }[]
    | undefined;
  const advertise = map.get('advertise') as { introAr?: string; introEn?: string } | undefined;
  const tagline = map.get('tagline') as { ar?: string; en?: string } | undefined;
  return {
    contact: { ...defaultSettings.contact, ...contact },
    leadership: Array.isArray(leadership)
      ? leadership.map((l) => ({ role: { ar: l.roleAr, en: l.roleEn }, name: { ar: l.nameAr, en: l.nameEn } }))
      : defaultSettings.leadership,
    advertiseIntro: {
      ar: advertise?.introAr || defaultSettings.advertiseIntro.ar,
      en: advertise?.introEn || defaultSettings.advertiseIntro.en,
    },
    tagline: { ar: tagline?.ar || defaultSettings.tagline.ar, en: tagline?.en || defaultSettings.tagline.en },
  };
}

export function publicMediaUrl(supabaseUrl: string) {
  return (media: MediaRow) => `${supabaseUrl}/storage/v1/object/public/media-public/${media.path}`;
}

const MEDIA_COLUMNS = 'id, path, width, height, alt_ar, alt_en, caption_ar, caption_en';

/** Public content from Supabase. Uses the anonymous role, so RLS decides what is visible. */
export function supabaseRepository(db: SupabaseClient, supabaseUrl: string): PublicRepository {
  const src = publicMediaUrl(supabaseUrl);
  const nowIso = () => new Date().toISOString();

  const hydrate = async (rows: ArticleRow[]): Promise<Article[]> => {
    const ids = mediaIdsOf(rows);
    const media = new Map<string, MediaRow>();
    if (ids.length > 0) {
      const { data, error } = await db.from('media_assets').select(MEDIA_COLUMNS).in('id', ids);
      if (error) throw error;
      for (const m of (data ?? []) as MediaRow[]) media.set(m.id, m);
    }
    return rows.map((row) => toArticle(row, media, src));
  };

  const published = (columns: string) =>
    db.from('articles').select(columns, { count: 'exact' }).eq('status', 'published').lte('publish_at', nowIso());

  return {
    kind: 'supabase',

    async settings() {
      const { data, error } = await db.from('site_settings').select('key, value');
      if (error) throw error;
      return settingsFromRows(data ?? []);
    },

    async categories() {
      const { data, error } = await db
        .from('categories')
        .select('id, slug, name_ar, name_en, description_ar, description_en, sort_order, visible')
        .eq('visible', true)
        .order('sort_order');
      if (error) throw error;
      return ((data ?? []) as CategoryRow[]).map(toCategory);
    },

    async latest(lang, { page = 1, perPage, categoryId }): Promise<Page<Article>> {
      const current = Math.max(1, page);
      let query = published(LIST_COLUMNS).eq('lang', lang);
      if (categoryId) query = query.eq('category_id', categoryId);
      const { data, error, count } = await query
        .order('publish_at', { ascending: false })
        .range((current - 1) * perPage, current * perPage - 1);
      if (error) throw error;
      return {
        items: await hydrate((data ?? []) as unknown as ArticleRow[]),
        page: current,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      };
    },

    async article(lang, slug) {
      const { data, error } = await published(FULL_COLUMNS).eq('lang', lang).eq('slug', slug).maybeSingle();
      if (error) throw error;
      return data ? (await hydrate([data as unknown as ArticleRow]))[0]! : null;
    },

    async translationOf(article) {
      if (!article.translationKey) return null;
      const { data, error } = await published(LIST_COLUMNS)
        .eq('translation_group', article.translationKey)
        .neq('lang', article.lang)
        .maybeSingle();
      if (error) throw error;
      return data ? (await hydrate([data as unknown as ArticleRow]))[0]! : null;
    },

    async related(article, limit) {
      const { data, error } = await published(LIST_COLUMNS)
        .eq('lang', article.lang)
        .eq('category_id', article.categoryId)
        .neq('id', article.id)
        .order('publish_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return hydrate((data ?? []) as unknown as ArticleRow[]);
    },

    async homepage(lang) {
      const [slots, ticker] = await Promise.all([
        db.from('homepage_slots').select('position, article_id').eq('lang', lang).order('position'),
        db
          .from('breaking_ticker')
          .select('id, lang, text, article_id, sort_order')
          .eq('lang', lang)
          .eq('active', true)
          .order('sort_order')
          .limit(15),
      ]);
      if (slots.error) throw slots.error;
      if (ticker.error) throw ticker.error;
      const slotIds = (slots.data ?? []).map((s) => s.article_id as string);
      const linkedIds = (ticker.data ?? []).map((t) => t.article_id as string | null).filter((id): id is string => !!id);
      const ids = [...new Set([...slotIds, ...linkedIds])];
      let articles: Article[] = [];
      if (ids.length > 0) {
        const { data, error } = await published(LIST_COLUMNS).in('id', ids);
        if (error) throw error;
        articles = await hydrate((data ?? []) as unknown as ArticleRow[]);
      }
      const byId = new Map(articles.map((a) => [a.id, a]));
      return {
        featured: slotIds.map((id) => byId.get(id)).filter((a): a is Article => !!a),
        ticker: (ticker.data ?? [])
          .filter((t) => !t.article_id || byId.has(t.article_id))
          .map(
            (t): TickerEntry => ({
              id: t.id,
              lang: t.lang,
              text: t.text,
              articleId: t.article_id ?? undefined,
              article: t.article_id ? byId.get(t.article_id) : undefined,
            }),
          ),
      };
    },

    async search(lang, query) {
      if (query.trim() === '') return [];
      const { data, error } = await db.rpc('search_articles', { p_lang: lang, p_query: query, p_limit: 30 });
      if (error) throw error;
      const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length === 0) return [];
      const { data: rows, error: rowsError } = await published(LIST_COLUMNS).in('id', ids);
      if (rowsError) throw rowsError;
      const order = new Map(ids.map((id, i) => [id, i]));
      const articles = await hydrate((rows ?? []) as unknown as ArticleRow[]);
      return articles.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    },

    async isGone(lang, slug) {
      const { data, error } = await db.rpc('article_gone', { p_lang: lang, p_slug: slug });
      if (error) throw error;
      return data === true;
    },

    async allPublished() {
      const { data, error } = await published(LIST_COLUMNS).order('publish_at', { ascending: false }).limit(5000);
      if (error) throw error;
      return ((data ?? []) as unknown as ArticleRow[]).map((row) => toArticle(row, new Map(), src));
    },
  };
}
