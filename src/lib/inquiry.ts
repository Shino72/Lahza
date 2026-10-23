import { z } from 'zod';

export const advertisementTypes = ['banner', 'sponsored', 'campaign', 'other'] as const;

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/**
 * Advertising inquiry payload. Enforced on the server endpoint that will store
 * inquiries; the browser only mirrors these limits for convenience.
 */
export const inquirySchema = z.object({
  company: trimmed(120),
  contactPerson: trimmed(120),
  email: z.string().trim().max(254).pipe(z.email()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/),
  adType: z.enum(advertisementTypes),
  details: z.string().trim().max(2000).optional().default(''),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(0).optional().default(''),
});

export type Inquiry = z.infer<typeof inquirySchema>;
