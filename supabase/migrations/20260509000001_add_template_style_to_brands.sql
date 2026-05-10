-- Add template_style to brands table
-- Controls the visual intensity of rendered post templates on a 0–100 scale:
--   0  = Clean & Minimal (generous whitespace, muted palette, refined typography)
--   50 = Balanced (default)
--   100 = Bold & Expressive (high contrast, large type, vivid brand colors)
-- Used by the Puppeteer renderer to interpolate layout/typography/colour values.

ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS template_style integer NOT NULL DEFAULT 50
    CHECK (template_style >= 0 AND template_style <= 100);
