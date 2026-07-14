-- Migration: calendar_optimizations
--
-- P3 (calendar intelligence, 2026-07-14): weekly re-optimization job
-- (src/inngest/jobs/weeklyCalendarReoptimize.ts) re-scores 'planned'
-- content_calendar entries in the next 30 days against performance_patterns
-- (timing) and template_health (template swap), moving/swapping slots that
-- score poorly. Every change it makes is logged here so it's auditable and
-- surfaceable in the calendar UI ("Calendar optimized — N changes this
-- week"), never a silent background mutation.
--
-- Fully idempotent. Safe to re-run.

SET search_path = postflow, public;

CREATE TABLE IF NOT EXISTS postflow.calendar_optimizations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  entry_id     UUID        NOT NULL REFERENCES postflow.content_calendar(id) ON DELETE CASCADE,
  -- 'timing'   — scheduled_date/scheduled_time moved within the same week
  -- 'template' — template_slug swapped to a healthier unlocked alternative
  change_type  TEXT        NOT NULL CHECK (change_type IN ('timing', 'template')),
  from_value   TEXT,
  to_value     TEXT,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_optimizations_brand_idx
  ON postflow.calendar_optimizations (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS calendar_optimizations_entry_idx
  ON postflow.calendar_optimizations (entry_id);

ALTER TABLE postflow.calendar_optimizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_optimizations_brand_owner" ON postflow.calendar_optimizations;
CREATE POLICY "calendar_optimizations_brand_owner"
  ON postflow.calendar_optimizations
  FOR SELECT
  USING (
    brand_id IN (SELECT id FROM postflow.brands WHERE account_id = auth.uid())
  );
