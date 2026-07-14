-- Migration: imported_posts
--
-- P3 (calendar intelligence, 2026-07-14): feed import — pulls each connected
-- social account's EXISTING published posts (not ones PostFlow created) so
-- calendar generation can (a) avoid repeating recently-published topics and
-- (b) derive a cold-start performance baseline for brand-new accounts that
-- have no PostFlow-native performance_patterns yet (sample_size < 5).
--
-- Written to by:
--   - src/inngest/jobs/feedImportOnConnect.ts (event-triggered, fires from
--     the OAuth callbacks right after a social_accounts upsert — imports the
--     last ~50 posts for that one account)
--   - src/inngest/jobs/feedImportNightly.ts (cron — picks up new posts since
--     each account's last import)
--
-- Read by:
--   - src/lib/server/brand/getBrandContext.ts (recently-published dedupe +
--     cold-start baseline block)
--   - src/app/(app)/admin/page.tsx + AdminDashboard.tsx (invisible-code
--     health: accounts connected vs accounts with imports, last import age)
--
-- Service-role only writer (Inngest uses the service key) — same
-- "service-role bypass, no RLS restrictions needed for writes" idiom as
-- sync_runs/analytics_sync_errors (20260511000001). A SELECT policy is
-- included so a brand-owner-facing UI can read their own rows later if
-- that surface gets built; it's not required by anything today.
--
-- Fully idempotent. Safe to re-run.

SET search_path = postflow, public;

CREATE TABLE IF NOT EXISTS postflow.imported_posts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  platform          TEXT        NOT NULL
                                 CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'threads')),
  platform_post_id  TEXT        NOT NULL,
  caption           TEXT,
  media_type        TEXT,
  posted_at         TIMESTAMPTZ,
  -- { likes, comments, shares, impressions, ... } — shape varies per platform,
  -- kept loose rather than modelling every platform's metric set as columns.
  engagement        JSONB,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brand_id, platform, platform_post_id)
);

CREATE INDEX IF NOT EXISTS imported_posts_brand_idx
  ON postflow.imported_posts (brand_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS imported_posts_brand_platform_idx
  ON postflow.imported_posts (brand_id, platform, imported_at DESC);

ALTER TABLE postflow.imported_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imported_posts_brand_owner" ON postflow.imported_posts;
CREATE POLICY "imported_posts_brand_owner"
  ON postflow.imported_posts
  FOR SELECT
  USING (
    brand_id IN (SELECT id FROM postflow.brands WHERE account_id = auth.uid())
  );
