-- ============================================================
-- V2A Analytics Extensions
-- ============================================================
-- 1. post_analytics: add completion_rate (Reels) + brand_tokens_snapshot
-- 2. posts: add predicted_performance + actual_performance (accuracy tracking)
--
-- All changes are idempotent (ADD COLUMN IF NOT EXISTS).
-- No data loss risk — only additive columns.

SET search_path = postflow, public;

-- ── 1. post_analytics extensions ────────────────────────────────────────────

-- completion_rate = plays / reach (Reels only)
-- NULL when not a Reel or data not available from Meta API
ALTER TABLE postflow.post_analytics
  ADD COLUMN IF NOT EXISTS completion_rate NUMERIC;

-- brand_tokens_snapshot: the brand's intelligence_tokens at the time analytics
-- were fetched. Used for prediction accuracy: compare "what tokens predicted"
-- to what actually happened.
ALTER TABLE postflow.post_analytics
  ADD COLUMN IF NOT EXISTS brand_tokens_snapshot JSONB;

-- ── 2. posts accuracy tracking ──────────────────────────────────────────────

-- predicted_performance: brand intelligence_tokens snapshot captured at the
-- moment the post was scheduled via Buffer. Shape:
--   { token_snapshot: {...}, predicted_engagement_range: [low, high], captured_at: "ISO" }
ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS predicted_performance JSONB;

-- actual_performance: filled by the analytics fetch after post is published.
-- Shape:
--   { engagement_rate, impressions, reach, saves, completion_rate, fetched_at }
ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS actual_performance JSONB;

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Index for accuracy trend queries: posts with both predicted + actual in last 30 days
CREATE INDEX IF NOT EXISTS posts_accuracy_idx
  ON postflow.posts (brand_id, posted_at DESC)
  WHERE predicted_performance IS NOT NULL AND actual_performance IS NOT NULL;
