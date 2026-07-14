-- Migration: add music_skipped_reason to postflow.clip_forge_jobs
--
-- P0 fix: the music track library (src/lib/server/music/music-selector.ts) still
-- points at /tracks/*.mp3 paths that were never uploaded to public/ or storage.
-- If a Shotstack render included one of those tracks, Shotstack would fail trying
-- to fetch a non-existent asset. The render route now verifies the selected
-- track resolves before including it in the render spec; when it doesn't, the
-- render proceeds WITHOUT a soundtrack (fail-soft) and records why here so the
-- review UI can show "rendered without music".
--
-- Nullable: NULL means music was included normally, or no music was selected.

ALTER TABLE postflow.clip_forge_jobs
  ADD COLUMN IF NOT EXISTS music_skipped_reason TEXT;

COMMENT ON COLUMN postflow.clip_forge_jobs.music_skipped_reason IS
  'Set when a selected music track could not be resolved to a real asset at '
  'render time, so the render was submitted without a soundtrack. NULL when '
  'music was included or none was requested.';
