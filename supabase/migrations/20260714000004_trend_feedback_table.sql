-- ============================================================
-- P1: Trend feedback signal — persist tags + approve/reject outcome
-- ============================================================
-- PATCH /api/trend/[id]/feedback previously accepted `tags` in the body and
-- silently dropped them, only flipping trend_builder_jobs.status. This table
-- mirrors clip_forge_feedback so the trend loop has the same learnable shape:
-- rating + tags + a token snapshot for audit, nudged inline at write time
-- (approve reinforces, reject-with-tags applies the mapped negative signal —
-- see src/lib/server/brand/feedbackTokenMaps.ts). `processed` is included for
-- parity/future batch use even though today's nudge happens synchronously.
--
-- Fully idempotent. Safe to re-run. NOT APPLIED — needs Stefan approval.

SET search_path = postflow, public;

CREATE TABLE IF NOT EXISTS postflow.trend_feedback (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                UUID        NOT NULL REFERENCES postflow.trend_builder_jobs(id) ON DELETE CASCADE,
  brand_id              UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  -- 'approve' | 'reject'
  rating                TEXT        NOT NULL CHECK (rating IN ('approve','reject')),
  tags                  TEXT[],
  chosen_version        TEXT        CHECK (chosen_version IN ('a', 'b')),
  brand_tokens_snapshot JSONB,
  processed             BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trend_feedback_job_idx   ON postflow.trend_feedback (job_id);
CREATE INDEX IF NOT EXISTS trend_feedback_brand_idx ON postflow.trend_feedback (brand_id, created_at DESC);

ALTER TABLE postflow.trend_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trend_feedback_brand_owner" ON postflow.trend_feedback;
CREATE POLICY "trend_feedback_brand_owner" ON postflow.trend_feedback
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );
