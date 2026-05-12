-- Add unique constraint on (brand_id, platform) to social_accounts.
-- Required for the upsert in the Instagram OAuth callback:
--   .upsert({ ... }, { onConflict: "brand_id,platform" })
-- Without this, Postgres throws:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Also ensures platform_access_token and platform_account_id columns exist
-- (added in 20260509000002 — this is a safety net in case that migration was missed).

SET search_path TO postflow;

-- Safety net: add columns if missing (idempotent)
ALTER TABLE postflow.social_accounts
  ADD COLUMN IF NOT EXISTS platform_access_token TEXT,
  ADD COLUMN IF NOT EXISTS platform_account_id   TEXT;

-- Add the unique constraint (drop first if a partial/broken one exists)
ALTER TABLE postflow.social_accounts
  DROP CONSTRAINT IF EXISTS social_accounts_brand_id_platform_key;

ALTER TABLE postflow.social_accounts
  ADD CONSTRAINT social_accounts_brand_id_platform_key
  UNIQUE (brand_id, platform);
