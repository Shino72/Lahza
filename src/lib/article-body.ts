import { z } from 'zod';
import type { ArticleBlock } from '../content/types';

const text = (max: number) => z.string().trim().min(1).max(max);

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: text(5000) }),
  z.object({ type: z.literal('heading'), text: text(200) }),
  z.object({ type: z.literal('quote'), text: text(1000), cite: z.string().trim().max(200).optional() }),
  z.object({ type: z.literal('list'), items: z.array(text(500)).min(1).max(50) }),
  z.object({ type: z.literal('image'), mediaId: z.uuid(), caption: z.string().trim().max(300).optional() }),
]);

export const bodySchema = z.array(blockSchema).max(300);

export type StoredBlock = z.infer<typeof blockSchema>;

/** Lenient read: keeps valid blocks and drops anything else instead of failing the page. */
export function parseBody(value: unknown): ArticleBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = blockSchema.safeParse(item);
    return parsed.success ? [parsed.data as ArticleBlock] : [];
  });
}
