import { createHmac, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const env = {
  url: process.env.SUPABASE_URL ?? '',
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
  secretKey: process.env.SUPABASE_SECRET_KEY ?? '',
};

export const hasSupabase = Boolean(env.url && env.publishableKey && env.secretKey);

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export const adminClient = () => createClient(env.url, env.secretKey, options);
export const anonClient = () => createClient(env.url, env.publishableKey, options);

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of input.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits), used to complete MFA for test accounts. */
export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export type Role = 'owner' | 'manager' | 'editor' | 'journalist';

export interface TestStaff {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

/** Creates a confirmed auth user with a staff profile and returns a signed-in client. */
export async function createStaff(
  role: Role,
  opts: { mfa?: boolean; status?: 'active' | 'suspended' | 'invited'; permissions?: string[] } = {},
): Promise<TestStaff> {
  const admin = adminClient();
  const email = `${role}-${randomUUID().slice(0, 8)}@test.lahza.local`;
  const password = `Test-${randomUUID()}-Aa1`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const id = data.user.id;
  const { error: profileError } = await admin
    .from('staff_profiles')
    .insert({ user_id: id, email, display_name: `${role} test`, role, status: opts.status ?? 'active' });
  if (profileError) throw profileError;
  for (const permission of opts.permissions ?? []) {
    const { error: permError } = await admin.from('staff_permissions').insert({ user_id: id, permission });
    if (permError) throw permError;
  }

  const client = createClient(env.url, env.publishableKey, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  if (opts.mfa) {
    const { data: factor, error: enrollError } = await client.auth.mfa.enroll({ factorType: 'totp' });
    if (enrollError || !factor) throw enrollError ?? new Error('enroll failed');
    const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: totp(factor.totp.secret),
    });
    if (verifyError) throw verifyError;
  }
  return { id, email, password, client };
}

export async function categoryId(slug = 'egypt'): Promise<string> {
  const { data, error } = await adminClient().from('categories').select('id').eq('slug', slug).single();
  if (error || !data) throw error ?? new Error('category missing');
  return data.id as string;
}

export const uniqueSlug = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
