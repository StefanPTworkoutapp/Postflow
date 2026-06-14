-- Migration: add source_post_id to postflow.posts
--
-- Tracks the lineage of derived posts (Story from a feed post, Reel from a post,
-- evergreen re-shares). Allows the analytics layer to attribute engagement on
-- a derived post back to the original content.
--
-- Nullable: existing posts have no source. Self-referencing FK with SET NULL on delete
-- so deleting an original post does not cascade-delete its derivatives.

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS source_post_id UUID
    REFERENCES postflow.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_source_post_id_idx ON postflow.posts(source_post_id)
  WHERE source_post_id IS NOT NULL;

COMMENT ON COLUMN postflow.posts.source_post_id IS
  'If this post was derived from another (Story from feed post, evergreen re-share, etc.), '
  'points to the original post. NULL for original content.';
