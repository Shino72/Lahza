import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ImageRejected, MAX_UPLOAD_BYTES, processImage } from '../../src/lib/server/image-processing';

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#0f2a4a' } }).png().toBuffer();
const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('image uploads', () => {
  it('re-encodes valid images to WebP and limits their width', async () => {
    const result = await processImage(toArrayBuffer(await png(2400, 1200)));
    expect((await sharp(result.data).metadata()).format).toBe('webp');
    expect(result.width).toBe(1600);
    expect(result.height).toBe(800);
  });

  it('strips metadata such as GPS location', async () => {
    const withExif = await sharp(await png(400, 300))
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-location' } } })
      .toBuffer();
    const result = await processImage(toArrayBuffer(withExif));
    const meta = await sharp(result.data).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it.each([
    ['an HTML file renamed to .jpg', Buffer.from('<html><script>alert(1)</script></html>')],
    ['an SVG image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ['an empty file', Buffer.alloc(0)],
    ['a file over the size limit', Buffer.alloc(MAX_UPLOAD_BYTES + 1)],
  ])('rejects %s', async (_label, buffer) => {
    await expect(processImage(toArrayBuffer(buffer))).rejects.toBeInstanceOf(ImageRejected);
  });

  it('rejects images with oversized dimensions', async () => {
    const tall = await sharp({ create: { width: 10, height: 9000, channels: 3, background: '#000' } }).png().toBuffer();
    await expect(processImage(toArrayBuffer(tall))).rejects.toBeInstanceOf(ImageRejected);
  });
});
