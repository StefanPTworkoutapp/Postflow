-- Migration: Brand template preferences (multi-slot rotation system)
-- Allows each brand to save 1–5 template slots per post type (plan-gated).
-- Slots rotate round-robin on calendar generation; locked slots are immune
-- to auto-swap by the template analytics engine.

CREATE TABLE IF NOT EXISTS postflow.brand_template_preferences (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  post_type     TEXT        NOT NULL,   -- single_image | carousel | reel | story | quote | linkedin_text
  template_slug TEXT        NOT NULL,   -- must match a slug in getTemplate()
  slot_index    INTEGER     NOT NULL,   -- 0-based position in rotation
  locked        BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brand_id, post_type, slot_index)
);

CREATE INDEX IF NOT EXISTS btp_brand_post_type_idx
  ON postflow.brand_template_preferences(brand_id, post_type);

ALTER TABLE postflow.brand_template_preferences ENABLE ROW LEVEL SECURITY;

-- RLS: users can only access preferences for their own brands
CREATE POLICY "brand_template_prefs_select"
  ON postflow.brand_template_preferences
  FOR SELECT
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = auth.uid()
    )
  );

CREATE POLICY "brand_template_prefs_insert"
  ON postflow.brand_template_preferences
  FOR INSERT
  WITH CHECK (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = auth.uid()
    )
  );

CREATE POLICY "brand_template_prefs_update"
  ON postflow.brand_template_preferences
  FOR UPDATE
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = auth.uid()
    )
  );

CREATE POLICY "brand_template_prefs_delete"
  ON postflow.brand_template_preferences
  FOR DELETE
  USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = auth.uid()
    )
  );
