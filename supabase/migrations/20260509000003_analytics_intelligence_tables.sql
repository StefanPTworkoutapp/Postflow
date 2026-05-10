-- Analytics intelligence tables for Week 5
-- Two new tables: niche_trends + performance_patterns

-- ── niche_trends ─────────────────────────────────────────────────────────────
-- Stores weekly trending topics fetched from Google Trends and News API.
-- One row per topic per source per week per brand.
-- Populated by a Sunday 22:00 UTC Inngest cron job.

CREATE TABLE IF NOT EXISTS postflow.niche_trends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK (source IN ('google_trends', 'news_api', 'reddit')),
  topic         TEXT NOT NULL,
  headline      TEXT,            -- for news_api: article headline
  url           TEXT,            -- for news_api: article URL
  relevance_score NUMERIC(5,2),  -- 0–100 relevance vs brand niche
  week_of       DATE NOT NULL,   -- Monday of the week (truncated)
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX niche_trends_brand_week_idx ON postflow.niche_trends(brand_id, week_of DESC);
CREATE INDEX niche_trends_source_idx     ON postflow.niche_trends(source);

ALTER TABLE postflow.niche_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owner reads own niche_trends"
  ON postflow.niche_trends FOR SELECT
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.jwt() ->> 'email')
    )
  );

-- Service role inserts (Inngest jobs run with service key)
CREATE POLICY "Service role manages niche_trends"
  ON postflow.niche_trends FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ── performance_patterns ─────────────────────────────────────────────────────
-- Aggregated performance insights derived from 90-day rolling post_analytics.
-- One row per brand+platform combination, recomputed weekly.
-- Used to enrich Claude caption generation with "what works" for this brand.

CREATE TABLE IF NOT EXISTS postflow.performance_patterns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              UUID NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  platform              TEXT NOT NULL,
  period_days           INT NOT NULL DEFAULT 90,
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  sample_size           INT NOT NULL DEFAULT 0,   -- number of posts analysed

  -- Timing patterns
  best_days_of_week     INT[],     -- 0=Sun … 6=Sat, ordered by avg engagement
  best_hours_of_day     INT[],     -- 0–23, ordered by avg engagement

  -- Content patterns
  best_content_pillars  TEXT[],    -- ordered by avg engagement_rate
  best_post_types       TEXT[],    -- ordered by avg engagement_rate
  top_hashtags          TEXT[],    -- top 10 by frequency in high-performing posts

  -- Averages
  avg_engagement_rate   NUMERIC(6,4),
  avg_impressions       NUMERIC(10,2),
  avg_reach             NUMERIC(10,2),

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(brand_id, platform)  -- upsert on this pair
);

CREATE INDEX perf_patterns_brand_idx ON postflow.performance_patterns(brand_id);

ALTER TABLE postflow.performance_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owner reads own performance_patterns"
  ON postflow.performance_patterns FOR SELECT
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Service role manages performance_patterns"
  ON postflow.performance_patterns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
