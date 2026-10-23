import { getServiceClient } from './supabase';

/** Records sign-in related events in the audit trail. Never pass passwords or tokens. */
export async function logAuthEvent(userId: string | null, action: string, details: Record<string, unknown> = {}) {
  const { error } = await getServiceClient().rpc('log_auth_event', {
    p_actor: userId,
    p_action: action,
    p_details: details,
  });
  if (error) console.error('audit log failed', error.message);
}
