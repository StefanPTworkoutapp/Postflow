/**
 * POST /api/clip-forge/[id]/render
 *
 * Starts the Shotstack render for a clip-forge job.
 * Called after the user selects a music track in MusicPicker.
 *
 * Body:
 *   musicSrc    — full_url of the selected track (or null for no music)
 *   musicVolume — 0–1, defaults to 0.4
 *   hookText    — optional hook text for first clip
 *   ctaText     — optional CTA for last clip
 *   captions    — optional per-clip caption strings (ordered by sortedClips)
 *
 * Flow:
 *   1. Load job + clips (ordered)
 *   2. Build AssembleSpec from brand kit snapshot + clip data
 *   3. Submit to Shotstack via assembleBrandedRender() + submitRender()
 *   4. Store render_id, update status = 'rendering'
 *   5. Return { ok: true, renderId }
 */

import { NextRequest, NextResponse }   from "next/server"
import { createClient }                from "@/lib/supabase/server"
import { getBrand }                    from "@/lib/server/brand/getBrand"
import { assembleBrandedRender }       from "@/lib/server/render/brand-assembler"
import { submitRender }                from "@/lib/server/render/shotstack"
import { transcribeClips }             from "@/lib/server/clip-forge/whisper-captions"
import { resolveTrackUrl }             from "@/lib/server/music/music-selector"
import { getRenderCreditBalance, deductRenderCredit } from "@/lib/server/billing/renderCredits"
import type { BrandKit, ClipInput, AssembleSpec } from "@/lib/server/render/brand-assembler"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

interface RenderBody {
  musicSrc?:    string | null
  musicVolume?: number
  hookText?:    string
  ctaText?:     string
  /** Per-clip captions in sorted order (same order as sortedClips from /create) */
  captions?:    string[]
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

    // ── Credit check ──────────────────────────────────────────────────────────
    const balance = await getRenderCreditBalance(user.id)
    if (balance <= 0) {
      return NextResponse.json({
        error:       "insufficient_credits",
        balance:     0,
        upgradeHint: "Purchase render credits in Settings → Billing to generate videos.",
      }, { status: 402 })
    }

    // ── Load the job ──────────────────────────────────────────────────────────
    const { data: job, error: jobError } = await (nt(supabase))
      .from("clip_forge_jobs")
      .select("id, brand_id, status, goal, platform, brand_kit_snapshot, brand_tokens_snapshot, output_caption, output_hashtags")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const j = job as {
      id: string
      brand_id: string
      status: string
      goal: string
      platform: string
      brand_kit_snapshot: BrandKit | null
      brand_tokens_snapshot: Record<string, { value: unknown; confidence: number }> | null
      output_caption: string | null
      output_hashtags: string[] | null
    }

    if (!["pending_music", "analysing"].includes(j.status)) {
      return NextResponse.json(
        { error: `Job is in '${j.status}' state — cannot start render` },
        { status: 409 }
      )
    }

    // ── Load clips ordered by order_index ─────────────────────────────────────
    const { data: clips, error: clipsError } = await (nt(supabase))
      .from("clip_forge_clips")
      .select("id, public_url, duration_seconds, order_index")
      .eq("job_id", jobId)
      .order("order_index", { ascending: true })

    if (clipsError || !clips?.length) {
      return NextResponse.json({ error: "No clips found for this job" }, { status: 400 })
    }

    const body = await req.json() as RenderBody
    const {
      musicSrc,
      musicVolume = 0.4,
      hookText,
      ctaText,
      captions = [],
    } = body

    // ── Auto-transcribe clips via Whisper (if no captions provided) ──────────
    type ClipRow = { id: string; public_url: string | null; duration_seconds: number | null; order_index: number }
    const clipRows = clips as ClipRow[]

    let resolvedCaptions: string[] = captions

    // Only auto-transcribe when caller didn't supply captions AND OPENAI_API_KEY is set
    if (!captions.length && process.env.OPENAI_API_KEY) {
      try {
        const clipUrls   = clipRows.map(c => c.public_url ?? "").filter(Boolean)
        const transcripts = await transcribeClips(clipUrls)
        resolvedCaptions  = transcripts.map(t => t.summary)
        console.log(`[clip-forge/render] Whisper transcribed ${transcripts.length} clips`)
      } catch (err) {
        console.warn("[clip-forge/render] Whisper transcription failed, proceeding without captions:", err)
      }
    }

    // ── Build clip inputs ─────────────────────────────────────────────────────
    const clipInputs: ClipInput[] = clipRows.map((c, i) => ({
      publicUrl:       c.public_url ?? "",
      durationSeconds: c.duration_seconds ?? 5,
      hookText:        i === 0 ? hookText : undefined,
      ctaText:         i === clipRows.length - 1 ? ctaText : undefined,
      captionText:     resolvedCaptions[i] ?? undefined,
    }))

    // ── Extract text_overlay_style from brand token snapshot ──────────────────
    const tokensSnap = j.brand_tokens_snapshot ?? {}
    const textOverlayStyle = (tokensSnap.text_overlay_style?.value as string | undefined) ?? "bold_center"

    // ── Verify the selected music track actually resolves before wiring it in ──
    // The curated track library still has placeholder /tracks/*.mp3 paths that
    // were never uploaded — including one of those in the render spec would
    // make Shotstack fail trying to fetch a non-existent audio file. Fail soft:
    // render WITHOUT a soundtrack instead of failing the whole render, and
    // record why so the review UI can show "rendered without music".
    const resolvedMusicSrc = resolveTrackUrl(musicSrc)
    const musicSkippedReason =
      musicSrc && !resolvedMusicSrc
        ? "Selected music track is not yet available — rendered without a soundtrack."
        : null
    if (musicSkippedReason) {
      console.warn(`[clip-forge/render] music track did not resolve, skipping: ${musicSrc}`)
    }

    // ── Assemble render spec ──────────────────────────────────────────────────
    const assembleSpec: AssembleSpec = {
      clips:            clipInputs,
      platform:         j.platform,
      goal:             j.goal,
      brandKit:         j.brand_kit_snapshot,
      textOverlayStyle,
      music: resolvedMusicSrc
        ? { src: resolvedMusicSrc, volume: musicVolume }
        : undefined,
    }

    const renderSpec  = assembleBrandedRender(assembleSpec)

    // ── Submit to Shotstack ───────────────────────────────────────────────────
    const renderResult = await submitRender(renderSpec)

    // ── Update job + deduct credit (atomically in order) ─────────────────────
    const jobUpdate: Record<string, unknown> = {
      status:               "rendering",
      render_progress:      0,
      shotstack_render_id:  renderResult.renderId,
      music_skipped_reason: musicSkippedReason,
    }
    const { error: jobUpdateErr } = await (nt(supabase))
      .from("clip_forge_jobs")
      .update(jobUpdate)
      .eq("id", jobId)

    if (jobUpdateErr) {
      // music_skipped_reason column may not exist yet (migration pending) —
      // degrade gracefully so the render itself is never blocked on this.
      console.warn(
        "[clip-forge/render] music_skipped_reason column write failed (migration pending?) — falling back:",
        jobUpdateErr.message,
      )
      await (nt(supabase))
        .from("clip_forge_jobs")
        .update({
          status:              "rendering",
          render_progress:     0,
          shotstack_render_id: renderResult.renderId,
        })
        .eq("id", jobId)
    }

    // Deduct 1 render credit now that the render has been submitted
    await deductRenderCredit({ accountId: user.id, jobId })

    return NextResponse.json({ ok: true, renderId: renderResult.renderId, creditsRemaining: balance - 1 })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[clip-forge/render] error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
