import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  anonClient,
  categoryId,
  createStaff,
  hasSupabase,
  uniqueSlug,
  type TestStaff,
} from './helpers';

/*
 * Exercises the database directly through the public Data API with separate
 * accounts, so these checks hold no matter what the dashboard UI does.
 */
describe.skipIf(!hasSupabase)('database access control', () => {
  let egypt: string;
  let journalist: TestStaff;
  let otherJournalist: TestStaff;
  let editor: TestStaff;
  let editorWithoutMfa: TestStaff;
  let manager: TestStaff;
  let publishedId: string;
  let draftId: string;
  let scheduledId: string;
  let publishedSlug: string;

  const insertArticle = async (fields: Record<string, unknown>) => {
    const { data, error } = await adminClient()
      .from('articles')
      .insert({ lang: 'ar', category_id: egypt, byline: 'test', title: 'خبر', author_id: journalist.id, ...fields })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  };

  beforeAll(async () => {
    egypt = await categoryId();
    [journalist, otherJournalist, editor, editorWithoutMfa, manager] = await Promise.all([
      createStaff('journalist'),
      createStaff('journalist'),
      createStaff('editor', { mfa: true }),
      createStaff('editor'),
      createStaff('manager', { mfa: true }),
    ]);
    publishedSlug = uniqueSlug('published');
    publishedId = await insertArticle({ slug: publishedSlug, status: 'published', publish_at: new Date(Date.now() - 60_000).toISOString(), title: 'منشور للاختبار' });
    draftId = await insertArticle({ slug: uniqueSlug('draft'), status: 'draft', title: 'مسودة سرية للاختبار' });
    scheduledId = await insertArticle({ slug: uniqueSlug('scheduled'), status: 'published', publish_at: new Date(Date.now() + 86_400_000).toISOString() });
  });

  describe('anonymous visitors', () => {
    it('see published articles only', async () => {
      const { data } = await anonClient().from('articles').select('id').in('id', [publishedId, draftId, scheduledId]);
      expect(data?.map((r) => r.id)).toEqual([publishedId]);
    });

    it('cannot read internal article columns', async () => {
      const { error } = await anonClient().from('articles').select('author_id').eq('id', publishedId);
      expect(error?.code).toBe('42501');
    });

    it('cannot create, edit or delete articles', async () => {
      const anon = anonClient();
      const insert = await anon.from('articles').insert({ lang: 'ar', slug: uniqueSlug('x'), category_id: egypt, title: 'x', byline: 'x' });
      expect(insert.error).not.toBeNull();
      await anon.from('articles').update({ title: 'hacked' }).eq('id', publishedId);
      await anon.from('articles').delete().eq('id', publishedId);
      const { data } = await adminClient().from('articles').select('title').eq('id', publishedId).single();
      expect(data?.title).toBe('منشور للاختبار');
    });

    it('cannot read or create inquiries, staff, invitations or the audit log', async () => {
      const anon = anonClient();
      for (const table of ['ad_inquiries', 'staff_profiles', 'staff_invitations', 'audit_events', 'rate_limits', 'article_revisions']) {
        const { error } = await anon.from(table).select('*').limit(1);
        expect(error, table).not.toBeNull();
      }
      const insert = await anon.from('ad_inquiries').insert({ company: 'x', contact_person: 'x', email: 'a@b.co', phone: '0100000000', ad_type: 'banner', lang: 'ar' });
      expect(insert.error).not.toBeNull();
    });

    it('cannot call server-only functions', async () => {
      const anon = anonClient();
      expect((await anon.rpc('rate_limit_hit', { p_key: 'x', p_limit: 1, p_window_seconds: 60 })).error).not.toBeNull();
      expect((await anon.rpc('owner_bootstrap_prepare', { p_email: 'evil@example.com', p_display_name: 'x' })).error).not.toBeNull();
      expect((await anon.rpc('staff_set_role', { target: journalist.id, new_role: 'manager' })).error).not.toBeNull();
    });

    it('cannot upload files or list private media', async () => {
      const anon = anonClient();
      const upload = await anon.storage.from('media-private').upload(`x/${uniqueSlug('f')}.webp`, new Blob(['x'], { type: 'image/webp' }));
      expect(upload.error).not.toBeNull();
      const publicUpload = await anon.storage.from('media-public').upload(`${uniqueSlug('f')}.webp`, new Blob(['x'], { type: 'image/webp' }));
      expect(publicUpload.error).not.toBeNull();
      const { data } = await anon.storage.from('media-private').list();
      expect(data ?? []).toEqual([]);
    });

    it('search returns published articles only', async () => {
      const { data } = await anonClient().rpc('search_articles', { p_lang: 'ar', p_query: 'سرية للاختبار' });
      expect(data ?? []).toEqual([]);
      const found = await anonClient().rpc('search_articles', { p_lang: 'ar', p_query: 'منشور للاختبار' });
      expect(found.data?.map((r: { id: string }) => r.id)).toContain(publishedId);
    });
  });

  describe('journalists', () => {
    it('create drafts as themselves and cannot publish them directly', async () => {
      const { data, error } = await journalist.client
        .from('articles')
        .insert({ lang: 'ar', slug: uniqueSlug('j'), category_id: egypt, title: 'خبر صحفي', byline: 'صحفي' })
        .select('id, status, author_id')
        .single();
      expect(error).toBeNull();
      expect(data).toMatchObject({ status: 'draft', author_id: journalist.id });

      const publish = await journalist.client.from('articles').update({ status: 'published' }).eq('id', data!.id).select();
      expect(publish.error?.code).toBe('42501');

      const submit = await journalist.client.from('articles').update({ status: 'in_review' }).eq('id', data!.id).select('status').single();
      expect(submit.data?.status).toBe('in_review');
    });

    it('cannot insert an article already published', async () => {
      const { error } = await journalist.client
        .from('articles')
        .insert({ lang: 'ar', slug: uniqueSlug('j'), category_id: egypt, title: 'x', byline: 'x', status: 'published', publish_at: new Date().toISOString() });
      expect(error?.code).toBe('42501');
    });

    it("cannot see or edit another journalist's draft (IDOR)", async () => {
      const read = await otherJournalist.client.from('articles').select('id').eq('id', draftId);
      expect(read.data).toEqual([]);
      await otherJournalist.client.from('articles').update({ title: 'changed' }).eq('id', draftId);
      const { data } = await adminClient().from('articles').select('title').eq('id', draftId).single();
      expect(data?.title).toBe('مسودة سرية للاختبار');
    });

    it('cannot change roles, permissions or invite staff', async () => {
      const c = journalist.client;
      expect((await c.rpc('staff_set_role', { target: journalist.id, new_role: 'manager' })).error).not.toBeNull();
      expect((await c.rpc('staff_set_permission', { target: journalist.id, perm: 'article.publish', granted: true })).error).not.toBeNull();
      expect((await c.rpc('staff_invite_prepare', { p_email: 'x@example.com', p_display_name: 'x', p_role: 'journalist', p_permissions: [] })).error).not.toBeNull();
      const direct = await c.from('staff_profiles').update({ role: 'owner' }).eq('user_id', journalist.id);
      expect(direct.error).not.toBeNull();
      const { data } = await adminClient().from('staff_profiles').select('role').eq('user_id', journalist.id).single();
      expect(data?.role).toBe('journalist');
    });

    it('cannot read inquiries or the audit log', async () => {
      const inquiries = await journalist.client.from('ad_inquiries').select('id');
      expect(inquiries.data ?? []).toEqual([]);
      const audit = await journalist.client.from('audit_events').select('id').limit(1);
      expect(audit.data ?? []).toEqual([]);
    });

    it('can upload only into their own folder of the private bucket', async () => {
      const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
      const own = await journalist.client.storage.from('media-private').upload(`${journalist.id}/${uniqueSlug('i')}.webp`, file);
      expect(own.error).toBeNull();
      const foreign = await journalist.client.storage.from('media-private').upload(`${editor.id}/${uniqueSlug('i')}.webp`, file);
      expect(foreign.error).not.toBeNull();
      const wrongType = await journalist.client.storage.from('media-private').upload(`${journalist.id}/${uniqueSlug('i')}.html`, new Blob(['<script>'], { type: 'text/html' }));
      expect(wrongType.error).not.toBeNull();
      const publicBucket = await journalist.client.storage.from('media-public').upload(`${uniqueSlug('i')}.webp`, file);
      expect(publicBucket.error).not.toBeNull();
    });
  });

  describe('multi-factor authentication', () => {
    it('privileged roles get no permissions until MFA is verified', async () => {
      const read = await editorWithoutMfa.client.from('articles').select('id').eq('id', draftId);
      expect(read.data).toEqual([]);
      await editorWithoutMfa.client.from('articles').update({ title: 'x' }).eq('id', draftId);
      const { data } = await adminClient().from('articles').select('title').eq('id', draftId).single();
      expect(data?.title).toBe('مسودة سرية للاختبار');
    });
  });

  describe('editors', () => {
    it('can publish and unpublish', async () => {
      const id = await insertArticle({ slug: uniqueSlug('e'), status: 'in_review' });
      const pub = await editor.client.from('articles').update({ status: 'published' }).eq('id', id).select('status, publish_at').single();
      expect(pub.error).toBeNull();
      expect(pub.data?.publish_at).not.toBeNull();
      const unpub = await editor.client.from('articles').update({ status: 'approved' }).eq('id', id).select('status').single();
      expect(unpub.data?.status).toBe('approved');
    });

    it('cannot delete articles or manage staff by default', async () => {
      await editor.client.from('articles').delete().eq('id', publishedId);
      const { data } = await adminClient().from('articles').select('id').eq('id', publishedId);
      expect(data).toHaveLength(1);
      expect((await editor.client.rpc('staff_set_status', { target: journalist.id, new_status: 'suspended' })).error).not.toBeNull();
    });
  });

  describe('managers', () => {
    it('cannot grant themselves or others permissions they do not hold', async () => {
      const self = await manager.client.rpc('staff_set_role', { target: manager.id, new_role: 'manager' });
      expect(self.error).not.toBeNull();
      const grant = await manager.client.rpc('staff_set_permission', { target: journalist.id, perm: 'audit.read', granted: true });
      expect(grant.error).not.toBeNull();
    });

    it('cannot create an Owner or touch the Owner account', async () => {
      const invite = await manager.client.rpc('staff_invite_prepare', { p_email: 'o@example.com', p_display_name: 'o', p_role: 'owner', p_permissions: [] });
      expect(invite.error).not.toBeNull();
    });
  });

  describe('account status', () => {
    it('suspended staff lose access immediately', async () => {
      const writer = await createStaff('journalist');
      const before = await writer.client.from('articles').insert({ lang: 'ar', slug: uniqueSlug('s'), category_id: egypt, title: 'x', byline: 'x' });
      expect(before.error).toBeNull();
      await adminClient().from('staff_profiles').update({ status: 'suspended' }).eq('user_id', writer.id);
      const after = await writer.client.from('articles').insert({ lang: 'ar', slug: uniqueSlug('s'), category_id: egypt, title: 'x', byline: 'x' });
      expect(after.error).not.toBeNull();
    });

    it('only one Owner can exist', async () => {
      await createStaff('owner', { mfa: true }).catch(() => undefined);
      const second = createStaff('owner');
      await expect(second).rejects.toBeTruthy();
    });
  });

  describe('audit trail', () => {
    it('records article changes and cannot be altered, even by the server role', async () => {
      const admin = adminClient();
      const { data } = await admin.from('audit_events').select('id, action').eq('target_id', publishedId).limit(1);
      expect(data?.[0]?.action).toBe('article.create');
      const update = await admin.from('audit_events').update({ action: 'x' }).eq('id', data![0]!.id);
      expect(update.error).not.toBeNull();
      const del = await admin.from('audit_events').delete().eq('id', data![0]!.id);
      expect(del.error).not.toBeNull();
    });
  });

  describe('data safety', () => {
    it('published articles cannot be deleted, even by an Owner, until archived', async () => {
      const owner = await createStaff('manager', { mfa: true });
      const id = await insertArticle({ slug: uniqueSlug('keep'), status: 'published', publish_at: new Date(Date.now() - 1000).toISOString() });
      await owner.client.from('articles').delete().eq('id', id);
      expect((await adminClient().from('articles').select('id').eq('id', id)).data).toHaveLength(1);
      await owner.client.from('articles').update({ status: 'archived' }).eq('id', id);
      const del = await owner.client.from('articles').delete().eq('id', id).select('id');
      expect(del.data).toHaveLength(1);
    });

    it('images used by an article cannot be deleted', async () => {
      const admin = adminClient();
      const { data: media } = await admin
        .from('media_assets')
        .insert({ path: `${journalist.id}/${uniqueSlug('m')}.webp`, mime_type: 'image/webp', width: 10, height: 10, size_bytes: 10, uploaded_by: journalist.id })
        .select('id')
        .single();
      await insertArticle({ slug: uniqueSlug('uses'), body: [{ type: 'image', mediaId: media!.id }] });
      const del = await admin.from('media_assets').delete().eq('id', media!.id);
      expect(del.error?.code).toBe('23503');
    });
  });

  describe('removed articles', () => {
    it('answers gone for archived articles that were public', async () => {
      await adminClient().from('articles').update({ status: 'archived' }).eq('id', publishedId);
      const { data } = await anonClient().rpc('article_gone', { p_lang: 'ar', p_slug: publishedSlug });
      expect(data).toBe(true);
    });
  });
});
