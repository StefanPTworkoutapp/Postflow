-- ============================================================
-- Analytics & Niche Research Reliability Tables (Part 8B)
-- ============================================================
-- Creates infrastructure for the five guarantees:
--   G1 — sync_runs + analytics_sync_errors   (analytics job audit trail)
--   G2 — analytics_processed                 (proof tokens were updated)
--   G3 — research_runs                        (niche research audit trail)
--   G8C — inspiration_posts                   (inspiration link feature)
--   Storage buckets for clips + renders
--
-- Fully idempotent. Safe to re-run.

SET search_path = postflow, public;

-- ── G1: Analytics sync job audit trail ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.sync_runs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform             TEXT        NOT NULL,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at             TIMESTAMPTZ,
  user_count_attempted INTEGER     NOT NULL DEFAULT 0,
  success_count        INTEGER     NOT NULL DEFAULT 0,
  error_count          INTEGER     NOT NULL DEFAULT 0,
  -- 'running' | 'clean' | 'partial' | 'failed'
  status               TEXT        NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','clean','partial','failed'))
);

CREATE TABLE IF NOT EXISTS postflow.analytics_sync_errors (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID        REFERENCES postflow.brands(id) ON DELETE CASCADE,
  platform     TEXT,
  error_type   TEXT,
  error_detail JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── G2: Proof that analytics updated tokens ──────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.analytics_processed (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  post_id         TEXT        NOT NULL,
  platform        TEXT        NOT NULL,
  signals_applied INTEGER     NOT NULL DEFAULT 0,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── G3: Niche research job audit trail ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.research_runs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  niche         TEXT        NOT NULL,
  platform      TEXT        NOT NULL,
  signals_found INTEGER     NOT NULL DEFAULT 0,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Part 8C: Inspiration posts ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.inspiration_posts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  source_url    TEXT        NOT NULL,
  -- 'instagram' | 'tiktok' — detected from URL
  platform      TEXT,
  -- Full Supadata + Claude analysis result
  analysis      JSONB       NOT NULL,
  -- Token signals that would be / were applied
  token_signals JSONB,
  -- NULL = not yet applied; set when user clicks [Apply to my brand]
  applied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS analytics_processed_brand_idx
  ON postflow.analytics_processed (brand_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS analytics_processed_post_idx
  ON postflow.analytics_processed (post_id);

CREATE INDEX IF NOT EXISTS analytics_sync_errors_brand_idx
  ON postflow.analytics_sync_errors (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sync_runs_platform_idx
  ON postflow.sync_runs (platform, started_at DESC);

CREATE INDEX IF NOT EXISTS research_runs_niche_platform_idx
  ON postflow.research_runs (niche, platform, ran_at DESC);

CREATE INDEX IF NOT EXISTS inspiration_posts_brand_idx
  ON postflow.inspiration_posts (brand_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE postflow.sync_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.analytics_sync_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.analytics_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.research_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.inspiration_posts   ENABLE ROW LEVEL SECURITY;

-- Service-role bypass (Inngest jobs use service key — no RLS restrictions needed)
-- Users can read their own analytics_processed + inspiration_posts records

DROP POLICY IF EXISTS "analytics_processed_brand_owner" ON postflow.analytics_processed;
CREATE POLICY "analytics_processed_brand_owner" ON postflow.analytics_processed
  FOR SELECT USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );

DROP POLICY IF EXISTS "inspiration_posts_brand_owner" ON postflow.inspiration_posts;
CREATE POLICY "inspiration_posts_brand_owner" ON postflow.inspiration_posts
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );

-- ── Storage buckets for clip-forge + renders ─────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('postflow-clips',   'postflow-clips',   false, 524288000),  -- 500 MB, private
  ('postflow-renders', 'postflow-renders', true,  104857600)   -- 100 MB, public
ON CONFLICT (id) DO NOTHING;
