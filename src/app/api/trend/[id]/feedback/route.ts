/**
 * PATCH /api/trend/[id]/feedback
 *
 * Approve or reject the final chosen version of a trend-forge video.
 * Same pattern as clip-forge feedback.
 *
 * Body: { rating: 'approve' | 'reject', tags?: string[] }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

export async function PATCH(
  req:     NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await req.json() as { rating?: string; tags?: string[] }
    const { rating } = body

    if (rating !== "approve" && rating !== "reject") {
      return NextResponse.json({ error: "rating must be 'approve' or 'reject'" }, { status: 400 })
    }

    const { data: job, error: jobError } = await (nt(supabase))
      .from("trend_builder_jobs")
      .select("id, brand_id, status")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (jobError || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const j = job as { id: string; status: string }
    if (!["ready", "approved", "rejected"].includes(j.status)) {
      return NextResponse.json({ error: `Job in '${j.status}' state — cannot submit feedback yet` }, { status: 409 })
    }

    const now = new Date().toISOString()
    const jobUpdate = rating === "approve"
      ? { status: "approved", approved_at: now }
      : { status: "rejected", rejected_at: now }

    await (nt(supabase))
      .from("trend_builder_jobs")
      .update(jobUpdate)
      .eq("id", jobId)

    return NextResponse.json({ ok: true, rating })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
