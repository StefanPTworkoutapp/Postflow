-- ============================================================
-- Template Health Engine (Part 9)
-- ============================================================
-- Creates tables for tracking template performance health,
-- generating improvement suggestions, and niche benchmarks.
-- Also extends post_analytics with new analytics columns.
--
-- Fully idempotent. Safe to re-run.

SET search_path = postflow, public;

-- ── Template health: per-brand-per-template health tracking ──────────────────

CREATE TABLE IF NOT EXISTS postflow.template_health (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  platform            TEXT        NOT NULL,
  template_slug       TEXT        NOT NULL,
  health_score        INTEGER     NOT NULL DEFAULT 50
    CHECK (health_score BETWEEN 0 AND 100),
  posts_count         INTEGER     NOT NULL DEFAULT 0,
  avg_completion_rate FLOAT,
  avg_save_rate       FLOAT,
  avg_engagement_rate FLOAT,
  -- 'insufficient_data' | 'rising' | 'stable' | 'declining'
  trend               TEXT        NOT NULL DEFAULT 'insufficient_data',
  last_checked_at     TIMESTAMPTZ,
  next_check_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- User can lock a template to prevent auto-replacement suggestions
  locked_by_user      BOOLEAN     NOT NULL DEFAULT FALSE,
  -- 'performance_guided' | 'locked' | 'manual'
  mode                TEXT        NOT NULL DEFAULT 'performance_guided',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, platform, template_slug)
);

-- ── Template suggestions: improvement prompts ─────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.template_suggestions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  current_slug       TEXT        NOT NULL,
  suggested_slug     TEXT        NOT NULL,
  platform           TEXT        NOT NULL,
  reason             TEXT        NOT NULL,
  current_score      INTEGER,
  suggested_score    INTEGER,
  preview_render_url TEXT,
  -- 'pending' | 'approved' | 'dismissed'
  status             TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','dismissed')),
  dismissed_count    INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at       TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ
);

-- ── Niche benchmarks: anonymised cross-brand aggregates ─────────────────────

CREATE TABLE IF NOT EXISTS postflow.niche_benchmarks (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_tag                       TEXT        NOT NULL,
  platform                        TEXT        NOT NULL,
  avg_completion_rate             FLOAT,
  avg_save_rate                   FLOAT,
  avg_engagement_rate             FLOAT,
  top_template_slugs              TEXT[],
  sample_size                     INTEGER     NOT NULL DEFAULT 0,
  -- Carousel-specific benchmarks
  avg_carousel_swipe_through_rate FLOAT,
  avg_carousel_save_rate          FLOAT,
  avg_carousel_slide_count        FLOAT,
  top_carousel_content_mix        TEXT,
  calculated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(niche_tag, platform)
);

-- ── Extend post_analytics with new analytics columns (Phase 2) ───────────────

ALTER TABLE postflow.post_analytics
  ADD COLUMN IF NOT EXISTS completion_rate       FLOAT,
  ADD COLUMN IF NOT EXISTS swipe_through_rate    FLOAT,
  ADD COLUMN IF NOT EXISTS brand_tokens_snapshot JSONB;

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS template_health_brand_idx
  ON postflow.template_health (brand_id, next_check_at);

CREATE INDEX IF NOT EXISTS template_health_next_check_idx
  ON postflow.template_health (next_check_at)
  WHERE locked_by_user = FALSE;

CREATE INDEX IF NOT EXISTS template_suggestions_brand_pending_idx
  ON postflow.template_suggestions (brand_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS niche_benchmarks_niche_platform_idx
  ON postflow.niche_benchmarks (niche_tag, platform);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE postflow.template_health       ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.template_suggestions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.niche_benchmarks      ENABLE ROW LEVEL SECURITY;

-- Users can read their own template health + suggestions
DROP POLICY IF EXISTS "template_health_brand_owner" ON postflow.template_health;
CREATE POLICY "template_health_brand_owner" ON postflow.template_health
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );

DROP POLICY IF EXISTS "template_suggestions_brand_owner" ON postflow.template_suggestions;
CREATE POLICY "template_suggestions_brand_owner" ON postflow.template_suggestions
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );

-- Niche benchmarks are read-only for all authenticated users (anonymised aggregate)
DROP POLICY IF EXISTS "niche_benchmarks_read_all" ON postflow.niche_benchmarks;
CREATE POLICY "niche_benchmarks_read_all" ON postflow.niche_benchmarks
  FOR SELECT USING (auth.role() = 'authenticated');
