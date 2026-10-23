-- Guards against accidental loss of published content and media.

-- Articles can be permanently deleted only as drafts or after being archived;
-- anything that was published must be archived first (which keeps a 410 page).
drop policy "permitted staff delete articles" on public.articles;
create policy "permitted staff delete articles" on public.articles for delete to authenticated
  using (private.has_perm('article.delete') and status in ('draft', 'archived'));

-- Images still used by any article (as cover or inside the text) cannot be deleted.
create function private.media_in_use_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.articles a
    where a.cover_media_id = old.id
       or a.body @> jsonb_build_array(jsonb_build_object('mediaId', old.id::text))
  ) then
    raise exception 'image is used by an article' using errcode = '23503';
  end if;
  return old;
end
$$;

create trigger media_in_use_guard
before delete on public.media_assets
for each row execute function private.media_in_use_guard();
