-- Add dedicated single-image render templates for X, LinkedIn, and TikTok
-- photo-mode posts to the DB.
--
-- Context: these three slugs are already registered in code
-- (src/lib/server/render/templates/index.ts) since the P2b render-templates
-- work. photo-overlay taught us that "registered in code" and "seeded in
-- postflow.templates" can silently drift (see 20260616000002) — this
-- migration closes that gap for the new templates at the same time they
-- ship in code, using the same idempotent WHERE NOT EXISTS guard.
--
-- x-statement       — single_image, X only.        Native text-forward statement card.
-- linkedin-insight  — single_image, LinkedIn only. Professional insight/pull-quote card.
-- tiktok-cover       — single_image, TikTok only.   Photo-mode cover (NOT the video
--                      reel-cover template, which stays type='reel_cover' and covers
--                      both instagram + tiktok reel first-frames).
--
-- sort_order 90/100/110 place these after the existing 8 defaults (10–80) so
-- they don't reorder any brand's existing rotation.

INSERT INTO postflow.templates (slug, name, description, type, platforms, is_default, sort_order)
SELECT
  'x-statement',
  'X — Statement',
  'Near-black, one bold statement, a tight kicker line. Native to X''s fast text feed — starker than the multi-platform cards.',
  'single_image',
  ARRAY['x'],
  true,
  90
WHERE NOT EXISTS (
  SELECT 1 FROM postflow.templates WHERE slug = 'x-statement'
);

INSERT INTO postflow.templates (slug, name, description, type, platforms, is_default, sort_order)
SELECT
  'linkedin-insight',
  'LinkedIn — Insight',
  'Professional document-style card: tinted header strip, pull-quote headline framing, restrained brand palette.',
  'single_image',
  ARRAY['linkedin'],
  true,
  100
WHERE NOT EXISTS (
  SELECT 1 FROM postflow.templates WHERE slug = 'linkedin-insight'
);

INSERT INTO postflow.templates (slug, name, description, type, platforms, is_default, sort_order)
SELECT
  'tiktok-cover',
  'TikTok — Photo Cover',
  'Vertical brand-colour gradient cover for TikTok photo-mode posts. Huge hook headline + scroll-cue chevron. Not for video reels — see Reel Cover.',
  'single_image',
  ARRAY['tiktok'],
  true,
  110
WHERE NOT EXISTS (
  SELECT 1 FROM postflow.templates WHERE slug = 'tiktok-cover'
);
