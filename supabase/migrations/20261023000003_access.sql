-- Grants and row level security. Everything is denied unless granted here.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- Helpers referenced from policies and the public search function.
grant execute on function private.has_perm(text) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.normalize_search(text) to anon, authenticated;

grant execute on function public.search_articles(text, text, integer) to anon, authenticated;
grant execute on function public.article_gone(text, text) to anon, authenticated;

grant execute on function public.staff_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.staff_set_permission(uuid, text, boolean) to authenticated;
grant execute on function public.staff_set_status(uuid, public.staff_status) to authenticated;
grant execute on function public.staff_update_own_name(text) to authenticated;
grant execute on function public.staff_invite_prepare(text, text, public.app_role, text[]) to authenticated;
grant execute on function public.staff_revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation() to authenticated;
grant execute on function public.my_access() to authenticated;

grant execute on function public.staff_attach_invited_user(uuid, uuid) to service_role;
grant execute on function public.owner_bootstrap_prepare(text, text) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.log_auth_event(uuid, text, jsonb) to service_role;

-- The server's service role works on all tables (it bypasses RLS) ...
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ... except that the audit trail is append-only, even for the service role.
revoke update, delete, truncate on public.audit_events from service_role;

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.categories enable row level security;
alter table public.media_assets enable row level security;
alter table public.articles enable row level security;
alter table public.article_revisions enable row level security;
alter table public.article_tombstones enable row level security;
alter table public.homepage_slots enable row level security;
alter table public.breaking_ticker enable row level security;
alter table public.site_settings enable row level security;
alter table public.ad_inquiries enable row level security;
alter table public.rate_limits enable row level security;
alter table public.audit_events enable row level security;

-- Permissions reference data
grant select on public.permissions, public.role_permissions to authenticated;
create policy "staff read permissions" on public.permissions for select to authenticated using (private.is_staff());
create policy "staff read role permissions" on public.role_permissions for select to authenticated using (private.is_staff());

-- Staff
grant select on public.staff_profiles, public.staff_permissions, public.staff_invitations to authenticated;
create policy "read own or with staff.read" on public.staff_profiles for select to authenticated
  using (user_id = auth.uid() or private.has_perm('staff.read'));
create policy "read own or with staff.read" on public.staff_permissions for select to authenticated
  using (user_id = auth.uid() or private.has_perm('staff.read'));
create policy "read with staff.read" on public.staff_invitations for select to authenticated
  using (private.has_perm('staff.read') or private.has_perm('staff.invite'));

-- Categories
grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;
create policy "public reads visible categories" on public.categories for select to anon using (visible);
create policy "staff read categories" on public.categories for select to authenticated
  using (visible or private.is_staff());
create policy "managers insert categories" on public.categories for insert to authenticated
  with check (private.has_perm('category.manage'));
create policy "managers update categories" on public.categories for update to authenticated
  using (private.has_perm('category.manage')) with check (private.has_perm('category.manage'));
create policy "managers delete categories" on public.categories for delete to authenticated
  using (private.has_perm('category.manage'));

-- Articles
grant select (id, lang, slug, status, category_id, title, subtitle, summary, body, byline, tags,
  cover_media_id, translation_group, seo_title, seo_description, publish_at, first_published_at,
  updated_at, search_text) on public.articles to anon;
grant select, insert, update, delete on public.articles to authenticated;

create policy "public reads published articles" on public.articles for select to anon
  using (status = 'published' and publish_at <= now());
create policy "staff read permitted articles" on public.articles for select to authenticated
  using (
    (status = 'published' and publish_at <= now())
    or private.has_perm('article.edit_any')
    or private.has_perm('article.publish')
    or (author_id = auth.uid() and private.has_perm('article.edit_own'))
  );
create policy "writers insert articles" on public.articles for insert to authenticated
  with check (private.has_perm('article.create'));
create policy "permitted staff update articles" on public.articles for update to authenticated
  using (
    private.has_perm('article.edit_any')
    or private.has_perm('article.publish')
    or (author_id = auth.uid() and private.has_perm('article.edit_own'))
  )
  with check (
    private.has_perm('article.edit_any')
    or private.has_perm('article.publish')
    or (author_id = auth.uid() and private.has_perm('article.edit_own'))
  );
create policy "permitted staff delete articles" on public.articles for delete to authenticated
  using (private.has_perm('article.delete'));

grant select on public.article_revisions to authenticated;
create policy "read revisions of visible articles" on public.article_revisions for select to authenticated
  using (private.is_staff() and exists (select 1 from public.articles a where a.id = article_id));

-- Media library
grant select (id, path, mime_type, width, height, alt_ar, alt_en, caption_ar, caption_en, is_public)
  on public.media_assets to anon;
grant select, insert, update, delete on public.media_assets to authenticated;
create policy "public reads published media" on public.media_assets for select to anon using (is_public);
create policy "staff read media" on public.media_assets for select to authenticated
  using (is_public or private.is_staff());
create policy "uploaders insert media" on public.media_assets for insert to authenticated
  with check (private.has_perm('media.upload'));
create policy "owners or managers update media" on public.media_assets for update to authenticated
  using (private.has_perm('media.manage') or (uploaded_by = auth.uid() and private.has_perm('media.upload')))
  with check (private.has_perm('media.manage') or (uploaded_by = auth.uid() and private.has_perm('media.upload')));
create policy "managers delete media" on public.media_assets for delete to authenticated
  using (
    not is_public
    and (private.has_perm('media.manage') or (uploaded_by = auth.uid() and private.has_perm('media.upload')))
  );

-- Homepage and ticker
grant select on public.homepage_slots to anon;
grant select, insert, update, delete on public.homepage_slots to authenticated;
create policy "public reads slots of public articles" on public.homepage_slots for select to anon
  using (exists (select 1 from public.articles a where a.id = article_id));
create policy "staff read slots" on public.homepage_slots for select to authenticated
  using (private.has_perm('homepage.manage') or exists (select 1 from public.articles a where a.id = article_id));
create policy "homepage managers write slots" on public.homepage_slots for all to authenticated
  using (private.has_perm('homepage.manage')) with check (private.has_perm('homepage.manage'));

grant select (id, lang, text, article_id, sort_order, active, expires_at) on public.breaking_ticker to anon;
grant select, insert, update, delete on public.breaking_ticker to authenticated;
create policy "public reads active ticker" on public.breaking_ticker for select to anon
  using (
    active and (expires_at is null or expires_at > now())
    and (article_id is null or exists (select 1 from public.articles a where a.id = article_id))
  );
create policy "staff read ticker" on public.breaking_ticker for select to authenticated
  using (
    private.has_perm('homepage.manage')
    or (active and (expires_at is null or expires_at > now())
        and (article_id is null or exists (select 1 from public.articles a where a.id = article_id)))
  );
create policy "homepage managers write ticker" on public.breaking_ticker for all to authenticated
  using (private.has_perm('homepage.manage')) with check (private.has_perm('homepage.manage'));

-- Site settings (public values only)
grant select (key, value, updated_at) on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;
create policy "anyone reads settings" on public.site_settings for select to anon using (true);
create policy "staff read settings" on public.site_settings for select to authenticated using (true);
create policy "settings managers write" on public.site_settings for insert to authenticated
  with check (private.has_perm('settings.manage'));
create policy "settings managers update" on public.site_settings for update to authenticated
  using (private.has_perm('settings.manage')) with check (private.has_perm('settings.manage'));

-- Advertising inquiries: created only by the server endpoint (service role).
grant select, update, delete on public.ad_inquiries to authenticated;
create policy "inquiry readers" on public.ad_inquiries for select to authenticated
  using (private.has_perm('inquiry.read'));
create policy "inquiry managers update" on public.ad_inquiries for update to authenticated
  using (private.has_perm('inquiry.manage')) with check (private.has_perm('inquiry.manage'));
create policy "inquiry managers delete" on public.ad_inquiries for delete to authenticated
  using (private.has_perm('inquiry.manage'));

-- Audit trail
grant select on public.audit_events to authenticated;
create policy "audit readers" on public.audit_events for select to authenticated
  using (private.has_perm('audit.read'));

-- ---------------------------------------------------------------------------
-- Storage: uploads land in a private bucket; the server copies images used by
-- published articles into the public bucket.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-private', 'media-private', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('media-public', 'media-public', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "staff read private media" on storage.objects for select to authenticated
  using (bucket_id = 'media-private' and private.is_staff());
create policy "uploaders add private media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media-private'
    and private.has_perm('media.upload')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "uploaders or managers remove private media" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media-private'
    and (private.has_perm('media.manage')
         or ((storage.foldername(name))[1] = auth.uid()::text and private.has_perm('media.upload')))
  );
