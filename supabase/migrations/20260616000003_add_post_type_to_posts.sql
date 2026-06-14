-- Migration: add post_type to postflow.posts
--
-- The posts table previously had no first-class post_type column.
-- post_type was only on content_calendar, meaning the publish pipeline
-- had no reliable way to tell whether a post was a reel, story, or feed post.
--
-- This migration adds the column and backfills from template_slug for existing rows.

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS post_type TEXT
    CHECK (post_type IN ('single_image', 'carousel', 'reel', 'story', 'text_only', 'video'))
    DEFAULT 'single_image';

-- Backfill from template_slug for existing rows
UPDATE postflow.posts SET post_type =
  CASE
    WHEN template_slug LIKE 'carousel%'  THEN 'carousel'
    WHEN template_slug = 'reel-cover'    THEN 'reel'
    WHEN template_slug = 'story-teaser'  THEN 'story'
    ELSE 'single_image'
  END
WHERE post_type IS NULL OR post_type = 'single_image';

COMMENT ON COLUMN postflow.posts.post_type IS
  'Content type: single_image | carousel | reel | story | text_only | video. '
  'Determines which API endpoint and media_type the publish pipeline uses.';
