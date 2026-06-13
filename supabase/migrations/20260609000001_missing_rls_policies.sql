-- Missing RLS policies for user-facing tables
--
-- Many postflow tables had RLS enabled since the initial schema migration
-- (20260504000000_postflow_schema.sql) but no row-level policies were ever
-- defined. The comment in that migration said "Policies added once auth is
-- wired." This migration closes that gap.
--
-- Without these policies, authenticated users cannot read or write their own
-- data through the anon-key client (createClient()), even though their session
-- is valid. SELECT returns 0 rows silently; INSERT/UPDATE/DELETE is rejected.
--
-- Internal tables (sync_runs, research_runs, analytics_sync_errors) are
-- intentionally left without authenticated-user policies — they are written
-- exclusively by service-role Inngest jobs and must not be accessible through
-- the authenticated client.
--
-- Ownership chain for brand-owned tables:
--   table.brand_id → postflow.brands.id
--   postflow.brands.account_id = auth.uid()   (stores the auth user UUID directly)

-- ── posts ─────────────────────────────────────────────────────────────────────
--
-- Users manage their own brand's posts (create, read, edit, delete).
-- No cross-brand access.

CREATE POLICY "posts_brand_owner"
  ON postflow.posts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = posts.brand_id
        AND b.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = posts.brand_id
        AND b.account_id = auth.uid()
    )
  );

-- ── social_accounts ───────────────────────────────────────────────────────────
--
-- Users manage their brand's social connections (connect, disconnect, update).

CREATE POLICY "social_accounts_brand_owner"
  ON postflow.social_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = social_accounts.brand_id
        AND b.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = social_accounts.brand_id
        AND b.account_id = auth.uid()
    )
  );

-- ── content_calendar ──────────────────────────────────────────────────────────
--
-- Users manage their brand's calendar entries (plan, update, archive).

CREATE POLICY "content_calendar_brand_owner"
  ON postflow.content_calendar
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = content_calendar.brand_id
        AND b.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = content_calendar.brand_id
        AND b.account_id = auth.uid()
    )
  );

-- ── media_uploads ─────────────────────────────────────────────────────────────
--
-- Users manage their brand's uploaded media assets.

CREATE POLICY "media_uploads_brand_owner"
  ON postflow.media_uploads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = media_uploads.brand_id
        AND b.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = media_uploads.brand_id
        AND b.account_id = auth.uid()
    )
  );

-- ── tone_feedback ─────────────────────────────────────────────────────────────
--
-- Users can submit and read tone feedback for their own brand's posts.

CREATE POLICY "tone_feedback_brand_owner"
  ON postflow.tone_feedback
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = tone_feedback.brand_id
        AND b.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM postflow.brands b
      WHERE b.id = tone_feedback.brand_id
        AND b.account_id = auth.uid()
    )
  );

-- ── subscriptions ─────────────────────────────────────────────────────────────
--
-- Subscription rows are written by service-role webhook handlers (Stripe /
-- Mollie). Users need SELECT only — to read their current plan and billing status.
-- INSERT / UPDATE are done by service role and should not be allowed via client.

CREATE POLICY "subscriptions_account_owner_select"
  ON postflow.subscriptions
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

-- ── feature_requests ──────────────────────────────────────────────────────────
--
-- Any authenticated user can submit a feature request or bug report (INSERT).
-- Users can read their own account's submitted requests (SELECT).
-- No UPDATE / DELETE — requests are managed by admins via service role.

CREATE POLICY "feature_requests_account_owner_select"
  ON postflow.feature_requests
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

CREATE POLICY "feature_requests_account_owner_insert"
  ON postflow.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id = auth.uid());

-- ── post_analytics ────────────────────────────────────────────────────────────
--
-- Analytics rows are written exclusively by service-role Inngest jobs.
-- Users need SELECT only — to view engagement data on their own posts.
-- The ownership chain goes through posts → brands.

CREATE POLICY "post_analytics_brand_owner_select"
  ON postflow.post_analytics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM postflow.posts p
      JOIN postflow.brands b ON b.id = p.brand_id
      WHERE p.id = post_analytics.post_id
        AND b.account_id = auth.uid()
    )
  );

-- ── Internal tables ───────────────────────────────────────────────────────────
--
-- The following tables have RLS enabled but NO authenticated-user policies,
-- which is intentional. They are written and read exclusively by service-role
-- Inngest jobs; the authenticated role must not access them directly.
--
--   postflow.sync_runs
--   postflow.research_runs
--   postflow.analytics_sync_errors
--
-- service_role bypasses RLS entirely, so those jobs continue to work.
-- Authenticated users hitting these tables via createClient() get 0 rows
-- on SELECT and a policy violation on INSERT/UPDATE — that is correct.
