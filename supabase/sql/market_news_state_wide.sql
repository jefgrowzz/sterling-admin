-- News of the day is keyed by US state (one story per state per UTC day), not city.
-- Self-contained: creates any missing market_news_* tables before migrating.

-- ---------------------------------------------------------------------------
-- Ensure prerequisite tables exist
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.market_news_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text,
  state text,
  city_norm text GENERATED ALWAYS AS (lower(btrim(COALESCE(city, '')))) STORED,
  state_norm text GENERATED ALWAYS AS (lower(COALESCE(nullif(btrim(state), ''), ''))) STORED,
  last_requested_at timestamptz NOT NULL DEFAULT now(),
  request_count bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_news_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_utc date NOT NULL,
  city text,
  state text,
  article_id text,
  article_url text NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  source text NOT NULL DEFAULT 'News',
  image_url text,
  published_at timestamptz,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  city_norm text GENERATED ALWAYS AS (lower(btrim(COALESCE(city, '')))) STORED,
  state_norm text GENERATED ALWAYS AS (lower(COALESCE(nullif(btrim(state), ''), ''))) STORED
);

CREATE TABLE IF NOT EXISTS public.market_news_daily_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_utc date NOT NULL,
  city text,
  state text,
  city_norm text GENERATED ALWAYS AS (lower(btrim(COALESCE(city, '')))) STORED,
  state_norm text GENERATED ALWAYS AS (lower(COALESCE(nullif(btrim(state), ''), ''))) STORED,
  article_id text,
  article_url text NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  source text NOT NULL DEFAULT 'News',
  image_url text,
  published_at timestamptz,
  selection_source text NOT NULL DEFAULT 'auto' CHECK (selection_source IN ('auto', 'override')),
  locked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text,
  state text,
  city_norm text GENERATED ALWAYS AS (lower(btrim(COALESCE(city, '')))) STORED,
  state_norm text GENERATED ALWAYS AS (lower(COALESCE(nullif(btrim(state), ''), ''))) STORED,
  article_id text,
  article_url text NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  source text NOT NULL DEFAULT 'News',
  image_url text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_news_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_news_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_news_daily_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_news_articles ENABLE ROW LEVEL SECURITY;

-- Relax NOT NULL on city where tables pre-existed with that constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_news_requests'
      AND column_name = 'city' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.market_news_requests ALTER COLUMN city DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_news_overrides'
      AND column_name = 'city' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.market_news_overrides ALTER COLUMN city DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_news_daily_selections'
      AND column_name = 'city' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.market_news_daily_selections ALTER COLUMN city DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_news_articles'
      AND column_name = 'city' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.market_news_articles ALTER COLUMN city DROP NOT NULL;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Dedupe existing rows down to one row per state
-- ---------------------------------------------------------------------------

WITH merged AS (
  SELECT
    state_norm,
    MAX(last_requested_at) AS last_requested_at,
    SUM(request_count)::bigint AS request_count,
    (ARRAY_AGG(state ORDER BY last_requested_at DESC))[1] AS state,
    (ARRAY_AGG(city ORDER BY last_requested_at DESC))[1] AS city
  FROM public.market_news_requests
  WHERE COALESCE(state_norm, '') <> ''
  GROUP BY state_norm
),
keepers AS (
  SELECT DISTINCT ON (r.state_norm) r.id
  FROM public.market_news_requests r
  INNER JOIN merged m ON m.state_norm = r.state_norm
  ORDER BY r.state_norm, r.last_requested_at DESC
)
UPDATE public.market_news_requests r
SET
  request_count = m.request_count,
  last_requested_at = m.last_requested_at,
  state = m.state,
  city = m.city
FROM merged m
WHERE r.state_norm = m.state_norm
  AND r.id IN (SELECT id FROM keepers);

DELETE FROM public.market_news_requests r
WHERE COALESCE(r.state_norm, '') <> ''
  AND r.id NOT IN (
    SELECT DISTINCT ON (state_norm) id
    FROM public.market_news_requests
    WHERE COALESCE(state_norm, '') <> ''
    ORDER BY state_norm, last_requested_at DESC
  );

DELETE FROM public.market_news_overrides a
USING public.market_news_overrides b
WHERE a.date_utc = b.date_utc
  AND COALESCE(a.state_norm, '') = COALESCE(b.state_norm, '')
  AND COALESCE(a.state_norm, '') <> ''
  AND a.updated_at < b.updated_at;

DELETE FROM public.market_news_daily_selections a
USING public.market_news_daily_selections b
WHERE a.date_utc = b.date_utc
  AND COALESCE(a.state_norm, '') = COALESCE(b.state_norm, '')
  AND COALESCE(a.state_norm, '') <> ''
  AND a.locked_at < b.locked_at;

DELETE FROM public.market_news_articles a
USING public.market_news_articles b
WHERE COALESCE(a.state_norm, '') = COALESCE(b.state_norm, '')
  AND a.article_url = b.article_url
  AND COALESCE(a.state_norm, '') <> ''
  AND a.fetched_at < b.fetched_at;

DELETE FROM public.market_news_requests WHERE COALESCE(state_norm, '') = '';
DELETE FROM public.market_news_overrides WHERE COALESCE(state_norm, '') = '';
DELETE FROM public.market_news_daily_selections WHERE COALESCE(state_norm, '') = '';
DELETE FROM public.market_news_articles WHERE COALESCE(state_norm, '') = '';

-- ---------------------------------------------------------------------------
-- Indexes: state-only uniqueness
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.market_news_requests_unique_location;
CREATE UNIQUE INDEX IF NOT EXISTS market_news_requests_unique_state
  ON public.market_news_requests (state_norm);

DROP INDEX IF EXISTS public.market_news_overrides_unique_day_location;
CREATE UNIQUE INDEX IF NOT EXISTS market_news_overrides_unique_day_state
  ON public.market_news_overrides (date_utc, state_norm);

DROP INDEX IF EXISTS public.market_news_daily_selections_unique_day_location;
CREATE UNIQUE INDEX IF NOT EXISTS market_news_daily_selections_unique_day_state
  ON public.market_news_daily_selections (date_utc, state_norm);

DROP INDEX IF EXISTS public.market_news_articles_unique_location_url;
CREATE UNIQUE INDEX IF NOT EXISTS market_news_articles_unique_state_url
  ON public.market_news_articles (state_norm, article_url);

CREATE INDEX IF NOT EXISTS market_news_daily_selections_lookup_idx
  ON public.market_news_daily_selections (date_utc, state_norm, locked_at DESC);

CREATE INDEX IF NOT EXISTS market_news_articles_lookup_idx
  ON public.market_news_articles (state_norm, published_at DESC);

-- ---------------------------------------------------------------------------
-- Article pool maintenance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.market_news_articles_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT interval '5 days';
$$;

CREATE OR REPLACE FUNCTION public.cleanup_market_news_articles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.market_news_articles
  WHERE fetched_at < now() - public.market_news_articles_retention();
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_market_news_articles() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'market-news-articles-cleanup-daily') THEN
    PERFORM cron.unschedule('market-news-articles-cleanup-daily');
  END IF;
END;
$$;

SELECT cron.schedule(
  'market-news-articles-cleanup-daily',
  '0 3 * * *',
  $$SELECT public.cleanup_market_news_articles();$$
);

-- ---------------------------------------------------------------------------
-- RPCs: state is the market key; city is optional metadata only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_market_news_request(
  p_city text,
  p_state text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text := nullif(btrim(p_state), '');
  v_city text := nullif(btrim(p_city), '');
BEGIN
  IF v_state IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.market_news_requests (city, state)
  VALUES (v_city, v_state)
  ON CONFLICT (state_norm)
  DO UPDATE SET
    city = COALESCE(EXCLUDED.city, public.market_news_requests.city),
    state = EXCLUDED.state,
    last_requested_at = now(),
    request_count = public.market_news_requests.request_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.log_market_news_request(text, text) FROM PUBLIC, anon;

-- Admin / PostgREST signature: (p_city, p_date_utc, p_state)
CREATE OR REPLACE FUNCTION public.get_market_news_override(
  p_city text,
  p_date_utc date,
  p_state text DEFAULT NULL
)
RETURNS TABLE (
  article_id text,
  article_url text,
  title text,
  description text,
  content text,
  source text,
  image_url text,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_market_news_request(p_city, p_state);

  RETURN QUERY
  SELECT
    o.article_id,
    o.article_url,
    o.title,
    o.description,
    o.content,
    o.source,
    o.image_url,
    o.published_at
  FROM public.market_news_overrides o
  WHERE o.date_utc = p_date_utc
    AND COALESCE(o.state_norm, '') = lower(COALESCE(nullif(btrim(p_state), ''), ''))
  ORDER BY o.updated_at DESC
  LIMIT 1;
END;
$$;

-- App legacy signature: (p_city, p_state, p_date_utc)
CREATE OR REPLACE FUNCTION public.get_market_news_override(
  p_city text,
  p_state text DEFAULT NULL,
  p_date_utc date DEFAULT (now() AT TIME ZONE 'utc')::date
)
RETURNS TABLE (
  article_id text,
  article_url text,
  title text,
  description text,
  content text,
  source text,
  image_url text,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.get_market_news_override(p_city, p_date_utc, p_state);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_market_news_daily_selection(
  p_city text,
  p_date_utc date,
  p_state text DEFAULT NULL
)
RETURNS TABLE (
  article_id text,
  article_url text,
  title text,
  description text,
  content text,
  source text,
  image_url text,
  published_at timestamptz,
  selection_source text,
  locked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.article_id,
    s.article_url,
    s.title,
    s.description,
    s.content,
    s.source,
    s.image_url,
    s.published_at,
    s.selection_source,
    s.locked_at
  FROM public.market_news_daily_selections s
  WHERE s.date_utc = p_date_utc
    AND COALESCE(s.state_norm, '') = lower(COALESCE(nullif(btrim(p_state), ''), ''))
  ORDER BY s.locked_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_market_news_daily_selection(
  p_city text,
  p_state text DEFAULT NULL,
  p_date_utc date DEFAULT (now() AT TIME ZONE 'utc')::date
)
RETURNS TABLE (
  article_id text,
  article_url text,
  title text,
  description text,
  content text,
  source text,
  image_url text,
  published_at timestamptz,
  selection_source text,
  locked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_market_news_daily_selection(p_city, p_date_utc, p_state);
$$;

CREATE OR REPLACE FUNCTION public.lock_market_news_daily_selection(
  p_city text,
  p_state text,
  p_date_utc date,
  p_article jsonb,
  p_selection_source text DEFAULT 'auto'
)
RETURNS TABLE (
  article_id text,
  article_url text,
  title text,
  description text,
  content text,
  source text,
  image_url text,
  published_at timestamptz,
  selection_source text,
  locked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text := nullif(btrim(p_state), '');
  v_city text := nullif(btrim(p_city), '');
  v_source text := COALESCE(nullif(btrim(p_selection_source), ''), 'auto');
BEGIN
  IF v_state IS NULL THEN
    RETURN;
  END IF;

  IF v_source NOT IN ('auto', 'override') THEN
    v_source := 'auto';
  END IF;

  INSERT INTO public.market_news_daily_selections (
    date_utc,
    city,
    state,
    article_id,
    article_url,
    title,
    description,
    content,
    source,
    image_url,
    published_at,
    selection_source
  )
  VALUES (
    p_date_utc,
    v_city,
    v_state,
    p_article->>'article_id',
    p_article->>'article_url',
    p_article->>'title',
    p_article->>'description',
    p_article->>'content',
    COALESCE(p_article->>'source', 'News'),
    p_article->>'image_url',
    NULLIF(p_article->>'published_at', '')::timestamptz,
    v_source
  )
  ON CONFLICT (date_utc, state_norm)
  DO NOTHING;

  RETURN QUERY
  SELECT
    s.article_id,
    s.article_url,
    s.title,
    s.description,
    s.content,
    s.source,
    s.image_url,
    s.published_at,
    s.selection_source,
    s.locked_at
  FROM public.market_news_daily_selections s
  WHERE s.date_utc = p_date_utc
    AND COALESCE(s.state_norm, '') = lower(v_state)
  ORDER BY s.locked_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_market_news_articles(
  p_city text,
  p_state text,
  p_articles jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text := nullif(btrim(p_state), '');
  v_city text := nullif(btrim(p_city), '');
BEGIN
  IF v_state IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.market_news_articles (
    city, state, article_id, article_url, title, description, content, source, image_url, published_at
  )
  SELECT
    v_city,
    v_state,
    a->>'article_id',
    a->>'article_url',
    a->>'title',
    a->>'description',
    a->>'content',
    COALESCE(a->>'source', 'News'),
    a->>'image_url',
    NULLIF(a->>'published_at', '')::timestamptz
  FROM jsonb_array_elements(p_articles) AS a
  WHERE (a->>'article_url') IS NOT NULL AND (a->>'title') IS NOT NULL
  ON CONFLICT (state_norm, article_url)
  DO UPDATE SET fetched_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_market_news_override(text, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_market_news_override(text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_market_news_daily_selection(text, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_market_news_daily_selection(text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lock_market_news_daily_selection(text, text, date, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_market_news_articles(text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_market_news_override(text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_news_override(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_news_daily_selection(text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_news_daily_selection(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_market_news_daily_selection(text, text, date, jsonb, text) TO authenticated;
