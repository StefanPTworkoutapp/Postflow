-- ============================================================
-- Migration: 20260512000002_calibration_status
-- Adds a CHECK constraint to postflow.brands.calibration_status
-- to enforce valid enum values ('pending' | 'complete').
--
-- Why: calibration_status was added in 20260510000001 without a
-- CHECK constraint, leaving the door open for invalid values.
-- This migration adds the constraint safely using ADD CONSTRAINT
-- IF NOT EXISTS (idempotent).
--
-- What it changes:
--   - postflow.brands.calibration_status gets a CHECK constraint
--
-- Risk: LOW — existing rows all have 'pending' (the DEFAULT), which
-- is one of the allowed values. No data loss.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brands_calibration_status_check'
      AND conrelid = 'postflow.brands'::regclass
  ) THEN
    ALTER TABLE postflow.brands
      ADD CONSTRAINT brands_calibration_status_check
        CHECK (calibration_status IN ('pending', 'complete'));
  END IF;
END $$;
