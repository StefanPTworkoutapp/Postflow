import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { seedCalibrationTokens } from "@/lib/server/brand/nudge-token"
import type { CalibrationPost } from "../route"

/**
 * POST /api/onboarding/calibrate/confirm
 *
 * Called after the user has reviewed all 3 calibration posts.
 * Receives per-post feedback signals and derives brand tokens from them.
 *
 * Body:
 *   { reviews: PostReview[] }
 *
 * Effects:
 *   1. Seeds intelligence_tokens from post reviews (confidence = 0.60, calibration_locked = true)
 *   2. Sets brands.calibration_status = 'complete'
 */

export interface PostReview {
  post: CalibrationPost
  approved: boolean
  /** Which dimension needed adjustment: tone | length | style | hook */
  adjustment?: "tone" | "length" | "style" | "hook"
}

interface RequestBody {
  reviews: PostReview[]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 })

    const body = await request.json() as RequestBody
    if (!Array.isArray(body.reviews)) {
      return NextResponse.json({ error: "reviews array required" }, { status: 400 })
    }

    // Derive token seeds from post reviews
    const seeds = deriveTokenSeeds(body.reviews)

    // Seed tokens + mark calibration complete (seedCalibrationTokens sets both)
    await seedCalibrationTokens(brand.id, seeds)

    return NextResponse.json({ ok: true, calibration_status: "complete", seeds_written: seeds.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("POST /api/onboarding/calibrate/confirm:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Derive a set of intelligence token seeds from what the user approved/rejected.
 *
 * Strategy:
 *  - Approved posts reinforce the token values associated with that post type
 *  - Rejected posts with a specific adjustment dimension give signal on what to avoid
 *  - All seeds get confidence 0.60 (calibration floor) via seedCalibrationTokens
 */
function deriveTokenSeeds(
  reviews: PostReview[]
): Array<{ key: string; value: string | number | string[] }> {
  const approved  = reviews.filter(r => r.approved)
  const rejected  = reviews.filter(r => !r.approved)

  const seeds: Array<{ key: string; value: string | number | string[] }> = []

  // ── Hook style ────────────────────────────────────────────────────────────
  // Approved hook type from post C (trending) signals preferred hook_style
  const trendingApproved = approved.find(r => r.post.id === "C")
  const trendingRejected = rejected.find(r => r.post.id === "C" && r.adjustment === "hook")

  if (trendingApproved) {
    seeds.push({ key: "hook_style", value: "pattern_interrupt" })
    seeds.push({ key: "carousel_hook_style", value: "pattern_interrupt" })
  } else if (trendingRejected) {
    seeds.push({ key: "hook_style", value: "question" })
    seeds.push({ key: "carousel_hook_style", value: "question" })
  } else {
    seeds.push({ key: "hook_style", value: "question" })
    seeds.push({ key: "carousel_hook_style", value: "question" })
  }

  // ── Tone / style ──────────────────────────────────────────────────────────
  // If user rejected a post for tone, signal more educational/formal preference
  const toneRejected = rejected.filter(r => r.adjustment === "tone").length
  const styleRejected = rejected.filter(r => r.adjustment === "style").length

  if (toneRejected > 0) {
    seeds.push({ key: "caption_tone", value: "professional" })
  } else if (approved.length >= 2) {
    seeds.push({ key: "caption_tone", value: "conversational" })
  } else {
    seeds.push({ key: "caption_tone", value: "balanced" })
  }

  // ── Caption length ─────────────────────────────────────────────────────────
  const lengthRejected = rejected.filter(r => r.adjustment === "length").length
  if (lengthRejected > 0) {
    // User found posts too long — prefer shorter content
    seeds.push({ key: "best_content_duration_seconds", value: 20 })
  } else if (approved.length >= 2) {
    seeds.push({ key: "best_content_duration_seconds", value: 30 })
  } else {
    seeds.push({ key: "best_content_duration_seconds", value: 25 })
  }

  // ── Content format preferences ────────────────────────────────────────────
  // If educational (A) was approved, prefer carousel-edu format
  const eduApproved = approved.find(r => r.post.id === "A")
  if (eduApproved) {
    seeds.push({ key: "carousel_content_mix", value: "educational" })
    seeds.push({ key: "best_post_goal", value: "educate" })
    seeds.push({ key: "carousel_best_goal", value: "educate" })
  } else {
    seeds.push({ key: "carousel_content_mix", value: "mixed" })
    seeds.push({ key: "best_post_goal", value: "brand_awareness" })
    seeds.push({ key: "carousel_best_goal", value: "brand_awareness" })
  }

  // ── Style signals ─────────────────────────────────────────────────────────
  if (styleRejected > 0) {
    // User reacted negatively to current style — dial back text overlay density
    seeds.push({ key: "carousel_text_overlay_density", value: "low" })
    seeds.push({ key: "text_overlay_style", value: "minimal" })
  } else {
    seeds.push({ key: "carousel_text_overlay_density", value: "medium" })
    seeds.push({ key: "text_overlay_style", value: "bold_headline" })
  }

  // ── Pacing & slide count ──────────────────────────────────────────────────
  seeds.push({ key: "pacing", value: "medium" })
  seeds.push({ key: "carousel_slide_pacing", value: "medium" })
  seeds.push({ key: "carousel_slide_count", value: 7 })

  // ── Hashtag strategy ──────────────────────────────────────────────────────
  seeds.push({ key: "hashtag_strategy", value: "niche_targeted" })

  // ── Music energy (default from calibration) ───────────────────────────────
  seeds.push({ key: "music_energy", value: "medium" })

  // ── Carousel vs reel ─────────────────────────────────────────────────────
  // If brand post (B) was approved and trending (C) wasn't, prefer carousel
  const brandApproved  = approved.find(r => r.post.id === "B")
  if (brandApproved && !trendingApproved) {
    seeds.push({ key: "carousel_vs_reel_preference", value: "carousel" })
  } else if (trendingApproved && !brandApproved) {
    seeds.push({ key: "carousel_vs_reel_preference", value: "reel" })
  } else {
    seeds.push({ key: "carousel_vs_reel_preference", value: "equal" })
  }

  // ── Style volatility preference ───────────────────────────────────────────
  // Derived from how open the brand was to varied post styles during calibration.
  //
  // "steady":       Only approved posts closely matching their existing brand voice
  //                 → brand prioritises consistency over experimentation.
  //                 Calendar: ~80% proven formats, ~20% new tests.
  //
  // "mixed":        Approved a mix — some brand-aligned, some more experimental.
  //                 Calendar: ~65% proven formats, ~35% experiments.
  //
  // "experimental": Approved the trending/pattern-interrupt styles openly.
  //                 Calendar: ~45% proven formats, ~55% experiments.
  //
  // This token shapes generateCaption() to stay more on-brand or be more daring.
  // It also influences template_suggestions (steady brands get conservative swaps).
  // Users can override this preference in Brand Settings.
  if (approved.length <= 1 || (toneRejected + styleRejected) >= 2) {
    // Most posts rejected or many style/tone rejections → brand is conservative
    seeds.push({ key: "style_volatility_preference", value: "steady" })
  } else if (trendingApproved && approved.length >= 2) {
    // Approved the pattern-interrupt trending post → open to experimentation
    seeds.push({ key: "style_volatility_preference", value: "experimental" })
  } else {
    // Default: balanced approach
    seeds.push({ key: "style_volatility_preference", value: "mixed" })
  }

  return seeds
}
