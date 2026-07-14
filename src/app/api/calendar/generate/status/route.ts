import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

// calendar_generation_jobs is not yet in generated database.types.ts pre-migration —
// same type-bypass idiom as dailyAnalyticsFetch.ts's `newTables()` helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: Awaited<ReturnType<typeof createClient>>) => client as any

/**
 * GET /api/calendar/generate/status?jobId=...
 *
 * Polling endpoint for calendar_generation_jobs (P4, 2026-07-14). The
 * GenerateCalendarModal polls this every few seconds after enqueueing a
 * generation job via POST /api/calendar/generate.
 *
 * Returns: { id, status: 'pending'|'running'|'done'|'failed', result, error }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get("jobId")
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  const { data: job, error } = await nt(supabase)
    .from("calendar_generation_jobs")
    .select("id, status, result, error")
    .eq("id", jobId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!job)  return NextResponse.json({ error: "Job not found" }, { status: 404 })

  return NextResponse.json({
    id:     job.id,
    status: job.status,
    result: job.result,
    error:  job.error,
  })
}
