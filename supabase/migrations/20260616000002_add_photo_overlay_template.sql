-- Add missing photo-overlay template to the DB.
-- The template has been registered in code (src/lib/server/render/templates/index.ts)
-- since launch but was never seeded in the templates table.
-- sort_order 5 places it before edu-bold (10) as the primary photo-based template.

INSERT INTO postflow.templates (slug, name, description, type, platforms, is_default, sort_order)
SELECT
  'photo-overlay',
  'Photo Overlay',
  'Full-bleed photo background with brand colour overlay and caption. Best when you have a strong hero image.',
  'single_image',
  NULL,
  true,
  5
WHERE NOT EXISTS (
  SELECT 1 FROM postflow.templates WHERE slug = 'photo-overlay'
);
