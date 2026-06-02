-- RLS policies for postflow.brands
--
-- The brands table has had RLS enabled since the initial schema migration
-- (20260504000000) but no row-level policies were ever defined — same gap
-- that affected postflow.accounts (fixed in 20260525000001).
--
-- Without these policies every authenticated INSERT/UPDATE/SELECT on brands
-- is blocked, which is why the onboarding wizard's brand creation always
-- returned "new row violates row-level security policy for table brands"
-- and users could never get past step 1.
--
-- Policy design:
--   - Users can read their own brands (account_id = auth.uid())
--   - Users can create brands for their own account
--   - Users can update their own brands
--   - Users can delete their own brands (future use / brand switching)

CREATE POLICY "brands_select_own"
  ON postflow.brands
  FOR SELECT
  USING (account_id = auth.uid());

CREATE POLICY "brands_insert_own"
  ON postflow.brands
  FOR INSERT
  WITH CHECK (account_id = auth.uid());

CREATE POLICY "brands_update_own"
  ON postflow.brands
  FOR UPDATE
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

CREATE POLICY "brands_delete_own"
  ON postflow.brands
  FOR DELETE
  USING (account_id = auth.uid());
