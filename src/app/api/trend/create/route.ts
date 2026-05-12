/**
 * POST /api/trend/create
 *
 * Creates a trend builder job, generates 3 trend-aligned video concepts,
 * and returns them for the ConceptCard picker.
 *
 * The user then picks a concept, which triggers POST /api/trend/[id]/render
 * to start the parallel A/B Shotstack renders.
 *
 * Body:
 *   platform   — target platform
 *   clips      — array of { path, duration, frameDataUri? } (from ClipDropzone)
 *
 * Returns: { jobId, concepts[] }
 */

import { NextResponse }           from "next/server"
import { createClient }           from "@/lib/supabase/server"
import { createServiceClient }    from "@/lib/supabase/service"
import { getBrand }               from "@/lib/server/brand/getBrand"
import { getBrandContext }        from "@/lib/server/brand/getBrandContext"
import { generateTrendConcepts }  from "@/lib/server/trends/trend-filter"
import type { TrendConcept }      from "@/lib/server/trends/trend-filter"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

interface CreateBody {
  platform: string
  clips: Array<{
    path:          string
    duration:      number
    frameDataUri?: string
  }>
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await req.json() as CreateBody
    const { platform, clips } = body

    if (!platform?.trim()) return NextResponse.json({ error: "platform is required" }, { status: 400 })
    if (!clips?.length)    return NextResponse.json({ error: "At least one clip is required" }, { status: 400 })

    // ── Brand context ─────────────────────────────────────────────────────────
    const ctx = await getBrandContext(brand.id, platform)
    if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

    const brandRecord = brand as unknown as Record<string, unknown>
    const brandKitSnapshot      = (brandRecord.brand_kit ?? null) as Record<string, unknown> | null
    const brandTokensSnapshot   = ctx.intelligence_tokens

    // ── Generate signed URLs for clips ────────────────────────────────────────
    const serviceSupabase = createServiceClient()
    const signedUrls: (string | null)[] = await Promise.all(
      clips.map(async c => {
        const { data, error } = await serviceSupabase.storage
          .from("postflow-clips")
          .createSignedUrl(c.path, 3600 * 4)
        return (!error && data) ? data.signedUrl : null
      })
    )

    // ── Create job row ────────────────────────────────────────────────────────
    const { data: job, error: jobError } = await (nt(supabase))
      .from("trend_builder_jobs")
      .insert({
        brand_id:              brand.id,
        status:                "generating_concepts",
        version_a_tokens_snapshot: brandTokensSnapshot,
        version_b_tokens_snapshot: brandTokensSnapshot,
      })
      .select("id")
      .single()

    if (jobError || !job) {
      console.error("[trend/create] job insert failed:", jobError)
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 })
    }

    const jobId = (job as { id: string }).id

    // ── Generate concepts ─────────────────────────────────────────────────────
    const concepts = await generateTrendConcepts(ctx, platform)

    // ── Persist concepts ──────────────────────────────────────────────────────
    const conceptInserts = concepts.map((c: TrendConcept) => ({
      job_id:          jobId,
      brand_id:        brand.id,
      concept_index:   c.concept_index,
      title:           c.title,
      description:     c.description,
      platform:        c.platform,
      niche_trend_id:  c.niche_trend_id,
      brand_fit_score: c.brand_fit_score,
      format_spec: {
        ...c.format_spec,
        hook_text:       c.hook_text,
        trending_reason: c.trending_reason,
        sound_vibe:      c.sound_vibe,
        clip_paths:      clips.map(cl => cl.path),
        signed_urls:     signedUrls,
        clip_durations:  clips.map(cl => cl.duration),
        brand_kit_snapshot: brandKitSnapshot,
      },
    }))

    const { data: savedConcepts, error: conceptsError } = await (nt(supabase))
      .from("trend_concepts")
      .insert(conceptInserts)
      .select("id, concept_index, title, description, platform, brand_fit_score, format_spec")

    if (conceptsError) {
      console.error("[trend/create] concepts insert failed:", conceptsError)
    }

    // ── Update job status ─────────────────────────────────────────────────────
    await (nt(supabase))
      .from("trend_builder_jobs")
      .update({ status: "pending_concept" })
      .eq("id", jobId)

    // Attach DB id to each concept
    type SavedConcept = { id: string; concept_index: number }
    const conceptsWithIds = concepts.map(c => ({
      ...c,
      id: (savedConcepts as SavedConcept[] | null)?.find(s => s.concept_index === c.concept_index)?.id ?? null,
    }))

    return NextResponse.json({ jobId, concepts: conceptsWithIds })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[trend/create] unexpected error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
