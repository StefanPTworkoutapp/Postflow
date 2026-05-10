-- Stores the user's preferred emojis when emoji_policy = 'sparingly'
-- e.g. "💪 ✅ 🔥" — injected into prompts so AI uses their specific ones
ALTER TABLE postflow.brands
  ADD COLUMN IF NOT EXISTS emoji_favorites TEXT DEFAULT NULL;
