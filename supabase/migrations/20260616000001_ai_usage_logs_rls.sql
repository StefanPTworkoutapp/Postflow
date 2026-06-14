-- Migration: Enable RLS on ai_usage_logs
-- The table was created in 20260518130000_add_ai_usage_logs.sql without RLS.
-- This table is admin/service-role only — no user policies are added.
-- Service client (createServiceClient) bypasses RLS for writes from logUsage.ts.
-- Without this, any authenticated user could read all AI usage costs across all accounts
-- via the Supabase anon key.

ALTER TABLE postflow.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- No policies = no access for authenticated/anon users.
-- Only service_role (used in logUsage.ts and the admin dashboard) can access this table.
