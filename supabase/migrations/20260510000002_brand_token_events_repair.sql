-- Repair migration for 20260510000001.
--
-- brand_token_events table + policy may already exist (if 000001 ran partially
-- or fully on a preview branch). This migration is 100% idempotent: every
-- statement uses IF NOT EXISTS or DROP ... IF EXISTS before CREATE.
--
-- Safe to re-run any number of times.

-- ============================================================
-- 1. brands columns (idempotent — no-op if already present)
-- ============================================================

ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS intelligence_tokens JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_kit           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calibration_status  TEXT         NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS calibration_done_at TIMESTAMPTZ;

-- ============================================================
-- 2. brand_token_events table + indexes (idempotent)
-- ============================================================

CREATE TABLE IF NOT EXISTS postflow.brand_token_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  token_key        TEXT        NOT NULL,
  old_value        TEXT,
  new_value        TEXT,
  old_confidence   FLOAT,
  new_confidence   FLOAT,
  signal_type      TEXT        NOT NULL CHECK (signal_type IN (
                                  'analytics',
                                  'feedback',
                                  'manual',
                                  'reject',
                                  'calibration',
                                  'inspiration'
                                )),
  signal_source_id UUID,
  signal_detail    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_token_events_brand_id_idx   ON postflow.brand_token_events(brand_id);
CREATE INDEX IF NOT EXISTS brand_token_events_token_key_idx  ON postflow.brand_token_events(brand_id, token_key);
CREATE INDEX IF NOT EXISTS brand_token_events_created_at_idx ON postflow.brand_token_events(created_at DESC);

-- ============================================================
-- 3. tone_feedback CHECK constraint (idempotent)
-- ============================================================

ALTER TABLE postflow.tone_feedback
  DROP CONSTRAINT IF EXISTS tone_feedback_feedback_type_check;

ALTER TABLE postflow.tone_feedback
  ADD CONSTRAINT tone_feedback_feedback_type_check
  CHECK (feedback_type IN (
    'too_formal', 'too_casual', 'wrong_voice', 'great',
    'cta_weak', 'too_long', 'too_short',
    'great_hook', 'bad_music', 'too_fast', 'too_slow',
    'wrong_length', 'doesnt_fit_brand',
    'too_many_slides', 'too_few_slides', 'wrong_content_mix',
    'text_too_heavy', 'text_too_light', 'great_slide_flow'
  ));

-- ============================================================
-- 4. RLS policy (drop-then-create = idempotent)
-- ============================================================

ALTER TABLE postflow.brand_token_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_token_events_owner" ON postflow.brand_token_events;

CREATE POLICY "brand_token_events_owner" ON postflow.brand_token_events
  FOR ALL
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands WHERE account_id = auth.uid()
    )
  );
