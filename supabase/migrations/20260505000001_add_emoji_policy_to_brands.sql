-- Add emoji_policy to brands
-- Controls whether AI-generated captions include emojis
-- Values: 'never' | 'sparingly' | 'often'
-- Default: 'sparingly' (safe middle ground for existing brands)

ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS emoji_policy TEXT NOT NULL DEFAULT 'sparingly'
  CHECK (emoji_policy IN ('never', 'sparingly', 'often'));
