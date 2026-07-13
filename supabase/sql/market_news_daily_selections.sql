-- Locks the first auto-selected story per market per UTC day so it does not
-- change when the candidate pool grows. Admin reads this table for parity
-- with what the mobile app actually serves.

CREATE TABLE IF NOT EXISTS public.market_news_daily_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_utc date NOT NULL,
  city text NOT NULL,
  state text,
  city_norm text GENERATED ALWAYS AS (lower(btrim(city))) STORED,
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

CREATE UNIQUE INDEX IF NOT EXISTS market_news_daily_selections_unique_day_location
  ON public.market_news_daily_selections (date_utc, city_norm, state_norm);

CREATE INDEX IF NOT EXISTS market_news_daily_selections_lookup_idx
  ON public.market_news_daily_selections (date_utc, city_norm, state_norm, locked_at DESC);

ALTER TABLE public.market_news_daily_selections ENABLE ROW LEVEL SECURITY;

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
    AND s.city_norm = lower(btrim(p_city))
    AND COALESCE(s.state_norm, '') = lower(COALESCE(nullif(btrim(p_state), ''), ''))
  ORDER BY s.locked_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_market_news_daily_selection(text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_market_news_daily_selection(text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_market_news_daily_selection(text, text, date) TO authenticated;

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
    AND s.city_norm = lower(btrim(p_city))
    AND COALESCE(s.state_norm, '') = lower(COALESCE(nullif(btrim(p_state), ''), ''))
  ORDER BY s.locked_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_market_news_daily_selection(text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_market_news_daily_selection(text, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_market_news_daily_selection(text, date, text) TO authenticated;

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
  v_city text := btrim(p_city);
  v_state text := nullif(btrim(p_state), '');
  v_source text := COALESCE(nullif(btrim(p_selection_source), ''), 'auto');
BEGIN
  IF v_city = '' THEN
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
  ON CONFLICT (date_utc, city_norm, state_norm) DO NOTHING;

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
    AND s.city_norm = lower(v_city)
    AND COALESCE(s.state_norm, '') = lower(COALESCE(v_state, ''))
  ORDER BY s.locked_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_market_news_daily_selection(text, text, date, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lock_market_news_daily_selection(text, text, date, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lock_market_news_daily_selection(text, text, date, jsonb, text) TO authenticated;
