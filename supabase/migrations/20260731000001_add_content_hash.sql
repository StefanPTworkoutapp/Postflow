-- Add content_hash to media_uploads for client-side SHA-256 deduplication.
-- Allows the upload pipeline to detect duplicate files before issuing a
-- signed upload URL, short-circuiting the upload and returning the existing
-- media record instead.
--
-- content_hash is nullable: existing rows and files whose hash cannot be
-- computed (very large files on low-memory devices) skip dedup gracefully.

SET search_path = postflow, public;

ALTER TABLE postflow.media_uploads
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_media_uploads_content_hash
  ON postflow.media_uploads (brand_id, content_hash)
  WHERE content_hash IS NOT NULL;
