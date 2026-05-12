-- ============================================================
-- Clip Forge (Smart Video Builder) + Trend Builder Tables
-- ============================================================
-- Part 5 (clip_forge_jobs, clip_forge_clips, clip_forge_feedback)
-- Part 6 (trend_builder_jobs, trend_concepts)
-- Extends niche_trends + post_analytics FK
--
-- Fully idempotent. Safe to re-run.

SET search_path = postflow, public;

-- ── Clip Forge ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.clip_forge_jobs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  -- 'pending' | 'uploading' | 'analysing' | 'rendering' | 'ready' | 'approved' | 'rejected' | 'failed'
  status                TEXT        NOT NULL DEFAULT 'pending',
  render_progress       INTEGER     NOT NULL DEFAULT 0 CHECK (render_progress BETWEEN 0 AND 100),
  goal                  TEXT        NOT NULL,
  platform              TEXT        NOT NULL,
  -- Array of clip metadata objects: { storage_path, duration_seconds, order }
  input_clips           JSONB       NOT NULL DEFAULT '[]',
  output_video_url      TEXT,
  output_caption        TEXT,
  output_hashtags       TEXT[],
  -- Snapshot of brand kit at render time (so review is accurate even if kit changes)
  brand_kit_snapshot    JSONB,
  brand_tokens_snapshot JSONB,
  shotstack_render_id   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at           TIMESTAMPTZ,
  rejected_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS postflow.clip_forge_clips (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL REFERENCES postflow.clip_forge_jobs(id) ON DELETE CASCADE,
  storage_path     TEXT        NOT NULL,
  public_url       TEXT,
  upload_status    TEXT        NOT NULL DEFAULT 'pending',
  duration_seconds FLOAT,
  quality_score    INTEGER,
  order_index      INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS postflow.clip_forge_feedback (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID        NOT NULL REFERENCES postflow.clip_forge_jobs(id) ON DELETE CASCADE,
  brand_id              UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  -- 'approve' | 'reject'
  rating                TEXT        NOT NULL CHECK (rating IN ('approve','reject')),
  -- Free-form feedback tags (from FeedbackRow component)
  tags                  TEXT[],
  -- Token state at time of feedback (for audit trail)
  brand_tokens_snapshot JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trend Builder ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.trend_builder_jobs (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                  UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  -- 'pending' | 'generating_concepts' | 'rendering' | 'ready' | 'approved' | 'rejected' | 'failed'
  status                    TEXT        NOT NULL DEFAULT 'pending',
  render_progress           INTEGER     NOT NULL DEFAULT 0 CHECK (render_progress BETWEEN 0 AND 100),
  selected_concept_id       UUID,       -- FK set after user picks a concept
  -- Version A (trend-first) and Version B (brand-first) render URLs
  version_a_url             TEXT,
  version_b_url             TEXT,
  version_a_tokens_snapshot JSONB,
  version_b_tokens_snapshot JSONB,
  -- 'a' | 'b' — set when user picks a version
  chosen_version            TEXT        CHECK (chosen_version IN ('a', 'b')),
  regenerated               BOOLEAN     NOT NULL DEFAULT FALSE,
  regenerate_nudge          TEXT,       -- user's nudge text for the one regeneration
  output_caption            TEXT,
  output_hashtags           TEXT[],
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at               TIMESTAMPTZ,
  rejected_at               TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS postflow.trend_concepts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES postflow.trend_builder_jobs(id) ON DELETE CASCADE,
  brand_id        UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  concept_index   INTEGER     NOT NULL DEFAULT 0,
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  platform        TEXT        NOT NULL,
  niche_trend_id  UUID        REFERENCES postflow.niche_trends(id),
  brand_fit_score FLOAT,
  format_spec     JSONB,      -- structure: goal, sections, timing, etc.
  selected        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Extend niche_trends with expiry + niche tags ─────────────────────────────

ALTER TABLE postflow.niche_trends
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS niche_tags  TEXT[];

-- ── Add clip_forge FK to post_analytics ──────────────────────────────────────
-- (clip_forge_jobs must be created before this FK is added)

ALTER TABLE postflow.post_analytics
  ADD COLUMN IF NOT EXISTS clip_forge_job_id UUID REFERENCES postflow.clip_forge_jobs(id);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS clip_forge_jobs_brand_idx
  ON postflow.clip_forge_jobs (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clip_forge_jobs_status_idx
  ON postflow.clip_forge_jobs (status)
  WHERE status IN ('pending','rendering');

CREATE INDEX IF NOT EXISTS clip_forge_clips_job_idx
  ON postflow.clip_forge_clips (job_id, order_index);

CREATE INDEX IF NOT EXISTS clip_forge_feedback_job_idx
  ON postflow.clip_forge_feedback (job_id);

CREATE INDEX IF NOT EXISTS trend_builder_jobs_brand_idx
  ON postflow.trend_builder_jobs (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS trend_concepts_job_idx
  ON postflow.trend_concepts (job_id, concept_index);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE postflow.clip_forge_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.clip_forge_clips     ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.clip_forge_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.trend_builder_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.trend_concepts       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clip_forge_jobs_brand_owner" ON postflow.clip_forge_jobs;
CREATE POLICY "clip_forge_jobs_brand_owner" ON postflow.clip_forge_jobs
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );

DROP POLICY IF EXISTS "clip_forge_clips_brand_owner" ON postflow.clip_forge_clips;
CREATE POLICY "clip_forge_clips_brand_owner" ON postflow.clip_forge_clips
  FOR ALL USING (
    job_id IN (
      SELECT id FROM postflow.clip_forge_jobs
      WHERE brand_id IN (
        SELECT id FROM postflow.brands
        WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
      )
    )
  );

DROP POLICY IF EXISTS "clip_forge_feedback_brand_owner" ON postflow.clip_forge_feedback;
CREATE POLICY "clip_forge_feedback_brand_owner" ON postflow.clip_forge_feedback
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );

DROP POLICY IF EXISTS "trend_builder_jobs_brand_owner" ON postflow.trend_builder_jobs;
CREATE POLICY "trend_builder_jobs_brand_owner" ON postflow.trend_builder_jobs
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );

DROP POLICY IF EXISTS "trend_concepts_brand_owner" ON postflow.trend_concepts;
CREATE POLICY "trend_concepts_brand_owner" ON postflow.trend_concepts
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );
