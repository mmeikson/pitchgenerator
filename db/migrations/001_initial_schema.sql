-- Avolor — Initial Schema
-- Run in Supabase SQL Editor

-- ============================================================
-- PROFILES
-- Extends auth.users. Auto-created on signup via trigger.
-- ============================================================
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- SELLER PROFILES
-- ============================================================
create table public.seller_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.profiles(id) on delete cascade,
  website_url   text not null,
  company_name  text not null default '',
  tagline       text not null default '',
  services      jsonb not null default '[]',
  proof_points  jsonb not null default '[]',
  testimonials  jsonb not null default '[]',
  client_logos  jsonb not null default '[]',
  logo_url      text,
  logo_file_key text,
  brand_colors  jsonb not null default '{"background":"#ffffff","primary":"#111111","accent":"#0066ff","text":"#111111"}',
  fonts         jsonb not null default '{"display":"Plus Jakarta Sans","body":"Lora"}',
  raw_scrape    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.seller_profiles enable row level security;

create policy "Users can manage own seller profile"
  on public.seller_profiles for all
  using (auth.uid() = user_id);

-- ============================================================
-- PITCHES
-- ============================================================
create type public.pitch_status as enum ('queued', 'scraping', 'generating', 'rendering', 'ready', 'failed');

create table public.pitches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  prospect_url      text not null,
  prospect_domain   text not null,
  calendar_url      text not null,
  status            public.pitch_status not null default 'queued',
  slug              text unique,
  prospect_data     jsonb,
  content           jsonb,
  view_count        integer not null default 0,
  first_viewed_at   timestamptz,
  last_viewed_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (user_id, prospect_domain)
);

alter table public.pitches enable row level security;

create policy "Users can manage own pitches"
  on public.pitches for all
  using (auth.uid() = user_id);

-- ============================================================
-- TRACKING EVENTS
-- ============================================================
create type public.tracking_event_type as enum ('view', 'cta_click');

create table public.tracking_events (
  id               uuid primary key default gen_random_uuid(),
  pitch_id         uuid not null references public.pitches(id) on delete cascade,
  event_type       public.tracking_event_type not null,
  ip_address       text,
  user_agent       text,
  duration_seconds integer,
  created_at       timestamptz not null default now()
);

alter table public.tracking_events enable row level security;

-- Tracking events are written via service role (unauthenticated endpoint)
-- Owners can read their pitch events
create policy "Users can read events for own pitches"
  on public.tracking_events for select
  using (
    exists (
      select 1 from public.pitches
      where pitches.id = tracking_events.pitch_id
        and pitches.user_id = auth.uid()
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_seller_profiles_updated_at
  before update on public.seller_profiles
  for each row execute procedure public.set_updated_at();

create trigger set_pitches_updated_at
  before update on public.pitches
  for each row execute procedure public.set_updated_at();
