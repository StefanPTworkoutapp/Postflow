-- ============================================================
-- P4: Post render jobs (carousel + variants) — background job tracking
-- ============================================================
-- Backs the async conversion of:
--   /api/posts/[id]/render-carousel  (1 Puppeteer page per slide)
--   /api/posts/[id]/render-variants  (3 Puppeteer renders)
-- Both routes now enqueue an Inngest event and return immediately; the
-- actual Puppeteer render + storage upload happens in
-- src/inngest/jobs/renderCarouselJob.ts / renderVariantsJob.ts.
--
-- /api/posts/[id]/render (single image) is UNCHANGED and stays synchronous —
-- one Puppeteer page is fast enough for a blocking request.
--
-- Fully idempotent. Safe to re-run.

SET search_path = postflow, public;

CREATE TABLE IF NOT EXISTS postflow.post_render_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  post_id      UUID        NOT NULL REFERENCES postflow.posts(id)  ON DELETE CASCADE,
  -- 'carousel' | 'variants'
  job_type     TEXT        NOT NULL CHECK (job_type IN ('carousel', 'variants')),
  -- 'pending' | 'rendering' | 'done' | 'failed'
  status       TEXT        NOT NULL DEFAULT 'pending',
  -- carousel: { templateSlug, slideContent }; variants: { templateSlugs? }
  input        JSONB       NOT NULL,
  -- carousel: { imageUrls: string[] }; variants: { variants: [...] }
  result       JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS post_render_jobs_post_idx
  ON postflow.post_render_jobs (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_render_jobs_brand_idx
  ON postflow.post_render_jobs (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_render_jobs_status_idx
  ON postflow.post_render_jobs (status)
  WHERE status IN ('pending', 'rendering');

ALTER TABLE postflow.post_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_render_jobs_brand_owner" ON postflow.post_render_jobs;
CREATE POLICY "post_render_jobs_brand_owner" ON postflow.post_render_jobs
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM postflow.brands
      WHERE account_id = (SELECT id FROM postflow.accounts WHERE email = auth.email())
    )
  );
