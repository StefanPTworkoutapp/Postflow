-- ============================================================
-- Add carousel fields to posts
-- slide_content: the per-slide text content (headline, body, etc.)
-- carousel_image_urls: ordered array of rendered PNG URLs (one per slide)
-- ============================================================

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS slide_content       JSONB,
  ADD COLUMN IF NOT EXISTS carousel_image_urls TEXT[];
