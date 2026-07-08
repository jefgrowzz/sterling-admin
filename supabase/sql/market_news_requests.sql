-- Adds request tracking so the News tab (app/dashboard/news/) can list markets
-- from real mobile-app traffic instead of requiring admins to add them manually.
--
-- public.get_market_news_override has two overloads (different argument order,
-- both already deployed and called by the mobile app — see the pg_get_functiondef
-- output this migration is based on). Both are re-created here with an added
-- upsert into market_news_requests before the existing SELECT. The SELECT body,
-- return type, and argument signatures are unchanged — this is a pure addition.
--
-- Run this once in the Supabase SQL editor for the project this dashboard and the
-- mobile app share.

create table if not exists market_news_requests (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text,
  city_norm text generated always as (lower(btrim(city))) stored,
  state_norm text generated always as (lower(coalesce(nullif(btrim(state), ''), ''))) stored,
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  request_count bigint not null default 1
);

create unique index if not exists market_news_requests_key_idx
  on market_news_requests (city_norm, state_norm);

alter table market_news_requests enable row level security;
-- No policies added: only the SECURITY DEFINER RPC below and the dashboard's
-- service-role client touch this table, both of which bypass RLS.

-- Overload 1: get_market_news_override(p_city, p_state, p_date_utc)
create or replace function public.get_market_news_override(
  p_city text,
  p_state text default null::text,
  p_date_utc date default ((now() at time zone 'utc'::text))::date
)
returns table(article_id text, article_url text, title text, description text, content text, source text, image_url text, published_at timestamp with time zone)
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.market_news_requests (city, state)
  values (btrim(p_city), nullif(btrim(p_state), ''))
  on conflict (city_norm, state_norm)
  do update set
    last_requested_at = now(),
    request_count = market_news_requests.request_count + 1,
    city = excluded.city,
    state = excluded.state;

  select
    o.article_id,
    o.article_url,
    o.title,
    o.description,
    o.content,
    o.source,
    o.image_url,
    o.published_at
  from public.market_news_overrides o
  where o.date_utc = p_date_utc
    and o.city_norm = lower(btrim(p_city))
    and coalesce(o.state_norm, '') = lower(coalesce(nullif(btrim(p_state), ''), ''))
  order by o.updated_at desc
  limit 1;
$function$;

-- Overload 2: get_market_news_override(p_city, p_date_utc, p_state) — same body.
create or replace function public.get_market_news_override(
  p_city text,
  p_date_utc date,
  p_state text default null::text
)
returns table(article_id text, article_url text, title text, description text, content text, source text, image_url text, published_at timestamp with time zone)
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.market_news_requests (city, state)
  values (btrim(p_city), nullif(btrim(p_state), ''))
  on conflict (city_norm, state_norm)
  do update set
    last_requested_at = now(),
    request_count = market_news_requests.request_count + 1,
    city = excluded.city,
    state = excluded.state;

  select
    o.article_id,
    o.article_url,
    o.title,
    o.description,
    o.content,
    o.source,
    o.image_url,
    o.published_at
  from public.market_news_overrides o
  where o.date_utc = p_date_utc
    and o.city_norm = lower(btrim(p_city))
    and coalesce(o.state_norm, '') = lower(coalesce(nullif(btrim(p_state), ''), ''))
  order by o.updated_at desc
  limit 1;
$function$;
