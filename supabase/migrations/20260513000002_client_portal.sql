-- ============================================================
-- Migration: Client portal + post approval status
-- Created: 2026-05-13
--
-- What it changes:
--   1. New table: postflow.portal_invites
--      Stores read-only client portal links (token-based, no login needed).
--   2. New column: postflow.posts.client_approval_status
--      Tracks whether a client has approved, flagged, or left a post pending review.
--
-- Why it's needed:
--   The client portal (V2D) lets Stefan send a public link to clients.
--   Clients view the scheduled calendar and approve/flag posts without an account.
--
-- Data loss risk: NONE — additive only.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. portal_invites
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS postflow.portal_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  token       TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'reviewer'
                          CHECK (role IN ('reviewer')),
  expires_at  TIMESTAMPTZ,                         -- NULL = never expires
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ                        -- set on portal page load
);

CREATE INDEX IF NOT EXISTS portal_invites_brand_id_idx ON postflow.portal_invites(brand_id);
CREATE INDEX IF NOT EXISTS portal_invites_token_idx    ON postflow.portal_invites(token);

-- RLS: brand owners can read/write their own invites; no client access (token lookup uses service role)
ALTER TABLE postflow.portal_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_invites_owner" ON postflow.portal_invites;

CREATE POLICY "portal_invites_owner"
  ON postflow.portal_invites
  FOR ALL
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands WHERE account_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────
-- 2. client_approval_status on posts
-- ──────────────────────────────────────────────────────────

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS client_approval_status TEXT
    DEFAULT NULL
    CHECK (client_approval_status IN ('pending', 'approved', 'flagged'));

-- Track who reviewed and when (audit trail without a separate table)
ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS client_reviewed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS client_reviewer_email TEXT DEFAULT NULL;

COMMENT ON COLUMN postflow.posts.client_approval_status IS
  'NULL = not yet sent for review | pending = sent but not yet actioned | approved = client approved | flagged = client flagged for changes';
