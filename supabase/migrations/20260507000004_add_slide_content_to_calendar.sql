-- ============================================================
-- Add slide_content + template_slug to content_calendar
-- slide_content: AI-generated per-slide data (headline, body, is_hook, is_cta)
-- template_slug: recommended template for this entry
-- ============================================================

ALTER TABLE postflow.content_calendar
  ADD COLUMN IF NOT EXISTS slide_content  JSONB,
  ADD COLUMN IF NOT EXISTS template_slug  TEXT;
