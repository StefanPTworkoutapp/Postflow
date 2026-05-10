-- Phase B: Brand Intelligence Foundation
-- Adds intelligence_tokens + brand_kit + calibration columns to brands,
-- creates brand_token_events audit table,
-- and extends tone_feedback CHECK with new video/hook/carousel tags.
-- Applied: 2026-05-10

-- ============================================================
-- 1. Extend postflow.brands with intelligence columns
-- ============================================================

ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS intelligence_tokens JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_kit           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calibration_status  TEXT         NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS calibration_done_at TIMESTAMPTZ;

-- ============================================================
-- 2. brand_token_events — permanent audit log for all token updates
-- NEVER DROP OR RENAME COLUMNS — only add new ones.
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
-- 3. Extend tone_feedback CHECK with new video/hook/carousel tags
-- Drop the old check constraint and replace with extended one.
-- ============================================================

ALTER TABLE postflow.tone_feedback
  DROP CONSTRAINT IF EXISTS tone_feedback_feedback_type_check;

ALTER TABLE postflow.tone_feedback
  ADD CONSTRAINT tone_feedback_feedback_type_check
  CHECK (feedback_type IN (
    -- Original tags (all post types)
    'too_formal',
    'too_casual',
    'wrong_voice',
    'great',
    'cta_weak',
    'too_long',
    'too_short',
    -- New video/hook tags (shown for TikTok / Reel posts)
    'great_hook',
    'bad_music',
    'too_fast',
    'too_slow',
    'wrong_length',
    'doesnt_fit_brand',
    -- New carousel-specific tags (shown only for carousel posts)
    'too_many_slides',
    'too_few_slides',
    'wrong_content_mix',
    'text_too_heavy',
    'text_too_light',
    'great_slide_flow'
  ));

-- ============================================================
-- 4. RLS for new table
-- ============================================================

ALTER TABLE postflow.brand_token_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_token_events_owner" ON postflow.brand_token_events
  FOR ALL
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands WHERE account_id = auth.uid()
    )
  );
