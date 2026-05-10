-- Add media_urls to content_calendar so uploaded photos/videos can be
-- attached to a planned entry before (or after) the post is created.
-- The upload flow writes here; the PostEditor reads via the calendar join.

ALTER TABLE postflow.content_calendar
  ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}';
