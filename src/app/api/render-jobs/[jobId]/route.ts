import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

// post_render_jobs is not yet in generated database.types.ts pre-migration —
// same type-bypass idiom as dailyAnalyticsFetch.ts's `newTables()` helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: Awaited<ReturnType<typeof createClient>>) => client as any

/**
 * GET /api/render-jobs/[jobId]
 *
 * Polling endpoint for post_render_jobs (carousel + variants background
 * renders — P4, 2026-07-14). The UI polls this every few seconds while a
 * job is pending/rendering.
 *
 * Returns: { id, status: 'pending'|'rendering'|'done'|'failed', jobType, result, error }
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  const { data: job, error } = await nt(supabase)
    .from("post_render_jobs")
    .select("id, job_type, status, result, error")
    .eq("id", jobId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!job)  return NextResponse.json({ error: "Job not found" }, { status: 404 })

  return NextResponse.json({
    id:      job.id,
    jobType: job.job_type,
    status:  job.status,
    result:  job.result,
    error:   job.error,
  })
}
