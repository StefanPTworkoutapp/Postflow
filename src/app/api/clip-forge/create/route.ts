/**
 * POST /api/clip-forge/create
 *
 * Creates a clip-forge job, analyses clips with Claude Vision,
 * generates 3 music track options, and returns the job for the client
 * to display the MusicPicker before the render is submitted.
 *
 * Flow:
 *   1. Validate inputs + brand
 *   2. Create clip_forge_jobs row (status = 'analysing')
 *   3. Create clip_forge_clips rows with storage paths
 *   4. Generate signed read URLs for each clip (for later render)
 *   5. Analyse each clip frame in parallel via Claude Vision
 *   6. Sort clips by best_order
 *   7. Select 3 music track options from brand tokens
 *   8. Update job status = 'pending_music'
 *   9. Return { jobId, musicTracks, clipAnalyses, sortedClipPaths }
 *
 * The client shows MusicPicker, then calls POST /api/clip-forge/[id]/render
 * with the chosen music track to start the Shotstack render.
 */

import { NextResponse }          from "next/server"
import { createClient }          from "@/lib/supabase/server"
import { createServiceClient }   from "@/lib/supabase/service"
import { getBrand }              from "@/lib/server/brand/getBrand"
import { getBrandContext }       from "@/lib/server/brand/getBrandContext"
import { analyseClip, sortClipsByOrder } from "@/lib/server/ai/clip-analyzer"
import { selectMusicTracks }     from "@/lib/server/music/music-selector"
import type { ClipAnalysis }     from "@/lib/server/ai/clip-analyzer"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

interface CreateJobBody {
  goal:     string
  platform: string
  /** Storage paths returned by /api/clip-forge/upload-url */
  clips: Array<{
    path:     string
    duration: number  // seconds (provided by client from video metadata)
    /** Optional base64 JPEG data URI of a representative frame for Vision analysis */
    frameDataUri?: string
  }>
  hookText?: string
  ctaText?:  string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await req.json() as CreateJobBody
    const { goal, platform, clips, hookText, ctaText } = body

    if (!goal?.trim())    return NextResponse.json({ error: "goal is required" }, { status: 400 })
    if (!platform?.trim()) return NextResponse.json({ error: "platform is required" }, { status: 400 })
    if (!clips?.length)   return NextResponse.json({ error: "At least one clip is required" }, { status: 400 })
    if (clips.length > 10) return NextResponse.json({ error: "Maximum 10 clips per video" }, { status: 400 })

    // ── 1. Brand context ──────────────────────────────────────────────────────
    const ctx = await getBrandContext(brand.id, platform)
    if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

    const tokens = ctx.intelligence_tokens

    // ── 2. Snapshot brand kit for this render ─────────────────────────────────
    const brandRecord = brand as unknown as Record<string, unknown>
    const brandKitSnapshot = (brandRecord.brand_kit ?? null) as Record<string, unknown> | null
    const brandTokensSnapshot = tokens

    // ── 3. Create the job row ─────────────────────────────────────────────────
    const { data: job, error: jobError } = await (nt(supabase))
      .from("clip_forge_jobs")
      .insert({
        brand_id:              brand.id,
        status:                "analysing",
        goal:                  goal.trim(),
        platform:              platform.trim(),
        input_clips:           clips.map((c, i) => ({ storage_path: c.path, duration_seconds: c.duration, order: i })),
        brand_kit_snapshot:    brandKitSnapshot,
        brand_tokens_snapshot: brandTokensSnapshot,
      })
      .select("id")
      .single()

    if (jobError || !job) {
      console.error("[clip-forge/create] job insert failed:", jobError)
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 })
    }

    const jobId = (job as { id: string }).id

    // ── 4. Create clip rows ───────────────────────────────────────────────────
    const clipInserts = clips.map((c, i) => ({
      job_id:           jobId,
      storage_path:     c.path,
      upload_status:    "ready",
      duration_seconds: c.duration,
      order_index:      i,
    }))

    const { data: clipRows, error: clipsError } = await (nt(supabase))
      .from("clip_forge_clips")
      .insert(clipInserts)
      .select("id, storage_path, order_index, duration_seconds")

    if (clipsError) {
      console.error("[clip-forge/create] clips insert failed:", clipsError)
      return NextResponse.json({ error: "Failed to save clips" }, { status: 500 })
    }

    // ── 5. Generate signed read URLs via service client ───────────────────────
    const serviceSupabase = createServiceClient()
    const signedUrlResults = await Promise.allSettled(
      clips.map(c =>
        serviceSupabase.storage
          .from("postflow-clips")
          .createSignedUrl(c.path, 3600 * 2)  // 2h — enough for render + preview
      )
    )

    const publicUrls: (string | null)[] = signedUrlResults.map(r =>
      r.status === "fulfilled" && !r.value.error ? r.value.data!.signedUrl : null
    )

    // Update clip rows with public URLs
    await Promise.allSettled(
      (clipRows as Array<{ id: string }>).map((clip, i) =>
        publicUrls[i]
          ? (nt(supabase))
              .from("clip_forge_clips")
              .update({ public_url: publicUrls[i] })
              .eq("id", clip.id)
          : Promise.resolve()
      )
    )

    // ── 6. Analyse clips in parallel with Claude Vision ───────────────────────
    const analyses: (ClipAnalysis | null)[] = await Promise.all(
      clips.map(async (c, i) => {
        const frameUrl = c.frameDataUri ?? publicUrls[i]
        if (!frameUrl) return null
        try {
          return await analyseClip(frameUrl, i, goal)
        } catch {
          return null
        }
      })
    )

    // Update clip_forge_clips with quality scores
    await Promise.allSettled(
      (clipRows as Array<{ id: string }>).map((clip, i) => {
        const a = analyses[i]
        if (!a) return Promise.resolve()
        return (nt(supabase))
          .from("clip_forge_clips")
          .update({ quality_score: a.quality_score })
          .eq("id", clip.id)
      })
    )

    // ── 7. Sort clips by AI-recommended order ─────────────────────────────────
    const clipsWithAnalysis = (clipRows as Array<{ id: string; storage_path: string; order_index: number; duration_seconds: number }>)
      .map((c, i) => ({
        id:          c.id,
        order_index: c.order_index,
        analysis:    analyses[i],
      }))

    const sortedClipIds = sortClipsByOrder(clipsWithAnalysis)

    // Map sorted IDs back to clip inputs (public URLs + durations)
    const sortedClips = sortedClipIds.map(id => {
      const rowIdx = (clipRows as Array<{ id: string; order_index: number; duration_seconds: number }>).findIndex(c => c.id === id)
      return {
        id,
        publicUrl:        publicUrls[rowIdx] ?? "",
        durationSeconds:  clips[rowIdx]?.duration ?? 5,
        storagePathIndex: rowIdx,
      }
    })

    // ── 8. Select 3 music track options from brand tokens ─────────────────────
    const musicEnergy = (tokens.music_energy?.value as string | undefined) ?? "medium_high"
    const musicGenre  = (tokens.music_genre?.value  as string | undefined) ?? "modern_electronic"
    const musicTracks = selectMusicTracks(musicEnergy, musicGenre, platform)

    // ── 9. Generate caption + hashtags ────────────────────────────────────────
    const { generateClipCaption } = await import("@/lib/server/ai/clip-caption-generator")

    // Best hook/CTA come from the first/last clip inputs
    const firstClipHookText = hookText ?? undefined
    const lastClipCtaText   = ctaText  ?? undefined

    const captionResult = await generateClipCaption(
      ctx,
      goal,
      platform,
      firstClipHookText,
      lastClipCtaText,
    ).catch(() => ({ caption: "", hashtags: [] as string[] }))

    // ── 10. Update job to pending_music ───────────────────────────────────────
    await (nt(supabase))
      .from("clip_forge_jobs")
      .update({
        status:           "pending_music",
        output_caption:   captionResult.caption   || null,
        output_hashtags:  captionResult.hashtags  || null,
      })
      .eq("id", jobId)

    return NextResponse.json({
      jobId,
      musicTracks,
      sortedClips,
      clipAnalyses:   analyses,
      caption:        captionResult.caption,
      hashtags:       captionResult.hashtags,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[clip-forge/create] unexpected error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
