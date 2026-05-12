-- Migration: 20260512000001_inspiration_posts
-- Feature: Inspiration Link (Part 8C)
--
-- What it changes:
--   Creates postflow.inspiration_posts to store analyses of external posts
--   submitted by users for brand inspiration. Each row holds the raw analysis
--   (observed patterns + token signals) and whether it has been applied to
--   the brand's intelligence tokens.
--
-- Why it's needed:
--   The Inspiration Link feature needs persistent storage for:
--     1. The library of past analyses (skip → apply later flow)
--     2. Idempotency guard on /api/inspiration/apply
--     3. Audit trail for brand token changes sourced from inspiration
--
-- What could break:
--   Nothing — this is a new table with no existing dependants.
--
-- Data loss risk: None. New table only.

CREATE TABLE IF NOT EXISTS postflow.inspiration_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  source_url  TEXT        NOT NULL,
  platform    TEXT        NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
  analysis    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  signals     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  applied     BOOLEAN     NOT NULL DEFAULT false,
  applied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspiration_posts_brand_id_idx
  ON postflow.inspiration_posts (brand_id);

-- RLS: users may only see and modify their own brand's inspiration posts.
ALTER TABLE postflow.inspiration_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspiration_posts_brand_access"
  ON postflow.inspiration_posts
  FOR ALL
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands WHERE account_id = auth.uid()
    )
  );
