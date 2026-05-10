-- Billing tables for Week 6
--
-- postflow.subscriptions already exists from the initial schema (20260504000000).
-- This migration adds the missing columns needed for Stripe/Mollie provider tracking,
-- then creates the invoices table.

-- ── Extend subscriptions ───────────────────────────────────────────────────────
-- Add provider-specific subscription IDs + billing_interval.
-- Use IF NOT EXISTS so re-running is safe.

ALTER TABLE postflow.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS mollie_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_interval        TEXT CHECK (billing_interval IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ;

-- Ensure only one active subscription per account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_account_id_key'
      AND conrelid = 'postflow.subscriptions'::regclass
  ) THEN
    ALTER TABLE postflow.subscriptions ADD CONSTRAINT subscriptions_account_id_key UNIQUE (account_id);
  END IF;
END;
$$;

-- ── invoices ─────────────────────────────────────────────────────────────────
-- Invoice history per account. Populated by Stripe/Mollie webhooks.
-- Includes Dutch VAT breakdown for tax compliance.

CREATE TABLE IF NOT EXISTS postflow.invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES postflow.accounts(id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES postflow.subscriptions(id),

  provider              TEXT NOT NULL CHECK (provider IN ('stripe', 'mollie')),
  provider_invoice_id   TEXT NOT NULL,
  provider_payment_url  TEXT,
  invoice_pdf_url       TEXT,

  status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'paid', 'void', 'uncollectible')),

  subtotal_cents        INT NOT NULL DEFAULT 0,
  vat_rate              NUMERIC(4,2) NOT NULL DEFAULT 21.00,
  vat_amount_cents      INT NOT NULL DEFAULT 0,
  total_cents           INT NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  description           TEXT,

  issued_at             TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_account_idx ON postflow.invoices(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_id_idx ON postflow.invoices(provider, provider_invoice_id);

ALTER TABLE postflow.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account owner reads own invoices" ON postflow.invoices;
DROP POLICY IF EXISTS "Service role manages invoices"    ON postflow.invoices;

CREATE POLICY "Account owner reads own invoices"
  ON postflow.invoices FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM postflow.accounts WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Service role manages invoices"
  ON postflow.invoices FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
