-- Authorization helpers, editorial workflow enforcement, revisions, audit
-- trail and staff-management functions.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Text normalisation (kept in step with src/lib/search.ts)
-- ---------------------------------------------------------------------------

create function private.normalize_search(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(translate(
    regexp_replace(normalize(coalesce(input, ''), NFKC), '[ؐ-ًؚ-ٰٟۖ-ۭـ]', '', 'g'),
    'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩',
    'اااايهوي0123456789'
  )), '[^[:alnum:]]+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------------
-- Authorization
-- ---------------------------------------------------------------------------

-- Role of the calling user if their account is active and, for anyone holding
-- more than default Journalist rights, their session passed MFA (aal2).
create function private.staff_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.user_id = auth.uid()
    and sp.status = 'active'
    and (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or (sp.role = 'journalist'
          and not exists (select 1 from public.staff_permissions p where p.user_id = sp.user_id))
    )
$$;

create function private.effective_permissions(target uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when sp.role = 'owner' then (select array_agg(key order by key) from public.permissions)
    else coalesce((
      select array_agg(distinct perm order by perm) from (
        select rp.permission as perm from public.role_permissions rp where rp.role = sp.role
        union
        select p.permission from public.staff_permissions p where p.user_id = sp.user_id
      ) x
    ), '{}')
  end
  from public.staff_profiles sp
  where sp.user_id = target
$$;

create function private.has_perm(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when r is null then false
    when r = 'owner' then true
    else exists (select 1 from public.role_permissions rp where rp.role = r and rp.permission = perm)
      or exists (select 1 from public.staff_permissions p where p.user_id = auth.uid() and p.permission = perm)
  end
  from (select private.staff_role() as r) s
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_role() is not null
$$;

-- Whether the caller holds every permission in perms.
create function private.holds_all(perms text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_and(private.has_perm(p)), true) from unnest(perms) as p
$$;

create function private.role_permissions_of(r public.app_role)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when r = 'owner' then (select array_agg(key) from public.permissions)
    else coalesce((select array_agg(permission) from public.role_permissions where role = r), '{}')
  end
$$;

create function private.is_service_call()
returns boolean
language sql
stable
set search_path = ''
as $$
  -- session_user, not current_user: this runs inside SECURITY DEFINER functions.
  select coalesce(auth.role(), '') = 'service_role'
    or (coalesce(auth.role(), '') = '' and session_user in ('postgres', 'supabase_admin'))
$$;

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create function private.write_audit(action text, target_type text, target_id text, details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (actor_id, action, target_type, target_id, details)
  values (auth.uid(), action, target_type, target_id, coalesce(details, '{}'::jsonb))
$$;

create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  changed text[];
  target text := coalesce(rec ->> 'id', rec ->> 'user_id', rec ->> 'key');
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into changed
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at', 'search_text');
    if changed is null then
      return null;
    end if;
  end if;
  perform private.write_audit(
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    target,
    jsonb_strip_nulls(jsonb_build_object(
      'changed', changed,
      'role', rec ->> 'role',
      'status', rec ->> 'status',
      'permission', rec ->> 'permission',
      'title', rec ->> 'title',
      'lang', rec ->> 'lang'
    ))
  );
  return null;
end
$$;

-- ---------------------------------------------------------------------------
-- Articles: workflow, revisions, search text, tombstones
-- ---------------------------------------------------------------------------

create function private.article_search_text(a public.articles)
returns text
language sql
stable
set search_path = ''
as $$
  select private.normalize_search(concat_ws(' ',
    a.title, a.subtitle, a.summary, array_to_string(a.tags, ' '),
    (select string_agg(coalesce(b ->> 'text', '') || ' ' || coalesce(b ->> 'caption', ''), ' ')
       from jsonb_array_elements(a.body) b)
  ))
$$;

create function private.articles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  can_publish boolean;
  can_edit_any boolean;
  own boolean;
  from_s public.article_status;
  to_s public.article_status := new.status;
  allowed boolean;
begin
  if jsonb_array_length(new.body) > 300 or exists (
    select 1 from jsonb_array_elements(new.body) b
    where jsonb_typeof(b) <> 'object' or (b ->> 'type') not in ('paragraph', 'heading', 'quote', 'list', 'image')
  ) then
    raise exception 'invalid article body' using errcode = '22023';
  end if;

  new.search_text := private.article_search_text(new);
  new.updated_at := now();

  if to_s = 'published' and new.publish_at is null then
    new.publish_at := now();
  end if;

  if private.is_service_call() then
    if to_s = 'published' and new.first_published_at is null then
      new.first_published_at := new.publish_at;
    end if;
    return new;
  end if;

  can_publish := private.has_perm('article.publish');
  can_edit_any := private.has_perm('article.edit_any');

  if tg_op = 'INSERT' then
    if not private.has_perm('article.create') then
      raise exception 'not allowed to create articles' using errcode = '42501';
    end if;
    if new.author_id is distinct from uid and not can_edit_any then
      raise exception 'not allowed to assign another author' using errcode = '42501';
    end if;
    if new.status <> 'draft' then
      raise exception 'new articles start as drafts' using errcode = '42501';
    end if;
    new.created_by := uid;
    new.updated_by := uid;
    new.first_published_at := null;
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    raise exception 'immutable article fields changed' using errcode = '42501';
  end if;
  if new.author_id is distinct from old.author_id and not can_edit_any then
    raise exception 'not allowed to change the author' using errcode = '42501';
  end if;

  own := old.author_id = uid and private.has_perm('article.edit_own');
  if not (
    can_publish
    or (can_edit_any and old.status <> 'published')
    or (own and old.status in ('draft', 'in_review'))
  ) then
    raise exception 'not allowed to edit this article' using errcode = '42501';
  end if;

  from_s := old.status;
  if to_s <> from_s then
    allowed := case
      when from_s = 'draft' and to_s = 'in_review' then
        can_publish or can_edit_any or (own and private.has_perm('article.submit'))
      when from_s = 'in_review' and to_s = 'draft' then
        can_publish or can_edit_any or own
      when from_s = 'approved' and to_s = 'draft' then
        can_publish or can_edit_any
      when to_s in ('approved', 'published', 'archived') then
        can_publish and from_s <> 'archived'
      when from_s = 'archived' and to_s = 'draft' then
        can_publish
      when from_s = 'published' and to_s = 'draft' then
        can_publish
      else false
    end;
    if not allowed then
      raise exception 'status change % -> % not allowed', from_s, to_s using errcode = '42501';
    end if;
  elsif old.status = 'published' and not can_publish then
    raise exception 'only publishers can edit published articles' using errcode = '42501';
  end if;

  if to_s = 'published' and new.first_published_at is null then
    new.first_published_at := new.publish_at;
  end if;
  if new.first_published_at is distinct from old.first_published_at and old.first_published_at is not null then
    new.first_published_at := old.first_published_at;
  end if;

  new.updated_by := uid;
  return new;
end
$$;

create trigger articles_guard
before insert or update on public.articles
for each row execute function private.articles_guard();

create function private.articles_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.article_revisions (article_id, status, snapshot, edited_by)
  values (
    new.id,
    new.status,
    jsonb_build_object(
      'title', new.title, 'subtitle', new.subtitle, 'summary', new.summary, 'body', new.body,
      'byline', new.byline, 'tags', to_jsonb(new.tags), 'category_id', new.category_id,
      'cover_media_id', new.cover_media_id, 'seo_title', new.seo_title,
      'seo_description', new.seo_description, 'slug', new.slug, 'publish_at', new.publish_at
    ),
    auth.uid()
  );

  if new.status = 'published' then
    delete from public.article_tombstones where lang = new.lang and slug = new.slug;
  elsif tg_op = 'UPDATE' and old.status = 'published' and new.status = 'archived' and old.publish_at <= now() then
    insert into public.article_tombstones (lang, slug) values (old.lang, old.slug)
    on conflict (lang, slug) do update set removed_at = now();
  end if;

  perform private.write_audit(
    case
      when tg_op = 'INSERT' then 'article.create'
      when new.status <> old.status then 'article.status'
      else 'article.update'
    end,
    'articles',
    new.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'title', new.title,
      'lang', new.lang,
      'from', case when tg_op = 'UPDATE' and new.status <> old.status then old.status::text end,
      'to', new.status::text
    ))
  );
  return null;
end
$$;

create trigger articles_after_write
after insert or update on public.articles
for each row execute function private.articles_after_write();

create function private.articles_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'published' and old.publish_at <= now() then
    insert into public.article_tombstones (lang, slug) values (old.lang, old.slug)
    on conflict (lang, slug) do update set removed_at = now();
  end if;
  perform private.write_audit('article.delete', 'articles', old.id::text,
    jsonb_build_object('title', old.title, 'lang', old.lang, 'status', old.status::text));
  return null;
end
$$;

create trigger articles_after_delete
after delete on public.articles
for each row execute function private.articles_after_delete();

-- ---------------------------------------------------------------------------
-- Staff profile protection
-- ---------------------------------------------------------------------------

-- Direct table writes by staff are not granted; these functions are the only
-- path, and each one enforces "never more than you hold" and protects the Owner.

create function public.staff_set_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.staff_profiles;
begin
  if not private.has_perm('staff.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into t from public.staff_profiles where user_id = target;
  if t is null or target = auth.uid() or t.role = 'owner' or new_role = 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.holds_all(private.effective_permissions(target))
     or not private.holds_all(private.role_permissions_of(new_role)) then
    raise exception 'cannot grant permissions you do not hold' using errcode = '42501';
  end if;
  update public.staff_profiles set role = new_role, updated_at = now() where user_id = target;
end
$$;

create function public.staff_set_permission(target uuid, perm text, granted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.staff_profiles;
begin
  if not private.has_perm('staff.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into t from public.staff_profiles where user_id = target;
  if t is null or target = auth.uid() or t.role = 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.has_perm(perm) or not private.holds_all(private.effective_permissions(target)) then
    raise exception 'cannot grant permissions you do not hold' using errcode = '42501';
  end if;
  if granted then
    insert into public.staff_permissions (user_id, permission, granted_by)
    values (target, perm, auth.uid())
    on conflict do nothing;
  else
    delete from public.staff_permissions where user_id = target and permission = perm;
  end if;
end
$$;

create function public.staff_set_status(target uuid, new_status public.staff_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.staff_profiles;
begin
  if not private.has_perm('staff.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into t from public.staff_profiles where user_id = target;
  if t is null or target = auth.uid() or t.role = 'owner'
     or new_status not in ('active', 'suspended') or t.status = 'invited' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.holds_all(private.effective_permissions(target)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.staff_profiles set status = new_status, updated_at = now() where user_id = target;
end
$$;

create function public.staff_update_own_name(new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.staff_role() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.staff_profiles set display_name = btrim(new_name), updated_at = now() where user_id = auth.uid();
end
$$;

-- Step 1 of an invitation: authorise and record it. The server then sends the
-- Supabase invite email and calls staff_attach_invited_user with the new user id.
create function public.staff_invite_prepare(p_email text, p_display_name text, p_role public.app_role, p_permissions text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv uuid;
begin
  if not private.has_perm('staff.invite') or p_role = 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.holds_all(private.role_permissions_of(p_role)) or not private.holds_all(coalesce(p_permissions, '{}')) then
    raise exception 'cannot grant permissions you do not hold' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_profiles where lower(email) = lower(btrim(p_email))) then
    raise exception 'already a staff member' using errcode = '23505';
  end if;
  insert into public.staff_invitations (email, display_name, role, permissions, invited_by)
  values (lower(btrim(p_email)), btrim(p_display_name), p_role, coalesce(p_permissions, '{}'), auth.uid())
  returning id into inv;
  return inv;
end
$$;

create function public.staff_revoke_invitation(inv_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.staff_invitations;
begin
  if not private.has_perm('staff.invite') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into i from public.staff_invitations where id = inv_id;
  if i is null or i.accepted_at is not null or i.revoked_at is not null or i.role = 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.staff_invitations set revoked_at = now() where id = inv_id;
  delete from public.staff_profiles where user_id = i.user_id and status = 'invited';
  return i.user_id;
end
$$;

-- Service role only: link the invited auth user to the invitation.
create function public.staff_attach_invited_user(inv_id uuid, new_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.staff_invitations;
begin
  select * into i from public.staff_invitations where id = inv_id for update;
  if i is null or i.user_id is not null or i.revoked_at is not null then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;
  update public.staff_invitations set user_id = new_user where id = inv_id;
  insert into public.staff_profiles (user_id, email, display_name, role, status)
  values (new_user, i.email, i.display_name, i.role, 'invited');
  insert into public.staff_permissions (user_id, permission, granted_by)
  select new_user, p, i.invited_by from unnest(i.permissions) p;
end
$$;

-- Service role only: start the one-time Owner setup.
create function public.owner_bootstrap_prepare(p_email text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv uuid;
begin
  if exists (select 1 from public.staff_profiles where role = 'owner') then
    raise exception 'owner already exists' using errcode = '23505';
  end if;
  insert into public.staff_invitations (email, display_name, role, invited_by)
  values (lower(btrim(p_email)), btrim(p_display_name), 'owner', null)
  returning id into inv;
  return inv;
end
$$;

-- Called by the invited user after setting a password.
create function public.accept_invitation()
returns public.app_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.staff_profiles;
  i public.staff_invitations;
begin
  select * into p from public.staff_profiles where user_id = auth.uid() for update;
  if p is null then
    raise exception 'no invitation' using errcode = '42501';
  end if;
  if p.status <> 'invited' then
    return p.role;
  end if;
  select * into i from public.staff_invitations
  where user_id = auth.uid() and revoked_at is null and accepted_at is null
  order by created_at desc limit 1;
  if i is null then
    raise exception 'no invitation' using errcode = '42501';
  end if;
  if i.expires_at < now() then
    raise exception 'invitation expired' using errcode = '42501';
  end if;
  update public.staff_invitations set accepted_at = now() where id = i.id;
  update public.staff_profiles set status = 'active', updated_at = now() where user_id = auth.uid();
  perform private.write_audit('staff.invitation_accepted', 'staff_profiles', auth.uid()::text,
    jsonb_build_object('role', p.role));
  return p.role;
end
$$;

-- Service role only: fixed-window rate limiter. Returns true when the call is allowed.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  delete from public.rate_limits where window_start < now() - make_interval(secs => p_window_seconds * 2);
  insert into public.rate_limits (key, window_start, hits) values (p_key, win, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end
$$;

-- Service role only: record authentication events that happen outside the database.
create function public.log_auth_event(p_actor uuid, p_action text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (actor_id, action, target_type, target_id, details)
  values (p_actor, p_action, 'auth', p_actor::text, coalesce(p_details, '{}'::jsonb))
$$;

-- Public: whether an address belonged to an article that was removed (410 Gone).
create function public.article_gone(p_lang text, p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.article_tombstones t where t.lang = p_lang and t.slug = p_slug)
    and not exists (
      select 1 from public.articles a
      where a.lang = p_lang and a.slug = p_slug and a.status = 'published' and a.publish_at <= now()
    )
$$;

-- Public search over published articles; runs with the caller's rights so row
-- level security decides what is visible.
create function public.search_articles(p_lang text, p_query text, p_limit integer default 30)
returns table (
  id uuid, lang text, slug text, category_id uuid, title text, summary text,
  byline text, cover_media_id uuid, publish_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with terms as (
    select t from unnest(string_to_array(private.normalize_search(left(p_query, 100)), ' ')) t
    where char_length(t) > 1
    limit 8
  )
  select a.id, a.lang, a.slug, a.category_id, a.title, a.summary, a.byline, a.cover_media_id, a.publish_at
  from public.articles a
  where a.lang = p_lang
    and a.status = 'published'
    and a.publish_at <= now()
    and exists (select 1 from terms)
    and not exists (select 1 from terms where position(terms.t in a.search_text) = 0)
  order by a.publish_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- updated_at maintenance for simple tables.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger categories_touch before update on public.categories
for each row execute function private.touch_updated_at();
create trigger ad_inquiries_touch before update on public.ad_inquiries
for each row execute function private.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings
for each row execute function private.touch_updated_at();

create function private.site_settings_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end
$$;

create trigger site_settings_stamp before insert or update on public.site_settings
for each row execute function private.site_settings_stamp();

create function private.inquiry_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_call() then
    if (to_jsonb(new) - 'status' - 'notes' - 'updated_at' - 'handled_by')
       is distinct from (to_jsonb(old) - 'status' - 'notes' - 'updated_at' - 'handled_by') then
      raise exception 'only status and notes can change' using errcode = '42501';
    end if;
    new.handled_by := auth.uid();
  end if;
  return new;
end
$$;

create trigger ad_inquiries_stamp before update on public.ad_inquiries
for each row execute function private.inquiry_stamp();

create function private.media_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_service_call() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.uploaded_by := auth.uid();
    new.is_public := false;
  elsif new.path <> old.path or new.uploaded_by <> old.uploaded_by or new.is_public <> old.is_public
     or new.mime_type <> old.mime_type or new.width <> old.width or new.height <> old.height
     or new.size_bytes <> old.size_bytes then
    raise exception 'only descriptive media fields can change' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger media_guard before insert or update on public.media_assets
for each row execute function private.media_guard();

-- Audit triggers
create trigger audit_staff_profiles after insert or update or delete on public.staff_profiles
for each row execute function private.audit_row_change();
create trigger audit_staff_permissions after insert or delete on public.staff_permissions
for each row execute function private.audit_row_change();
create trigger audit_staff_invitations after insert or update on public.staff_invitations
for each row execute function private.audit_row_change();
create trigger audit_categories after insert or update or delete on public.categories
for each row execute function private.audit_row_change();
create trigger audit_site_settings after insert or update on public.site_settings
for each row execute function private.audit_row_change();
create trigger audit_homepage_slots after insert or update or delete on public.homepage_slots
for each row execute function private.audit_row_change();
create trigger audit_breaking_ticker after insert or update or delete on public.breaking_ticker
for each row execute function private.audit_row_change();
create trigger audit_media_assets after insert or delete on public.media_assets
for each row execute function private.audit_row_change();
create trigger audit_ad_inquiries after update or delete on public.ad_inquiries
for each row execute function private.audit_row_change();

-- What the signed-in user may do, for the dashboard. Permissions are listed
-- even before MFA so the UI can explain what is pending; the database itself
-- still requires aal2 (see private.staff_role).
create function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'userId', sp.user_id,
    'role', sp.role,
    'status', sp.status,
    'displayName', sp.display_name,
    'email', sp.email,
    'mfaRequired', not (sp.role = 'journalist'
      and not exists (select 1 from public.staff_permissions p where p.user_id = sp.user_id)),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'permissions', to_jsonb(private.effective_permissions(sp.user_id))
  )
  from public.staff_profiles sp
  where sp.user_id = auth.uid()
$$;
