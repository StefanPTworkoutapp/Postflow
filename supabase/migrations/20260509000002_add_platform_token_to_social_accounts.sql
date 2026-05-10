-- Add platform_access_token to social_accounts
-- Stores the platform-native OAuth token (Meta Graph API, LinkedIn API, etc.)
-- Separate from access_token which holds the Buffer token.
-- Required for fetching post analytics directly from platform APIs.

ALTER TABLE postflow.social_accounts
  ADD COLUMN IF NOT EXISTS platform_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS platform_account_id    TEXT;  -- e.g. Instagram Business Account ID, LinkedIn org URN
