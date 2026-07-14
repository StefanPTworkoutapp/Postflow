-- ============================================================
-- P1: Close the adapt loop — processed/audit columns
-- ============================================================
-- clip_forge_feedback: written by PATCH /api/clip-forge/[id]/feedback but
-- never read. Adds bookkeeping columns so a weekly consumer job can
-- aggregate unprocessed rows per brand and mark them handled once nudged.
--
-- tone_feedback: adds immediate_nudge_applied so a single piece of feedback
-- can nudge tokens right away (small delta) without the weekly
-- toneLearningLoop batch job double-applying a second full-strength delta
-- for the same row once its type crosses the (now lower) threshold.
--
-- Fully idempotent. Safe to re-run. NOT APPLIED — needs Stefan approval.

SET search_path = postflow, public;

ALTER TABLE postflow.clip_forge_feedback
  ADD COLUMN IF NOT EXISTS processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clip_forge_feedback_unprocessed_idx
  ON postflow.clip_forge_feedback (brand_id)
  WHERE processed = FALSE;

ALTER TABLE postflow.tone_feedback
  ADD COLUMN IF NOT EXISTS immediate_nudge_applied BOOLEAN NOT NULL DEFAULT FALSE;
