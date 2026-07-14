/**
 * PATCH /api/trend/[id]/feedback
 *
 * Approve or reject the final chosen version of a trend-forge video.
 * Same pattern as clip-forge feedback.
 *
 * Body: { rating: 'approve' | 'reject', tags?: string[] }
 *
 * ── P1 (2026-07-14) ──────────────────────────────────────────────────────
 * Previously `tags` was destructured from the body and never used — this
 * now persists it (+ the rating outcome) into trend_feedback, a learnable
 * signal mirroring clip_forge_feedback. Unlike clip-forge (which had NO
 * consumer at all and needed a batch job), a trend job's feedback is a single
 * job-level outcome, so it nudges tokens inline at write time rather than
 * waiting for a weekly aggregation:
 *   - approve            → small positive reinforcement (style/topic tokens)
 *   - reject + tags       → the mapped negative/confidence-drop signal per
 *                           tag, same map + deltas clip-forge uses, mirroring
 *                           how toneLearningLoop treats "wrong_voice"
 *   - reject, no tags     → blanket negative signal (still a real outcome)
 * Nudging is pure math (no AI call) so it runs inline, fire-and-forget —
 * never blocks the response.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"
import { createServiceClient }       from "@/lib/supabase/service"
import {
  VIDEO_FEEDBACK_TAG_MAP,
  VIDEO_RATING_APPROVE_ACTION,
  VIDEO_RATING_REJECT_ACTION,
  resolveAndNudge,
} from "@/lib/server/brand/feedbackTokenMaps"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

/**
 * Fire-and-forget: persist the trend_feedback row, then nudge tokens for the
 * outcome. Runs after the response-critical status update, never awaited by
 * the handler.
 */
async function recordAndNudgeTrendFeedback(opts: {
  brandId:             string
  jobId:               string
  rating:              "approve" | "reject"
  tags:                string[]
  chosenVersion:       "a" | "b" | null
  brandTokensSnapshot: Record<string, unknown> | null
}) {
  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = service as any

  const { data: inserted, error } = await svc
    .from("trend_feedback")
    .insert({
      job_id:                opts.jobId,
      brand_id:              opts.brandId,
      rating:                opts.rating,
      tags:                  opts.tags.length ? opts.tags : null,
      chosen_version:        opts.chosenVersion,
      brand_tokens_snapshot: opts.brandTokensSnapshot,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[trend-feedback] insert error:", error.message)
    return
  }

  const nudgedFor: string[] = []

  // Tag-mapped nudges (both approve and reject can carry tags)
  for (const tag of opts.tags) {
    const action = VIDEO_FEEDBACK_TAG_MAP[tag]
    if (!action) continue
    const signalType = action.delta < 0 ? "reject" : "feedback"
    const ok = await resolveAndNudge(
      opts.brandId,
      action,
      signalType,
      `trend_feedback_${tag}`,
      { tag, job_id: opts.jobId, rating: opts.rating },
    )
    if (ok) nudgedFor.push(tag)
  }

  // Blanket rating signal when no tag carried a mapped nudge
  if (!nudgedFor.length) {
    const action = opts.rating === "approve" ? VIDEO_RATING_APPROVE_ACTION : VIDEO_RATING_REJECT_ACTION
    const signalType = opts.rating === "approve" ? "feedback" : "reject"
    await resolveAndNudge(
      opts.brandId,
      action,
      signalType,
      `trend_feedback_rating_${opts.rating}`,
      { job_id: opts.jobId },
    )
  }

  if (inserted?.id) {
    await svc.from("trend_feedback").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", inserted.id)
  }
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

    const body = await req.json() as { rating?: string; tags?: string[] }
    const { rating, tags = [] } = body

    if (rating !== "approve" && rating !== "reject") {
      return NextResponse.json({ error: "rating must be 'approve' or 'reject'" }, { status: 400 })
    }

    const { data: job, error: jobError } = await (nt(supabase))
      .from("trend_builder_jobs")
      .select("id, brand_id, status, chosen_version, version_a_tokens_snapshot, version_b_tokens_snapshot")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (jobError || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const j = job as {
      id: string; status: string; chosen_version: "a" | "b" | null
      version_a_tokens_snapshot: Record<string, unknown> | null
      version_b_tokens_snapshot: Record<string, unknown> | null
    }
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

    const brandTokensSnapshot = j.chosen_version === "b"
      ? j.version_b_tokens_snapshot
      : j.version_a_tokens_snapshot

    // Fire-and-forget — never block the response on persistence/nudging.
    recordAndNudgeTrendFeedback({
      brandId:             brand.id,
      jobId,
      rating,
      tags,
      chosenVersion:       j.chosen_version,
      brandTokensSnapshot,
    }).catch(err => console.error("[trend-feedback] record/nudge failed:", err))

    return NextResponse.json({ ok: true, rating })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
