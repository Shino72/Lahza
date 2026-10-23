-- Core schema for Lahza: staff, permissions, content, media, site settings,
-- advertising inquiries and the audit trail.

create extension if not exists pg_trgm with schema extensions;

create type public.app_role as enum ('owner', 'manager', 'editor', 'journalist');
create type public.staff_status as enum ('invited', 'active', 'suspended');
create type public.article_status as enum ('draft', 'in_review', 'approved', 'published', 'archived');
create type public.inquiry_status as enum ('new', 'in_progress', 'closed', 'spam');

-- ---------------------------------------------------------------------------
-- Staff and permissions
-- ---------------------------------------------------------------------------

create table public.permissions (
  key text primary key,
  description text not null
);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

create table public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete restrict,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  role public.app_role not null,
  status public.staff_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one Owner can ever exist (including an Owner whose invitation is pending).
create unique index staff_profiles_single_owner on public.staff_profiles ((true)) where role = 'owner';
create unique index staff_profiles_email on public.staff_profiles (lower(email));

create table public.staff_permissions (
  user_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  granted_by uuid references public.staff_profiles (user_id),
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  display_name text not null check (char_length(display_name) between 1 and 120),
  role public.app_role not null,
  permissions text[] not null default '{}',
  invited_by uuid references public.staff_profiles (user_id),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index staff_invitations_user on public.staff_invitations (user_id);

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name_ar text not null check (char_length(name_ar) between 1 and 60),
  name_en text not null check (char_length(name_en) between 1 and 60),
  description_ar text not null default '' check (char_length(description_ar) <= 300),
  description_en text not null default '' check (char_length(description_en) <= 300),
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/webp', 'image/png')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  size_bytes integer not null check (size_bytes > 0),
  alt_ar text not null default '' check (char_length(alt_ar) <= 300),
  alt_en text not null default '' check (char_length(alt_en) <= 300),
  caption_ar text not null default '' check (char_length(caption_ar) <= 300),
  caption_en text not null default '' check (char_length(caption_en) <= 300),
  -- True while at least one published article uses the image; only then is a copy
  -- present in the public bucket.
  is_public boolean not null default false,
  uploaded_by uuid not null default auth.uid() references public.staff_profiles (user_id),
  created_at timestamptz not null default now()
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('ar', 'en')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  status public.article_status not null default 'draft',
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  subtitle text not null default '' check (char_length(subtitle) <= 300),
  summary text not null default '' check (char_length(summary) <= 500),
  body jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array'),
  byline text not null check (char_length(byline) between 1 and 120),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  cover_media_id uuid references public.media_assets (id) on delete set null,
  translation_group uuid,
  seo_title text not null default '' check (char_length(seo_title) <= 120),
  seo_description text not null default '' check (char_length(seo_description) <= 300),
  publish_at timestamptz,
  first_published_at timestamptz,
  author_id uuid not null default auth.uid() references public.staff_profiles (user_id),
  created_by uuid default auth.uid() references public.staff_profiles (user_id),
  updated_by uuid references public.staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text not null default '',
  unique (lang, slug),
  check (status <> 'published' or publish_at is not null)
);

create unique index articles_translation_lang on public.articles (translation_group, lang) where translation_group is not null;
create index articles_public_listing on public.articles (lang, publish_at desc) where status = 'published';
create index articles_category_listing on public.articles (category_id, lang, publish_at desc) where status = 'published';
create index articles_author on public.articles (author_id);
create index articles_search_trgm on public.articles using gin (search_text extensions.gin_trgm_ops);

create table public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  status public.article_status not null,
  snapshot jsonb not null,
  edited_by uuid references public.staff_profiles (user_id),
  created_at timestamptz not null default now()
);

create index article_revisions_article on public.article_revisions (article_id, created_at desc);

-- Slugs of articles that were archived or deleted after being public, so the
-- site can answer 410 Gone instead of 404.
create table public.article_tombstones (
  lang text not null,
  slug text not null,
  removed_at timestamptz not null default now(),
  primary key (lang, slug)
);

create table public.homepage_slots (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('ar', 'en')),
  article_id uuid not null unique references public.articles (id) on delete cascade,
  position integer not null check (position between 1 and 20),
  unique (lang, position)
);

create table public.breaking_ticker (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('ar', 'en')),
  text text not null check (char_length(text) between 1 and 200),
  article_id uuid references public.articles (id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid default auth.uid() references public.staff_profiles (user_id),
  created_at timestamptz not null default now()
);

-- Non-secret, publicly displayed settings only (contact details, leadership, page copy).
create table public.site_settings (
  key text primary key check (key in ('contact', 'leadership', 'advertise', 'tagline')),
  value jsonb not null,
  updated_by uuid references public.staff_profiles (user_id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Advertising inquiries, rate limiting and audit
-- ---------------------------------------------------------------------------

create table public.ad_inquiries (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 1 and 120),
  contact_person text not null check (char_length(contact_person) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) <= 20),
  ad_type text not null check (ad_type in ('banner', 'sponsored', 'campaign', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  lang text not null check (lang in ('ar', 'en')),
  status public.inquiry_status not null default 'new',
  notes text not null default '' check (char_length(notes) <= 2000),
  handled_by uuid references public.staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ad_inquiries_created on public.ad_inquiries (created_at desc);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_created on public.audit_events (created_at desc);
