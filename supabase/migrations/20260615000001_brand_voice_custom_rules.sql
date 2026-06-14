-- Migration: Brand voice custom rules
-- Adds user-controlled "always/never do X" text fields to brands.
-- These flow directly into generateCaption as absolute constraints.
-- voice_updated_at is set whenever the voice profile or custom rules change.

ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS custom_do_rules   TEXT,
  ADD COLUMN IF NOT EXISTS custom_dont_rules TEXT,
  ADD COLUMN IF NOT EXISTS voice_updated_at  TIMESTAMPTZ;
