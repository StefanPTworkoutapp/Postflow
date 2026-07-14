import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import {
  TONE_FEEDBACK_TOKEN_MAP,
  TONE_FEEDBACK_IMMEDIATE_DELTA,
  resolveAndNudge,
} from "@/lib/server/brand/feedbackTokenMaps"
import { createServiceClient } from "@/lib/supabase/service"

const VALID_TYPES = ["great", "too_formal", "too_casual", "wrong_voice", "cta_weak"] as const
type FeedbackType = typeof VALID_TYPES[number]

/**
 * Fire-and-forget immediate half-strength token nudge for a single piece of
 * tone feedback (P1 2026-07-14). Full rationale + double-counting guard is
 * documented in src/inngest/jobs/toneLearningLoop.ts — short version: this
 * makes ONE correction matter right away instead of waiting for 3+ to pile up,
 * while the weekly batch job checks `immediate_nudge_applied` before nudging
 * again so the same row's signal is never applied twice.
 */
function applyImmediateToneNudge(brandId: string, feedbackRowId: string, feedbackType: string) {
  const action = TONE_FEEDBACK_TOKEN_MAP[feedbackType]
  if (!action) return

  const immediateAction = { ...action, delta: Math.sign(action.delta) * TONE_FEEDBACK_IMMEDIATE_DELTA }
  const signalType = action.delta < 0 ? "reject" : "feedback"

  resolveAndNudge(
    brandId,
    immediateAction,
    signalType,
    `tone_feedback_immediate_${feedbackType}`,
    { feedback_type: feedbackType, feedback_row_id: feedbackRowId, immediate: true },
  )
    .then(async (ok) => {
      if (!ok) return
      const service = createServiceClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any)
        .from("tone_feedback")
        .update({ immediate_nudge_applied: true })
        .eq("id", feedbackRowId)
    })
    .catch(err => console.error("[feedback] immediate nudge failed:", err))
}

/**
 * POST /api/posts/[id]/feedback
 * Records tone feedback for a post. Used by the learning loop later.
 * Body: { feedback_type: FeedbackType; comment?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  const body = await request.json() as { feedback_type?: string; comment?: string }
  if (!body.feedback_type || !VALID_TYPES.includes(body.feedback_type as FeedbackType)) {
    return NextResponse.json({ error: "Invalid feedback_type" }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from("tone_feedback")
    .insert({
      brand_id:      brand.id,
      post_id:       postId,
      feedback_type: body.feedback_type,
      user_comment:  body.comment?.trim() || null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[feedback] insert error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fire-and-forget — never block the response on a token nudge (pure math,
  // not an AI call, but still shouldn't add latency to the user's action).
  if (inserted?.id) {
    applyImmediateToneNudge(brand.id, inserted.id as string, body.feedback_type)
  }

  return NextResponse.json({ success: true })
}
