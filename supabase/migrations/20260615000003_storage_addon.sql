-- Migration: Storage add-on column on subscriptions
-- Tracks how many extra GB a user has purchased as an add-on via Stripe.
-- Updated by the customer.subscription.updated webhook when a storage add-on
-- item is added or removed from the subscription.

ALTER TABLE postflow.subscriptions
  ADD COLUMN IF NOT EXISTS storage_addon_gb INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN postflow.subscriptions.storage_addon_gb IS
  'Extra storage GB purchased via the storage add-on. Added to base plan storage limit.';
