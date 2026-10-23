import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'owner' | 'manager' | 'editor' | 'journalist';

export interface Access {
  userId: string;
  role: Role;
  status: 'invited' | 'active' | 'suspended';
  displayName: string;
  email: string;
  mfaRequired: boolean;
  aal: 'aal1' | 'aal2';
  permissions: string[];
}

export async function loadAccess(db: SupabaseClient): Promise<Access | null> {
  const { data, error } = await db.rpc('my_access');
  if (error || !data) return null;
  return data as Access;
}

export const can = (access: Access | undefined | null, permission: string) =>
  !!access && access.status === 'active' && (access.role === 'owner' || access.permissions.includes(permission));
