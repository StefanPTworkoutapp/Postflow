-- Migration: Render credit transaction log
-- Each clip-forge render costs 1 credit. Credits are purchased via Stripe
-- one-time payments. Balance = SUM(amount) for the account.

CREATE TABLE IF NOT EXISTS postflow.render_credit_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID        NOT NULL,
  amount       INTEGER     NOT NULL,                -- positive = purchase, negative = deduction
  reason       TEXT        NOT NULL,                -- e.g. "purchase_10", "render_clip_forge"
  job_id       UUID        NULL,                    -- clip_forge_jobs.id when deducting
  stripe_pi    TEXT        NULL,                    -- Stripe PaymentIntent ID for purchase events
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rct_account_id_idx
  ON postflow.render_credit_transactions(account_id);

ALTER TABLE postflow.render_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "render_credits_select"
  ON postflow.render_credit_transactions
  FOR SELECT
  USING (account_id = auth.uid());

-- Inserts are service-role only (webhooks + deduction logic)
-- No INSERT/UPDATE/DELETE policy for authenticated users
