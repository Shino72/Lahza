import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Lang } from '../../content/types';
import { bodySchema } from '../article-body';
import { cairoLocalToUtc, errorKey, SLUG_PATTERN, slugify } from './admin';
import { referencedMedia, syncPublicMedia } from './media';

export const ARTICLE_COLUMNS =
  'id, lang, slug, status, category_id, title, subtitle, summary, body, byline, tags, cover_media_id, translation_group, seo_title, seo_description, publish_at, author_id, created_at, updated_at';

export interface AdminArticle {
  id: string;
  lang: Lang;
  slug: string;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
  category_id: string;
  title: string;
  subtitle: string;
  summary: string;
  body: unknown;
  byline: string;
  tags: string[];
  cover_media_id: string | null;
  translation_group: string | null;
  seo_title: string;
  seo_description: string;
  publish_at: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export const INTENTS = [
  'save', 'submit', 'return', 'approve', 'publish', 'schedule', 'unpublish', 'archive', 'restore', 'delete',
] as const;
export type Intent = (typeof INTENTS)[number];

const formSchema = z.object({
  lang: z.enum(['ar', 'en']),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(300),
  summary: z.string().trim().max(500),
  slug: z.string().trim().max(100),
  category_id: z.uuid(),
  byline: z.string().trim().min(1).max(120),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  cover_media_id: z.uuid().nullable(),
  body: bodySchema,
  seo_title: z.string().trim().max(120),
  seo_description: z.string().trim().max(300),
  translation_of: z.uuid().nullable(),
});

export type ArticleForm = z.infer<typeof formSchema>;

export function readArticleForm(form: FormData) {
  let body: unknown = [];
  try {
    body = JSON.parse(String(form.get('body') ?? '[]'));
  } catch {
    body = null;
  }
  const raw = {
    lang: String(form.get('lang') ?? ''),
    title: String(form.get('title') ?? ''),
    subtitle: String(form.get('subtitle') ?? ''),
    summary: String(form.get('summary') ?? ''),
    slug: String(form.get('slug') ?? '').toLowerCase(),
    category_id: String(form.get('category_id') ?? ''),
    byline: String(form.get('byline') ?? ''),
    tags: String(form.get('tags') ?? '')
      .split(/[,،]/)
      .map((t) => t.trim())
      .filter(Boolean),
    cover_media_id: String(form.get('cover_media_id') ?? '') || null,
    body,
    seo_title: String(form.get('seo_title') ?? ''),
    seo_description: String(form.get('seo_description') ?? ''),
    translation_of: String(form.get('translation_of') ?? '') || null,
  };
  const parsed = formSchema.safeParse(raw);
  return { raw, parsed };
}

export type SaveResult = { ok: true; id: string; flash: string } | { ok: false; error: string };

const flashFor: Record<Intent, string> = {
  save: 'saved',
  submit: 'submitted',
  return: 'returned',
  approve: 'approved',
  publish: 'published',
  schedule: 'scheduled',
  unpublish: 'unpublished',
  archive: 'archived',
  restore: 'restored',
  delete: 'deleted',
};

const nextStatus: Partial<Record<Intent, AdminArticle['status']>> = {
  submit: 'in_review',
  return: 'draft',
  approve: 'approved',
  publish: 'published',
  schedule: 'published',
  unpublish: 'approved',
  archive: 'archived',
  restore: 'draft',
};

/**
 * Saves the editor form and applies the requested workflow step, acting as the
 * signed-in user. The database triggers and policies decide whether each step
 * is allowed; this function only reports the outcome.
 */
export async function saveArticle(
  db: SupabaseClient,
  existing: AdminArticle | null,
  data: ArticleForm,
  intent: Intent,
  publishAtLocal: string,
): Promise<SaveResult> {
  const id = existing?.id ?? randomUUID();
  const lang = existing?.lang ?? data.lang;

  let slug = data.slug;
  if (!slug) slug = lang === 'en' ? slugify(data.title) : '';
  if (!slug) slug = `${new Date().toISOString().slice(0, 10)}-${id.slice(0, 6)}`;
  if (!SLUG_PATTERN.test(slug)) return { ok: false, error: 'invalid' };

  let publishAt: string | null = null;
  if (intent === 'schedule') {
    publishAt = cairoLocalToUtc(publishAtLocal);
    if (!publishAt || Date.parse(publishAt) < Date.now() + 60_000) return { ok: false, error: 'scheduleTime' };
  }

  const content = {
    slug,
    category_id: data.category_id,
    title: data.title,
    subtitle: data.subtitle,
    summary: data.summary,
    body: data.body,
    byline: data.byline,
    tags: data.tags,
    cover_media_id: data.cover_media_id,
    seo_title: data.seo_title,
    seo_description: data.seo_description,
  };

  if (existing) {
    const { error } = await db.from('articles').update(content).eq('id', id);
    if (error) return { ok: false, error: errorKey(error) };
  } else {
    const { error } = await db.from('articles').insert({ id, lang, ...content });
    if (error) return { ok: false, error: errorKey(error) };
  }

  const status = nextStatus[intent];
  if (status) {
    const update: Record<string, unknown> = { status };
    if (intent === 'publish') update.publish_at = new Date().toISOString();
    if (intent === 'schedule') update.publish_at = publishAt;
    const { data: rows, error } = await db.from('articles').update(update).eq('id', id).select('id');
    if (error) return { ok: false, error: errorKey(error) };
    if (!rows || rows.length === 0) return { ok: false, error: 'forbidden' };
  }

  const linkError = await linkTranslation(db, id, existing?.translation_group ?? null, data.translation_of);
  if (linkError) return { ok: false, error: linkError };

  await syncPublicMedia([...new Set([...referencedMedia(existing ?? {}), ...referencedMedia(content)])]);
  return { ok: true, id, flash: existing ? flashFor[intent] : intent === 'save' ? 'created' : flashFor[intent] };
}

async function linkTranslation(
  db: SupabaseClient,
  id: string,
  currentGroup: string | null,
  otherId: string | null,
): Promise<string | null> {
  if (!otherId) {
    if (currentGroup) {
      const { error } = await db.from('articles').update({ translation_group: null }).eq('id', id);
      if (error) return errorKey(error);
    }
    return null;
  }
  const { data: other, error } = await db.from('articles').select('id, translation_group').eq('id', otherId).maybeSingle();
  if (error || !other) return 'notFound';
  if (currentGroup && other.translation_group === currentGroup) return null;
  const group = (other.translation_group as string | null) ?? currentGroup ?? randomUUID();
  const own = await db.from('articles').update({ translation_group: group }).eq('id', id);
  if (own.error) return errorKey(own.error);
  if (other.translation_group !== group) {
    const linked = await db.from('articles').update({ translation_group: group }).eq('id', otherId);
    if (linked.error) return errorKey(linked.error);
  }
  return null;
}

export async function deleteArticle(db: SupabaseClient, article: AdminArticle): Promise<SaveResult> {
  const { data, error } = await db.from('articles').delete().eq('id', article.id).select('id');
  if (error) return { ok: false, error: errorKey(error) };
  if (!data || data.length === 0) return { ok: false, error: 'forbidden' };
  await syncPublicMedia(referencedMedia(article));
  return { ok: true, id: article.id, flash: 'deleted' };
}

/** Restores content fields from a revision snapshot into the article (status is unchanged). */
export async function restoreRevision(db: SupabaseClient, article: AdminArticle, revisionId: number): Promise<SaveResult> {
  const { data: revision, error } = await db
    .from('article_revisions')
    .select('snapshot')
    .eq('id', revisionId)
    .eq('article_id', article.id)
    .maybeSingle();
  if (error || !revision) return { ok: false, error: 'notFound' };
  const s = revision.snapshot as Record<string, unknown>;
  const { error: updateError } = await db
    .from('articles')
    .update({
      title: s.title,
      subtitle: s.subtitle,
      summary: s.summary,
      body: s.body,
      byline: s.byline,
      tags: s.tags,
      category_id: s.category_id,
      cover_media_id: s.cover_media_id,
      seo_title: s.seo_title,
      seo_description: s.seo_description,
    })
    .eq('id', article.id);
  if (updateError) return { ok: false, error: errorKey(updateError) };
  await syncPublicMedia([...new Set([...referencedMedia(article), ...referencedMedia(s as never)])]);
  return { ok: true, id: article.id, flash: 'restored' };
}
