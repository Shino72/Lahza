import type { Lang } from '../../content/types';
import { inquirySchema, type Inquiry } from '../inquiry';
import { allow, clientKey } from './rate-limit';
import { getServiceClient } from './supabase';
import { verifyTurnstile } from './turnstile';

export type InquiryResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; fields: string[]; values: Record<string, string> }
  | { ok: false; reason: 'rate_limited' | 'spam' | 'failed'; values: Record<string, string> };

const FIELDS = ['company', 'contactPerson', 'email', 'phone', 'adType', 'details', 'website'] as const;

export async function submitInquiry(form: FormData, lang: Lang, address: string | undefined): Promise<InquiryResult> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? '').slice(0, 2100)]));
  const parsed = inquirySchema.safeParse(values);
  if (!parsed.success) {
    // A filled honeypot is treated as spam without telling the sender which field tripped.
    if (parsed.error.issues.some((i) => i.path[0] === 'website')) return { ok: false, reason: 'spam', values };
    return { ok: false, reason: 'invalid', fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))], values };
  }
  const key = clientKey(address);
  if (!(await allow('inquiry', key, 5, 3600))) return { ok: false, reason: 'rate_limited', values };
  if (!(await verifyTurnstile(form.get('cf-turnstile-response') as string | null, address))) {
    return { ok: false, reason: 'spam', values };
  }
  const inquiry: Inquiry = parsed.data;
  const { error } = await getServiceClient().from('ad_inquiries').insert({
    company: inquiry.company,
    contact_person: inquiry.contactPerson,
    email: inquiry.email,
    phone: inquiry.phone,
    ad_type: inquiry.adType,
    details: inquiry.details,
    lang,
  });
  if (error) {
    console.error('inquiry insert failed', error.message);
    return { ok: false, reason: 'failed', values };
  }
  return { ok: true };
}
