/**
 * Clip-forge feedback loop — consumer for clip_forge_feedback.
 *
 * PATCH /api/clip-forge/[id]/feedback has always written rating + tags +
 * brand_tokens_snapshot into clip_forge_feedback; until P1 (2026-07-14)
 * nothing ever read it. This mirrors the toneLearningLoop pattern: aggregate
 * unprocessed rows per brand, and once a tag (or a plain rating with no tags)
 * crosses a small threshold, nudge the relevant token(s) and mark those rows
 * processed.
 *
 * Threshold is intentionally lower than the tone loop's (2 vs 3) — clip-forge
 * jobs are heavier to produce (render + music + captions) so a brand
 * generates far fewer of them per week than quick caption posts; waiting for
 * 3+ would mean this loop rarely fires at all for most brands.
 *
 * Rows whose tag(s) never cross the threshold are left unprocessed so they
 * keep accumulating across weekly runs — same "patience" behaviour as
 * toneLearningLoop, not "process everything and forget the rest."
 *
 * Called from the clipForgeLearningLoop Inngest job (weekly).
 */

import { createServiceClient } from "@/lib/supabase/service"
import {
  VIDEO_FEEDBACK_TAG_MAP,
  VIDEO_RATING_APPROVE_ACTION,
  VIDEO_RATING_REJECT_ACTION,
  resolveAndNudge,
} from "@/lib/server/brand/feedbackTokenMaps"

const CLIP_FORGE_TAG_THRESHOLD = 2

interface ClipForgeFeedbackRow {
  id:     string
  rating: "approve" | "reject"
  tags:   string[] | null
}

export interface ClipForgeLoopResult {
  brandId:        string
  skipped:        boolean
  reason?:        string
  rowsSeen?:      number
  rowsProcessed?: number
  nudgedTags?:    string[]
}

/**
 * Process all unprocessed clip_forge_feedback for one brand. Idempotent —
 * safe to call repeatedly; only rows whose signal crossed the threshold this
 * pass get marked processed.
 */
export async function processClipForgeFeedbackForBrand(brandId: string): Promise<ClipForgeLoopResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: feedbacks } = await supabase
    .from("clip_forge_feedback")
    .select("id, rating, tags")
    .eq("brand_id", brandId)
    .eq("processed", false)

  const rows = (feedbacks ?? []) as ClipForgeFeedbackRow[]
  if (!rows.length) return { brandId, skipped: true, reason: "no unprocessed feedback" }

  // ── Aggregate tag → contributing row ids ──────────────────────────────────
  const tagRows = new Map<string, string[]>()
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const arr = tagRows.get(tag) ?? []
      arr.push(row.id)
      tagRows.set(tag, arr)
    }
  }

  const processedIds = new Set<string>()
  const nudgedTags: string[] = []

  for (const [tag, rowIds] of tagRows) {
    if (rowIds.length < CLIP_FORGE_TAG_THRESHOLD) continue
    const action = VIDEO_FEEDBACK_TAG_MAP[tag]
    if (!action) continue  // unmapped/free-form tag — nothing to nudge, leave unprocessed

    const signalType = action.delta < 0 ? "reject" : "feedback"
    const ok = await resolveAndNudge(
      brandId,
      action,
      signalType,
      `clip_forge_feedback_batch_${tag}`,
      { tag, count: rowIds.length, batch_processed: new Date().toISOString() },
    )
    if (ok) {
      nudgedTags.push(tag)
      rowIds.forEach(id => processedIds.add(id))
    }
  }

  // ── Blanket rating-only signal for rows with no (mapped) tags at all ──────
  // A rating alone is still a signal — approve/reject with nothing more
  // specific still says "this worked" / "this didn't", so it nudges the
  // general best_post_goal token rather than staying silent.
  const noTagRows = rows.filter(r => !(r.tags ?? []).some(t => VIDEO_FEEDBACK_TAG_MAP[t]))
  const approvals  = noTagRows.filter(r => r.rating === "approve" && !processedIds.has(r.id))
  const rejections = noTagRows.filter(r => r.rating === "reject"  && !processedIds.has(r.id))

  if (approvals.length >= CLIP_FORGE_TAG_THRESHOLD) {
    const ok = await resolveAndNudge(
      brandId,
      VIDEO_RATING_APPROVE_ACTION,
      "feedback",
      "clip_forge_feedback_rating_approve",
      { count: approvals.length },
    )
    if (ok) { nudgedTags.push("rating:approve"); approvals.forEach(r => processedIds.add(r.id)) }
  }
  if (rejections.length >= CLIP_FORGE_TAG_THRESHOLD) {
    const ok = await resolveAndNudge(
      brandId,
      VIDEO_RATING_REJECT_ACTION,
      "reject",
      "clip_forge_feedback_rating_reject",
      { count: rejections.length },
    )
    if (ok) { nudgedTags.push("rating:reject"); rejections.forEach(r => processedIds.add(r.id)) }
  }

  if (processedIds.size) {
    await supabase
      .from("clip_forge_feedback")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .in("id", [...processedIds])
  }

  return {
    brandId,
    skipped:       processedIds.size === 0,
    reason:        processedIds.size === 0 ? "no tag/rating group crossed threshold yet" : undefined,
    rowsSeen:      rows.length,
    rowsProcessed: processedIds.size,
    nudgedTags,
  }
}
