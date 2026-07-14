-- Migration: connection_wizard_progress
--
-- P2c (guided connection wizard): the "Connect all platforms" popup walks a
-- pro through every platform (+ the full multi-step Buffer walkthrough) as a
-- single linear flow. If the pro closes the overlay mid-flow, reopening it
-- must offer "Continue at step N or start over?" and that has to survive a
-- device switch — so progress is persisted server-side per brand+platform
-- rather than in localStorage.
--
-- One row per (brand, platform). `current_step` is the 0-based index of the
-- last step the pro reached *within that platform's own sub-flow* (e.g.
-- Buffer's flow has multiple sub-steps: create account → get token → paste
-- token → connect X inside Buffer → confirm). `completed` flips true once the
-- final "connected ✓" verification step for that platform has passed.
--
-- Nullable-safe by design: the wizard UI feature-detects this table (a select
-- that 400s because the table doesn't exist yet is treated as "no saved
-- progress, start fresh") so code never crashes pre-migration.

CREATE TABLE IF NOT EXISTS postflow.connection_wizard_progress (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  platform      TEXT        NOT NULL, -- 'buffer' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'threads'
  current_step  INTEGER     NOT NULL DEFAULT 0,
  completed     BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brand_id, platform)
);

CREATE INDEX IF NOT EXISTS connection_wizard_progress_brand_idx
  ON postflow.connection_wizard_progress(brand_id);

ALTER TABLE postflow.connection_wizard_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connection_wizard_progress_select"
  ON postflow.connection_wizard_progress
  FOR SELECT
  USING (
    brand_id IN (SELECT id FROM postflow.brands WHERE account_id = auth.uid())
  );

CREATE POLICY "connection_wizard_progress_insert"
  ON postflow.connection_wizard_progress
  FOR INSERT
  WITH CHECK (
    brand_id IN (SELECT id FROM postflow.brands WHERE account_id = auth.uid())
  );

CREATE POLICY "connection_wizard_progress_update"
  ON postflow.connection_wizard_progress
  FOR UPDATE
  USING (
    brand_id IN (SELECT id FROM postflow.brands WHERE account_id = auth.uid())
  );

CREATE POLICY "connection_wizard_progress_delete"
  ON postflow.connection_wizard_progress
  FOR DELETE
  USING (
    brand_id IN (SELECT id FROM postflow.brands WHERE account_id = auth.uid())
  );

CREATE TRIGGER connection_wizard_progress_updated_at
  BEFORE UPDATE ON postflow.connection_wizard_progress
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();
