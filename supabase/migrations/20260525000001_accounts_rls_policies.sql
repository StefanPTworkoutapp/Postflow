-- Accounts RLS policies
--
-- The accounts table has had RLS enabled since the initial schema migration
-- (20260504000000) but no policies were ever defined — the comment said
-- "Policies added once auth is wired." This migration closes that gap.
--
-- Without these policies, new users hit a "violates row-level security policy"
-- error when getOrCreateAccount() tries to INSERT their first account row.
-- Existing users are unaffected because their account row already exists and
-- SELECT/INSERT is never reached.
--
-- Policy design:
--   - Users can read their own row (id = auth.uid())
--   - Users can insert their own row at sign-up (id = auth.uid())
--   - Users can update their own row (email changes, name changes)
--   - No policy is needed for DELETE (accounts are never deleted via the app)

CREATE POLICY "accounts_select_own"
  ON postflow.accounts
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "accounts_insert_own"
  ON postflow.accounts
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "accounts_update_own"
  ON postflow.accounts
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
