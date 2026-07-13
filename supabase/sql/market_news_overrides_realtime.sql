-- Push admin override changes to open app sessions via Supabase Realtime.

ALTER TABLE public.market_news_overrides REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_news_overrides;

DROP POLICY IF EXISTS "Authenticated users can read market news overrides"
  ON public.market_news_overrides;

CREATE POLICY "Authenticated users can read market news overrides"
  ON public.market_news_overrides
  FOR SELECT
  TO authenticated
  USING (true);
