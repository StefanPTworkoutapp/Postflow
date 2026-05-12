/**
 * PATCH /api/trend/[id]/nudge
 *
 * Applies a user nudge for one regeneration of the chosen version.
 * Only allowed once (regenerated = false → true).
 *
 * Body: { nudgeText: string }
 *
 * Extracts token signals from the nudge text and re-renders the chosen version.
 * Nudge text examples:
 *   "Make it faster"          → pacing = fast, +0.08
 *   "More energetic music"    → music_energy = high, +0.05
 *   "Less text on screen"     → text_overlay_style = minimal_corner, +0.05
 *   "Softer hook"             → hook_style = story_open, +0.05
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"
import { nudgeToken }                from "@/lib/server/brand/nudge-token"
import { assembleBrandedRender }     from "@/lib/server/render/brand-assembler"
import { submitRender }              from "@/lib/server/render/shotstack"
import type { BrandKit, ClipInput }  from "@/lib/server/render/brand-assembler"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

// Keyword → token signal mapping
const NUDGE_SIGNALS: Array<{
  keywords: string[]
  tokenKey:  string
  value:     string
  delta:     number
}> = [
  { keywords: ["faster", "faster paced", "more upbeat", "speed up"],         tokenKey: "pacing",             value: "fast",          delta: 0.08 },
  { keywords: ["slower", "slower paced", "calmer", "less rushed"],            tokenKey: "pacing",             value: "slow",          delta: 0.08 },
  { keywords: ["energetic music", "high energy music", "pumping"],            tokenKey: "music_energy",       value: "high",          delta: 0.05 },
  { keywords: ["soft music", "calm music", "quieter music"],                  tokenKey: "music_energy",       value: "low",           delta: 0.05 },
  { keywords: ["less text", "less overlay", "cleaner", "minimal"],            tokenKey: "text_overlay_style", value: "minimal_corner",delta: 0.05 },
  { keywords: ["more text", "bigger text", "bold text"],                      tokenKey: "text_overlay_style", value: "bold_center",   delta: 0.05 },
  { keywords: ["softer hook", "gentler opening", "story hook"],               tokenKey: "hook_style",         value: "story_open",    delta: 0.05 },
  { keywords: ["stronger hook", "bolder hook", "statement hook"],             tokenKey: "hook_style",         value: "bold_statement",delta: 0.05 },
]

function extractNudgeSignals(nudgeText: string): Array<{ tokenKey: string; value: string; delta: number }> {
  const lower = nudgeText.toLowerCase()
  const found: Array<{ tokenKey: string; value: string; delta: number }> = []
  for (const sig of NUDGE_SIGNALS) {
    if (sig.keywords.some(k => lower.includes(k))) {
      found.push({ tokenKey: sig.tokenKey, value: sig.value, delta: sig.delta })
    }
  }
  return found
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

    const body = await req.json() as { nudgeText?: string }
    const nudgeText = body.nudgeText?.trim()
    if (!nudgeText) return NextResponse.json({ error: "nudgeText is required" }, { status: 400 })

    // ── Load job ──────────────────────────────────────────────────────────────
    const { data: job, error: jobError } = await (nt(supabase))
      .from("trend_builder_jobs")
      .select("id, brand_id, status, chosen_version, regenerated, selected_concept_id, version_a_tokens_snapshot, version_b_tokens_snapshot")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (jobError || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    type JobRow = {
      id: string; brand_id: string; status: string; chosen_version: string | null
      regenerated: boolean; selected_concept_id: string | null
      version_a_tokens_snapshot: Record<string, unknown> | null
      version_b_tokens_snapshot: Record<string, unknown> | null
    }
    const j = job as JobRow

    if (j.regenerated) {
      return NextResponse.json({ error: "Regeneration already used — only one nudge allowed" }, { status: 409 })
    }
    if (j.status !== "ready") {
      return NextResponse.json({ error: `Job in '${j.status}' state — cannot nudge` }, { status: 409 })
    }
    if (!j.chosen_version) {
      return NextResponse.json({ error: "Pick a version before nudging" }, { status: 409 })
    }

    // ── Load concept ──────────────────────────────────────────────────────────
    const { data: conceptRow } = await (nt(supabase))
      .from("trend_concepts")
      .select("format_spec")
      .eq("id", j.selected_concept_id)
      .maybeSingle()

    type ConceptFormatSpec = {
      goal: string; hook_text: string; cta_text: string
      signed_urls: (string | null)[]; clip_durations: number[]
      brand_kit_snapshot: BrandKit | null
      pacing: string; music_energy: string; text_overlay_style: string
      platform: string
    }

    const spec = (conceptRow as { format_spec?: ConceptFormatSpec } | null)?.format_spec

    if (!spec) return NextResponse.json({ error: "Concept data unavailable" }, { status: 400 })

    // ── Extract and apply nudge signals to tokens ─────────────────────────────
    const signals = extractNudgeSignals(nudgeText)
    await Promise.allSettled(
      signals.map(s => nudgeToken(brand.id, s.tokenKey, s.value, s.delta, "feedback", jobId, { nudge_text: nudgeText }))
    )

    // ── Build updated render spec with nudge applied ───────────────────────────
    const clips: ClipInput[] = (spec.signed_urls ?? [])
      .map((url, i): ClipInput | null => {
        if (!url) return null
        return {
          publicUrl:       url,
          durationSeconds: spec.clip_durations?.[i] ?? 5,
          hookText:        i === 0 ? spec.hook_text : undefined,
          ctaText:         i === (spec.signed_urls.length - 1) ? spec.cta_text : undefined,
        }
      })
      .filter((c): c is ClipInput => c !== null)

    // Apply nudge signals to the current spec
    const nudgedMusicEnergy = signals.find(s => s.tokenKey === "music_energy")?.value ?? spec.music_energy
    const nudgedTextStyle   = signals.find(s => s.tokenKey === "text_overlay_style")?.value ?? spec.text_overlay_style

    const { selectMusicTracks } = await import("@/lib/server/music/music-selector")
    const music_genre = "modern_electronic"
    const tracks = selectMusicTracks(nudgedMusicEnergy, music_genre, spec.platform ?? "instagram")

    const nudgedRenderSpec = assembleBrandedRender({
      clips,
      platform:         spec.platform ?? "instagram",
      goal:             spec.goal,
      brandKit:         spec.brand_kit_snapshot,
      textOverlayStyle: nudgedTextStyle,
      music:            tracks[0] ? { src: tracks[0].full_url, volume: 0.4 } : undefined,
    })

    // ── Submit re-render ──────────────────────────────────────────────────────
    const renderResult = await submitRender(nudgedRenderSpec)

    // ── Update job with nudge re-render ───────────────────────────────────────
    const updateField = j.chosen_version === "a" ? "version_a_tokens_snapshot" : "version_b_tokens_snapshot"
    const existingSnap = j.chosen_version === "a" ? j.version_a_tokens_snapshot : j.version_b_tokens_snapshot

    await (nt(supabase))
      .from("trend_builder_jobs")
      .update({
        status:           "rendering",
        render_progress:  0,
        regenerated:      true,
        regenerate_nudge: nudgeText,
        [updateField]: {
          ...(existingSnap ?? {}),
          _render_id: renderResult.renderId,
        },
      })
      .eq("id", jobId)

    return NextResponse.json({ ok: true, renderId: renderResult.renderId })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trend/nudge] error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
