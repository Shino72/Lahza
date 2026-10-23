import { getServiceClient } from './supabase';

/**
 * Sends the Supabase invite email for an invitation already authorised and
 * recorded in the database, then links the new auth user to it.
 */
export async function deliverInvitation(invitationId: string, email: string, confirmUrl: string): Promise<boolean> {
  const admin = getServiceClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: confirmUrl });
  if (error || !data.user) {
    console.error('invite email failed', error?.message);
    await admin.from('staff_invitations').update({ revoked_at: new Date().toISOString() }).eq('id', invitationId);
    return false;
  }
  const { error: attachError } = await admin.rpc('staff_attach_invited_user', { inv_id: invitationId, new_user: data.user.id });
  if (attachError) {
    console.error('attach invitation failed', attachError.message);
    await admin.auth.admin.deleteUser(data.user.id);
    await admin.from('staff_invitations').update({ revoked_at: new Date().toISOString() }).eq('id', invitationId);
    return false;
  }
  return true;
}

/** Blocks or restores sign-in at the auth layer; the database already denies access while suspended. */
export async function setSignInBlocked(userId: string, blocked: boolean) {
  const { error } = await getServiceClient().auth.admin.updateUserById(userId, {
    ban_duration: blocked ? '876000h' : 'none',
  });
  if (error) console.error('ban update failed', error.message);
}

export async function deleteAuthUser(userId: string) {
  const { error } = await getServiceClient().auth.admin.deleteUser(userId);
  if (error) console.error('delete auth user failed', error.message);
}
