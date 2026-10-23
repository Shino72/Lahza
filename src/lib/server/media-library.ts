import type { SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';
import { signedUrls } from './media';

export interface LibraryItem {
  id: string;
  path: string;
  src: string;
  width: number;
  height: number;
  alt_ar: string;
  alt_en: string;
  caption_ar: string;
  caption_en: string;
  is_public: boolean;
  uploaded_by: string;
  created_at: string;
}

/** Media visible to the signed-in staff member, with URLs they can load. */
export async function loadLibrary(
  db: SupabaseClient,
  options: { ids?: string[]; limit?: number; offset?: number } = {},
): Promise<LibraryItem[]> {
  let query = db
    .from('media_assets')
    .select('id, path, width, height, alt_ar, alt_en, caption_ar, caption_en, is_public, uploaded_by, created_at')
    .order('created_at', { ascending: false });
  if (options.ids) {
    if (options.ids.length === 0) return [];
    query = query.in('id', options.ids);
  } else {
    query = query.range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 60) - 1);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Omit<LibraryItem, 'src'>[];
  const signed = await signedUrls(db, rows.filter((r) => !r.is_public).map((r) => r.path));
  return rows.map((r) => ({
    ...r,
    src: r.is_public
      ? `${serverEnv.supabaseUrl}/storage/v1/object/public/media-public/${r.path}`
      : signed.get(r.path) ?? '',
  }));
}
