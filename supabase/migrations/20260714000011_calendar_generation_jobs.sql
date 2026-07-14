-- ============================================================
-- P4: Calendar generation background job tracking
-- ============================================================
-- Backs the async conversion of /api/calendar/generate — the route now
-- enqueues an Inngest event and returns immediately; the actual Claude call
-- + content_calendar insert happens in src/inngest/jobs/generateCalendarJob.ts.
-- This table lets the calendar UI poll for job status/result without
-- blocking the HTTP request on a 20-60s Claude call.
--
-- Fully idempotent. Safe to re-run.

SET search_path = postflow, public;

CREATE TABLE IF NOT EXISTS postflow.calendar_generation_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  year         INTEGER     NOT NULL,
  month        INTEGER     NOT NULL,
  -- 'pending' | 'running' | 'done' | 'failed'
  status       TEXT        NOT NULL DEFAULT 'pending',
  -- Original request body (platforms, pillars, frequencyOverrides, shootingFrequency)
  -- kept so a retry can re-enqueue without the user re-entering their choices.
  input        JSONB       NOT NULL,
  -- { count, summary, entries } on success
  result       JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS calendar_generation_jobs_brand_idx
  ON postflow.calendar_generation_jobs (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS calendar_generation_jobs_status_idx
  ON postflow.calendar_generation_jobs (status)
  WHERE status IN ('pending', 'running');

ALTER TABLE postflow.calendar_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_generation_jobs_brand_owner" ON postflow.calendar_generation_jobs;
CREATE POLICY "calendar_generation_jobs_brand_owner" ON postflow.calendar_generation_jobs
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );
