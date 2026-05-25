-- ============================================================
-- TABLE: templates
-- Brand post templates. is_default=true rows are available to
-- all brands. Brand-specific overrides have brand_id set.
-- ============================================================

-- Drop the old schema if it exists (base schema had a different column layout)
DROP TABLE IF EXISTS postflow.templates CASCADE;

CREATE TABLE postflow.templates (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID    REFERENCES postflow.brands(id) ON DELETE CASCADE,
  -- NULL brand_id = default template, available to every brand

  slug        TEXT    NOT NULL,   -- e.g. "edu-bold", "quote-card"
  name        TEXT    NOT NULL,   -- Display name
  description TEXT,               -- Short description for picker UI

  type        TEXT    NOT NULL
              CHECK (type IN ('single_image', 'carousel', 'reel_cover', 'story')),

  platforms   TEXT[], -- NULL = works for all platforms; e.g. ARRAY['instagram','tiktok']

  is_default  BOOLEAN NOT NULL DEFAULT false,

  -- Per-brand colour/font overrides (NULL = use brand settings)
  config      JSONB,

  -- Rendered preview PNG stored in Supabase Storage
  thumbnail_url TEXT,

  sort_order  INT     NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX templates_brand_slug_idx
  ON postflow.templates(COALESCE(brand_id::TEXT, 'default'), slug);

CREATE INDEX templates_brand_idx ON postflow.templates(brand_id);

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON postflow.templates
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();

-- RLS
ALTER TABLE postflow.templates ENABLE ROW LEVEL SECURITY;

-- Brands can read default templates (brand_id IS NULL) or their own
CREATE POLICY "brands can read their templates and defaults"
  ON postflow.templates FOR SELECT
  USING (
    brand_id IS NULL
    OR brand_id IN (
      SELECT id FROM postflow.brands WHERE account_id = auth.uid()
    )
  );

-- Brands can manage their own templates
CREATE POLICY "brands can manage own templates"
  ON postflow.templates FOR ALL
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands WHERE account_id = auth.uid()
    )
  );

-- ============================================================
-- SEED: 8 default templates
-- ============================================================

INSERT INTO postflow.templates
  (slug, name, description, type, platforms, is_default, sort_order)
VALUES
  (
    'edu-bold',
    'Education — Bold',
    'Large bold text on white. Great for facts, tips, and educational points.',
    'single_image', NULL, true, 10
  ),
  (
    'quote-card',
    'Quote / Motivation',
    'Brand colour background with large centered quote. Perfect for mindset and inspiration.',
    'single_image', NULL, true, 20
  ),
  (
    'dark-statement',
    'Dark Statement',
    'Dark background, bold white headline. Strong for myth-busting and authority posts.',
    'single_image', NULL, true, 30
  ),
  (
    'tip-numbered',
    'Numbered Tip',
    'Large number in brand colour with tip text. Great for "Top X" and step-by-step content.',
    'single_image', NULL, true, 40
  ),
  (
    'carousel-edu',
    'Carousel — Educational',
    'Hook slide + numbered content slides + CTA slide. Best for how-to and education.',
    'carousel', NULL, true, 50
  ),
  (
    'carousel-myth',
    'Carousel — Myth vs. Reality',
    'Alternating dark/brand-colour slides contrasting myths with facts.',
    'carousel', NULL, true, 60
  ),
  (
    'reel-cover',
    'Reel Cover',
    'Vertical 9:16 bold text over image/gradient. Hook viewers in the first frame.',
    'reel_cover', ARRAY['instagram','tiktok'], true, 70
  ),
  (
    'story-teaser',
    'Story Teaser',
    'Vertical story format with strong hook text and a swipe-up style CTA.',
    'story', ARRAY['instagram'], true, 80
  );
