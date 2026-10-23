import type { APIRoute } from 'astro';
import { can } from '../../../lib/server/access';
import { field } from '../../../lib/server/admin';
import { ImageRejected, MAX_UPLOAD_BYTES, processImage, storeImage } from '../../../lib/server/media';
import { allow } from '../../../lib/server/rate-limit';
import { signedUrls } from '../../../lib/server/media';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Image upload used by the article editor. Returns the stored image for immediate use. */
export const POST: APIRoute = async ({ locals, request }) => {
  const access = locals.access;
  const db = locals.supabase!;
  if (!can(access, 'media.upload')) return json(403, { error: 'forbidden' });
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return json(413, { error: 'badImage' });
  if (!(await allow('upload', access!.userId, 60, 3600))) return json(429, { error: 'failed' });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json(400, { error: 'badImage' });
  try {
    const image = await processImage(await file.arrayBuffer());
    const stored = await storeImage(db, access!.userId, image, {
      altAr: field(form, 'alt_ar', 300),
      altEn: field(form, 'alt_en', 300),
    });
    const urls = await signedUrls(db, [stored.path]);
    return json(201, { id: stored.id, src: urls.get(stored.path) ?? '', width: stored.width, height: stored.height });
  } catch (error) {
    if (error instanceof ImageRejected) return json(400, { error: 'badImage' });
    console.error('upload failed', error instanceof Error ? error.message : error);
    return json(500, { error: 'failed' });
  }
};
