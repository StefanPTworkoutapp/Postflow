-- ============================================================
-- Add template_slug to posts
-- Links a post to the template used to render its card.
-- NULL = legacy card renderer (no template).
-- ============================================================

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS template_slug TEXT;

-- Optional FK-style check — references postflow.templates.slug.
-- We use a soft reference (no FK) because templates.slug is not a PK,
-- and we want to allow legacy posts with NULL.

-- Index for future queries like "how many posts use each template"
CREATE INDEX IF NOT EXISTS posts_template_slug_idx
  ON postflow.posts(template_slug)
  WHERE template_slug IS NOT NULL;
