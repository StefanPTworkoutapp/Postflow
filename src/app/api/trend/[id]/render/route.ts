/**
 * POST /api/trend/[id]/render
 *
 * Starts parallel A/B Shotstack renders for a selected concept.
 *
 *   Version A — Trend-first: trend pacing/hook/structure takes precedence
 *   Version B — Brand-first: brand tokens fully control all decisions
 *
 * Body:
 *   conceptId  — trend_concepts.id UUID
 *
 * Flow:
 *   1. Load job + concept
 *   2. Build Version A render spec (trend tokens)
 *   3. Build Version B render spec (brand tokens)
 *   4. Submit both to Shotstack in parallel
 *   5. Store render IDs on the job, mark selected_concept_id + status = 'rendering'
 *   6. Return { ok: true, renderAId, renderBId }
 */

import { NextRequest, NextResponse }  from "next/server"
import { createClient }               from "@/lib/supabase/server"
import { getBrand }                   from "@/lib/server/brand/getBrand"
import { getBrandContext }            from "@/lib/server/brand/getBrandContext"
import { getVersionTokens }           from "@/lib/server/trends/trend-filter"
import { assembleBrandedRender }      from "@/lib/server/render/brand-assembler"
import { submitRender }               from "@/lib/server/render/shotstack"
import { selectMusicTracks, resolveTrackUrl } from "@/lib/server/music/music-selector"
import type { TrendConcept }          from "@/lib/server/trends/trend-filter"
import type { BrandKit, ClipInput }   from "@/lib/server/render/brand-assembler"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

interface RenderBody {
  conceptId: string
}

export async function POST(
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

    const body = await req.json() as RenderBody
    const { conceptId } = body

    if (!conceptId) return NextResponse.json({ error: "conceptId is required" }, { status: 400 })

    // ── Load job ──────────────────────────────────────────────────────────────
    const { data: job, error: jobError } = await (nt(supabase))
      .from("trend_builder_jobs")
      .select("id, brand_id, status")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (jobError || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const j = job as { id: string; brand_id: string; status: string }
    if (!["pending_concept", "generating_concepts"].includes(j.status)) {
      return NextResponse.json({ error: `Job in '${j.status}' state — cannot start render` }, { status: 409 })
    }

    // ── Load concept ──────────────────────────────────────────────────────────
    const { data: concept, error: conceptError } = await (nt(supabase))
      .from("trend_concepts")
      .select("id, brand_id, title, description, platform, brand_fit_score, format_spec")
      .eq("id", conceptId)
      .eq("job_id", jobId)
      .maybeSingle()

    if (conceptError || !concept) return NextResponse.json({ error: "Concept not found" }, { status: 404 })

    type ConceptRow = {
      id: string; brand_id: string; title: string; description: string
      platform: string; brand_fit_score: number
      format_spec: {
        goal: string; duration_sec: number; hook_style: string; pacing: string
        music_energy: string; cta_text: string; sections: string[]
        hook_text: string; trending_reason: string; sound_vibe: string
        clip_paths: string[]; signed_urls: (string | null)[]
        clip_durations: number[]; brand_kit_snapshot: BrandKit | null
      }
    }
    const c = concept as ConceptRow

    // ── Brand context ─────────────────────────────────────────────────────────
    const ctx = await getBrandContext(brand.id, c.platform)
    if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

    // ── Build trend concept object for version tokens ──────────────────────────
    const trendConcept: TrendConcept = {
      concept_index:   0,
      title:           c.title,
      description:     c.description,
      platform:        c.platform,
      niche_trend_id:  null,
      brand_fit_score: c.brand_fit_score,
      hook_text:       c.format_spec.hook_text,
      trending_reason: c.format_spec.trending_reason,
      sound_vibe:      c.format_spec.sound_vibe,
      format_spec:     c.format_spec,
    }

    const { versionA, versionB } = getVersionTokens(trendConcept, ctx)

    // ── Build clip inputs from stored signed URLs ─────────────────────────────
    const signedUrls  = c.format_spec.signed_urls  ?? []
    const durations   = c.format_spec.clip_durations ?? []

    const clipInputs: ClipInput[] = signedUrls
      .map((url, i): ClipInput | null => {
        if (!url) return null
        return {
          publicUrl:       url,
          durationSeconds: durations[i] ?? 5,
          hookText:        i === 0 ? versionA.hookText : undefined,
          ctaText:         i === (signedUrls.length - 1) ? versionA.ctaText : undefined,
        }
      })
      .filter((c): c is ClipInput => c !== null)

    if (!clipInputs.length) return NextResponse.json({ error: "No valid clip URLs available" }, { status: 400 })

    // ── Select music for each version ─────────────────────────────────────────
    const tokens = ctx.intelligence_tokens
    const musicGenre = (tokens.music_genre?.value as string | undefined) ?? "modern_electronic"
    const tracksA = selectMusicTracks(versionA.music_energy, musicGenre, c.platform)
    const tracksB = selectMusicTracks(versionB.music_energy, musicGenre, c.platform)

    // Verify the top track for each version actually resolves before wiring it
    // into the render spec. The curated library still has placeholder
    // /tracks/*.mp3 paths that were never uploaded — including one in a
    // Shotstack render spec would make the render fail on a missing asset.
    // Fail soft: render without a soundtrack for that version instead.
    const musicA = resolveTrackUrl(tracksA[0]?.full_url)
    const musicB = resolveTrackUrl(tracksB[0]?.full_url)
    if (tracksA[0] && !musicA) console.warn(`[trend/render] music track did not resolve, skipping (version A): ${tracksA[0].full_url}`)
    if (tracksB[0] && !musicB) console.warn(`[trend/render] music track did not resolve, skipping (version B): ${tracksB[0].full_url}`)

    const brandKit = c.format_spec.brand_kit_snapshot

    // ── Build Version A render spec (trend-first) ─────────────────────────────
    const specA = assembleBrandedRender({
      clips:            clipInputs.map((cl, i) => ({
        ...cl,
        hookText: i === 0 ? versionA.hookText : undefined,
        ctaText:  i === clipInputs.length - 1 ? versionA.ctaText : undefined,
      })),
      platform:         c.platform,
      goal:             c.format_spec.goal,
      brandKit,
      textOverlayStyle: versionA.text_overlay_style,
      music:            musicA ? { src: musicA, volume: 0.4 } : undefined,
    })

    // ── Build Version B render spec (brand-first) ─────────────────────────────
    const specB = assembleBrandedRender({
      clips:            clipInputs.map((cl, i) => ({
        ...cl,
        hookText: i === 0 ? versionB.hookText : undefined,
        ctaText:  i === clipInputs.length - 1 ? versionB.ctaText : undefined,
      })),
      platform:         c.platform,
      goal:             c.format_spec.goal,
      brandKit,
      textOverlayStyle: versionB.text_overlay_style,
      music:            musicB ? { src: musicB, volume: 0.4 } : undefined,
    })

    // ── Submit both to Shotstack in parallel ──────────────────────────────────
    const [resultA, resultB] = await Promise.allSettled([
      submitRender(specA),
      submitRender(specB),
    ])

    const renderAId = resultA.status === "fulfilled" ? resultA.value.renderId : null
    const renderBId = resultB.status === "fulfilled" ? resultB.value.renderId : null

    if (!renderAId && !renderBId) {
      return NextResponse.json({ error: "Both render submissions failed" }, { status: 500 })
    }

    // ── Update job ────────────────────────────────────────────────────────────
    await (nt(supabase))
      .from("trend_builder_jobs")
      .update({
        status:                "rendering",
        render_progress:       0,
        selected_concept_id:   conceptId,
        // Store render IDs in token snapshots (reusing available JSONB columns)
        version_a_tokens_snapshot: {
          ...ctx.intelligence_tokens,
          _render_id: renderAId,
          _version:   "trend-first",
        },
        version_b_tokens_snapshot: {
          ...ctx.intelligence_tokens,
          _render_id: renderBId,
          _version:   "brand-first",
        },
      })
      .eq("id", jobId)

    // Mark concept as selected
    await (nt(supabase))
      .from("trend_concepts")
      .update({ selected: true })
      .eq("id", conceptId)

    return NextResponse.json({ ok: true, renderAId, renderBId })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trend/render] error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
