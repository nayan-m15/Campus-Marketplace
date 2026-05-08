create table if not exists public.price_suggestion_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  listing_id text,
  request jsonb not null default '{}'::jsonb,
  response jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists price_suggestion_cache_listing_id_idx
  on public.price_suggestion_cache (listing_id);

alter table public.price_suggestion_cache enable row level security;

drop policy if exists "Authenticated users can read price suggestion cache"
  on public.price_suggestion_cache;

create policy "Authenticated users can read price suggestion cache"
  on public.price_suggestion_cache
  for select
  to authenticated
  using (true);
