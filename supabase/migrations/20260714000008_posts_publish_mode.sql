-- Migration: reminder publish mode
--
-- P2c (music-without-licensing reminder mode): adds a per-post publish mode.
-- 'direct' (default) keeps today's behaviour — PostFlow calls the platform API
-- via dispatchPublish. 'reminder' means PostFlow never calls a publish API at
-- all: at the scheduled time the client instead gets an email with a
-- ready-to-post package (media link, copy-ready caption + hashtags, a
-- recommended song NAME + vibe to search for manually in the platform's own
-- audio picker) and posts it themselves. This sidesteps music licensing
-- entirely — no audio file is ever stored or played by PostFlow.
--
-- reminder_song_name / reminder_song_vibe are METADATA ONLY (text), computed
-- from the existing music-selector scoring logic (src/lib/server/music/
-- music-selector.ts) at schedule time. No audio asset reference is stored.
--
-- reminder_sent_at records when the reminder email went out, independent of
-- the status column, so "reminder sent but not yet marked posted by the
-- client" is always distinguishable even if the status CHECK constraint
-- below hasn't been applied yet in a given environment (see the code-side
-- fallback in publishScheduledPost.ts).
--
-- Status gains 'reminder_sent': the terminal state for a reminder-mode post
-- until the client (or pro) clicks "Mark as posted", which moves it to
-- 'posted' — the same terminal state 'direct' mode posts reach, so downstream
-- analytics/round-trip code doesn't need to special-case reminder posts once
-- they're marked posted (aside from having no platform post id — handled by
-- checking publish_mode / buffer_post_id, not status).

ALTER TABLE postflow.posts
  ADD COLUMN IF NOT EXISTS publish_mode       TEXT        NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS reminder_song_name TEXT,
  ADD COLUMN IF NOT EXISTS reminder_song_vibe TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent_at   TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_publish_mode_check'
      AND conrelid = 'postflow.posts'::regclass
  ) THEN
    ALTER TABLE postflow.posts
      ADD CONSTRAINT posts_publish_mode_check
        CHECK (publish_mode IN ('direct', 'reminder'));
  END IF;
END $$;

-- Widen the status CHECK to allow 'reminder_sent'. The constraint was created
-- inline (unnamed) in the original CREATE TABLE, so Postgres auto-named it
-- posts_status_check — drop and recreate with the extra value. Existing rows
-- all satisfy the new (superset) constraint, so this is non-destructive.
ALTER TABLE postflow.posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE postflow.posts
  ADD CONSTRAINT posts_status_check
    CHECK (status IN ('draft', 'ready', 'scheduled', 'posted', 'failed', 'reminder_sent'));

COMMENT ON COLUMN postflow.posts.publish_mode IS
  'direct (default): PostFlow publishes via the platform API. reminder: PostFlow '
  'never calls a publish API — it emails the client a ready-to-post package at '
  'the scheduled time and the client posts it themselves (used to add music '
  'manually in-app without any licensing exposure for PostFlow).';

COMMENT ON COLUMN postflow.posts.reminder_song_name IS
  'Recommended track title for reminder-mode posts, from music-selector scoring. '
  'Metadata only — no audio file is referenced or stored.';

COMMENT ON COLUMN postflow.posts.reminder_song_vibe IS
  'Human-readable vibe/energy description of the recommended track, shown in '
  'the reminder email so the client knows what to search for.';

COMMENT ON COLUMN postflow.posts.reminder_sent_at IS
  'Timestamp the reminder email was sent for a reminder-mode post. NULL until sent.';
