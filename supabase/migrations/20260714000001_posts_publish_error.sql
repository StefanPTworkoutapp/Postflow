-- Migration: add publish_error to postflow.posts
--
-- P0 fix: failed direct-publish attempts (Inngest retries exhausted) were
-- silently leaving posts stuck on status = 'scheduled' with no record of why
-- the publish failed. This column lets the onFailure handler in
-- publishScheduledPost.ts store the error message so the UI can surface a
-- clear "failed" state with a Retry action.
--
-- Nullable: existing posts have no error. Cleared back to NULL whenever a
-- post is (re)scheduled or successfully published.

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS publish_error TEXT;

COMMENT ON COLUMN postflow.posts.publish_error IS
  'Error message from the last failed direct-publish attempt. NULL when the post '
  'has never failed, or has been rescheduled/published since. Set by the '
  'publishScheduledPost Inngest onFailure handler when retries are exhausted.';
