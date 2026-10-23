import sharp, { type Metadata } from 'sharp';

// Vercel functions accept request bodies up to 4.5 MB.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 8000;
const MAX_PIXELS = 40_000_000;
const OUTPUT_WIDTH = 1600;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export class ImageRejected extends Error {}

/**
 * Validates an upload by decoding it (not by its name or declared type) and
 * re-encodes it to WebP, which drops EXIF/GPS metadata and anything appended
 * to the original file.
 */
export async function processImage(input: ArrayBuffer): Promise<{ data: Buffer; width: number; height: number }> {
  if (input.byteLength === 0 || input.byteLength > MAX_UPLOAD_BYTES) throw new ImageRejected('size');
  const buffer = Buffer.from(input);
  let meta: Metadata;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new ImageRejected('decode');
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new ImageRejected('format');
  if (!meta.width || !meta.height || meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new ImageRejected('dimensions');
  }
  try {
    const { data, info } = await sharp(buffer, { limitInputPixels: MAX_PIXELS, animated: false })
      .rotate()
      .resize({ width: OUTPUT_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ImageRejected('decode');
  }
}
