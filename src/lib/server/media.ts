import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBody } from '../article-body';
import { getServiceClient } from './supabase';

export { ImageRejected, MAX_UPLOAD_BYTES, processImage } from './image-processing';

export interface UploadedMedia {
  id: string;
  path: string;
  width: number;
  height: number;
}

/** Stores a processed image in the private bucket and records it, acting as the signed-in user. */
export async function storeImage(
  db: SupabaseClient,
  userId: string,
  image: { data: Buffer; width: number; height: number },
  text: { altAr?: string; altEn?: string; captionAr?: string; captionEn?: string },
): Promise<UploadedMedia> {
  const path = `${userId}/${randomUUID()}.webp`;
  const upload = await db.storage.from('media-private').upload(path, image.data, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const { data, error } = await db
    .from('media_assets')
    .insert({
      path,
      mime_type: 'image/webp',
      width: image.width,
      height: image.height,
      size_bytes: image.data.byteLength,
      alt_ar: text.altAr ?? '',
      alt_en: text.altEn ?? '',
      caption_ar: text.captionAr ?? '',
      caption_en: text.captionEn ?? '',
    })
    .select('id')
    .single();
  if (error || !data) {
    await db.storage.from('media-private').remove([path]);
    throw error ?? new Error('media insert failed');
  }
  return { id: data.id as string, path, width: image.width, height: image.height };
}

/** Signed URLs so staff can see unpublished images in the dashboard. */
export async function signedUrls(db: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const { data } = await db.storage.from('media-private').createSignedUrls(paths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}

export function referencedMedia(article: { cover_media_id?: string | null; body?: unknown }): string[] {
  const ids = new Set<string>();
  if (article.cover_media_id) ids.add(article.cover_media_id);
  for (const block of parseBody(article.body ?? [])) if (block.type === 'image') ids.add(block.mediaId);
  return [...ids];
}

/**
 * Makes images used by published articles publicly readable and withdraws images
 * no published article uses any more. Runs with the service role after the
 * editorial change itself was authorised and committed by the user's session.
 */
export async function syncPublicMedia(mediaIds: string[]): Promise<void> {
  if (mediaIds.length === 0) return;
  const admin = getServiceClient();
  const { data: media, error } = await admin.from('media_assets').select('id, path, is_public').in('id', mediaIds);
  if (error) throw error;

  for (const item of media ?? []) {
    const usedAs = async (apply: (q: ReturnType<typeof publishedCount>) => ReturnType<typeof publishedCount>) => {
      const { count, error: countError } = await apply(publishedCount());
      if (countError) throw countError;
      return count ?? 0;
    };
    const publishedCount = () =>
      admin.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published');
    const count =
      (await usedAs((q) => q.eq('cover_media_id', item.id))) +
      (await usedAs((q) => q.filter('body', 'cs', JSON.stringify([{ mediaId: item.id }]))));
    const shouldBePublic = (count ?? 0) > 0;

    if (shouldBePublic && !item.is_public) {
      const file = await admin.storage.from('media-private').download(item.path);
      if (file.error) throw file.error;
      const put = await admin.storage
        .from('media-public')
        .upload(item.path, await file.data.arrayBuffer(), { contentType: 'image/webp', upsert: true });
      if (put.error) throw put.error;
      await admin.from('media_assets').update({ is_public: true }).eq('id', item.id);
    } else if (!shouldBePublic && item.is_public) {
      await admin.storage.from('media-public').remove([item.path]);
      await admin.from('media_assets').update({ is_public: false }).eq('id', item.id);
    }
  }
}
