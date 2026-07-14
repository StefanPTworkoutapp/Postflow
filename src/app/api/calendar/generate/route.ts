import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { inngest } from "@/inngest/client"
import type { GenerateCalendarInput } from "@/lib/server/calendar/generateCalendarService"

// calendar_generation_jobs is not yet in generated database.types.ts pre-migration —
// same type-bypass idiom as dailyAnalyticsFetch.ts's `newTables()` helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: Awaited<ReturnType<typeof createClient>>) => client as any

/**
 * POST /api/calendar/generate
 *
 * P4 (2026-07-14): converted to a background job — a whole-month Claude
 * call (up to 4096 output tokens) can take 20-60s, too slow to hold an HTTP
 * request open for (Stefan's law: AI work runs in the background by
 * default). This route now only validates the request + enqueues an
 * Inngest job; the actual Claude call + content_calendar insert happens in
 * src/inngest/jobs/generateCalendarJob.ts (shared logic:
 * src/lib/server/calendar/generateCalendarService.ts).
 *
 * The full input (platforms, pillars, frequencyOverrides, shootingFrequency)
 * is stored on the job row so a retry never loses the user's choices.
 *
 * Returns (202): { jobId: string }
 * Poll GET /api/calendar/generate/status?jobId=... for status/result.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await request.json() as GenerateCalendarInput
    const { year, month, platforms, pillars, frequencyOverrides = {}, shootingFrequency = "weekly" } = body

    if (!year || !month)      return NextResponse.json({ error: "year and month required" }, { status: 400 })
    if (!platforms?.length)  return NextResponse.json({ error: "Select at least one platform" }, { status: 400 })
    if (!pillars?.length)    return NextResponse.json({ error: "Select at least one content pillar" }, { status: 400 })

    const input: GenerateCalendarInput = { year, month, platforms, pillars, frequencyOverrides, shootingFrequency }

    const { data: job, error: jobErr } = await nt(supabase)
      .from("calendar_generation_jobs")
      .insert({
        brand_id: brand.id,
        year,
        month,
        status:   "pending",
        input,
      })
      .select("id")
      .single()

    if (jobErr || !job) {
      console.error("[calendar/generate] failed to enqueue job:", jobErr?.message)
      return NextResponse.json({ error: jobErr?.message ?? "Failed to enqueue generation job" }, { status: 500 })
    }

    await inngest.send({
      name: "postflow/calendar.generate.requested",
      data: { jobId: job.id },
    })

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[calendar/generate] error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
