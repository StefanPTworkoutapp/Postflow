-- P5: Per-account AI budget events.
--
-- One row per time an account's monthly AI spend crosses the "economy mode"
-- (1x cap) or "blocked" (2x cap) threshold defined in
-- src/lib/server/billing/aiBudget.ts. Written by checkAiBudget() so the
-- degrade/block behaviour is visible (not silent) — see /admin margin table
-- "over budget" column, which reads the latest event per account.
--
-- Not a high-write-volume table: checkAiBudget() only inserts once per
-- account per UTC day per verdict (dedup check before insert), so this never
-- grows faster than accounts × 2 rows/day.

CREATE TABLE IF NOT EXISTS postflow.ai_budget_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES postflow.accounts(id) ON DELETE CASCADE,
  verdict     TEXT        NOT NULL CHECK (verdict IN ('economy', 'blocked')),
  spent_usd   NUMERIC(10, 4) NOT NULL,
  cap_usd     NUMERIC(10, 4) NOT NULL,
  plan        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_budget_events_account_created_idx
  ON postflow.ai_budget_events (account_id, created_at DESC);

ALTER TABLE postflow.ai_budget_events ENABLE ROW LEVEL SECURITY;

-- Admin/service-role only — same posture as ai_usage_logs (see
-- 20260616001_ai_usage_logs_rls.sql). No end-user policies.
-- Service client (createServiceClient) bypasses RLS for writes from
-- aiBudget.ts and reads from the admin dashboard.
