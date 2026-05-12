/**
 * PATCH /api/clip-forge/[id]/feedback
 *
 * Approve or reject a completed clip-forge video.
 *
 * Body:
 *   rating  — "approve" | "reject"
 *   tags    — optional string[] (free-form feedback tags)
 *
 * On approve: sets job status = 'approved', records approved_at
 * On reject:  sets job status = 'rejected', records rejected_at
 * In both:    inserts a clip_forge_feedback row
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

interface FeedbackBody {
  rating: "approve" | "reject"
  tags?:  string[]
}

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

    const body = await req.json() as FeedbackBody
    const { rating, tags = [] } = body

    if (rating !== "approve" && rating !== "reject") {
      return NextResponse.json({ error: "rating must be 'approve' or 'reject'" }, { status: 400 })
    }

    // ── Verify job belongs to brand ───────────────────────────────────────────
    const { data: job, error: jobError } = await (nt(supabase))
      .from("clip_forge_jobs")
      .select("id, brand_id, status, brand_tokens_snapshot")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const j = job as { id: string; brand_id: string; status: string; brand_tokens_snapshot: Record<string, unknown> | null }

    if (!["ready", "approved", "rejected"].includes(j.status)) {
      return NextResponse.json(
        { error: `Job in '${j.status}' state — cannot submit feedback yet` },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()

    // ── Update job status ─────────────────────────────────────────────────────
    const jobUpdate = rating === "approve"
      ? { status: "approved", approved_at: now }
      : { status: "rejected", rejected_at: now }

    await (nt(supabase))
      .from("clip_forge_jobs")
      .update(jobUpdate)
      .eq("id", jobId)

    // ── Insert feedback record ────────────────────────────────────────────────
    await (nt(supabase))
      .from("clip_forge_feedback")
      .insert({
        job_id:                jobId,
        brand_id:              brand.id,
        rating,
        tags:                  tags.length ? tags : null,
        brand_tokens_snapshot: j.brand_tokens_snapshot,
      })

    return NextResponse.json({ ok: true, rating })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
