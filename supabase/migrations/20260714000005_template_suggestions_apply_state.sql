-- ============================================================
-- P1: Template suggestion auto-swap — persist apply outcome
-- ============================================================
-- Approving a template_suggestion previously only flipped status='approved'
-- and never mutated brand_template_preferences (getReplacementSlot() was
-- dead code). Now PATCH /api/templates/suggestions/[id] actually swaps the
-- suggested template into the matching UNLOCKED slot(s). These columns
-- record what happened so the review UI can tell the pro plainly:
--   applied=true            → swap happened, swapped_slots lists where
--   applied=false + reason  → approved but not applied (e.g. all matching
--                              slots are locked, or brand has no saved slot
--                              using this template)
--
-- Fully idempotent. Safe to re-run. NOT APPLIED — needs Stefan approval.

SET search_path = postflow, public;

ALTER TABLE postflow.template_suggestions
  ADD COLUMN IF NOT EXISTS applied        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS applied_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_reason TEXT,
  ADD COLUMN IF NOT EXISTS swapped_slots  JSONB;
