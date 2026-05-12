/**
 * GET /api/clip-forge/[id]
 *
 * Polls a clip-forge job for status and render progress.
 * If status = 'rendering' and shotstack_render_id is set,
 * polls Shotstack and updates the job with the latest progress + output URL.
 *
 * Returns:
 *   status          — pending | pending_music | analysing | rendering | ready | approved | rejected | failed
 *   renderProgress  — 0–100
 *   outputVideoUrl  — populated when status = 'ready'
 *   outputCaption   — generated caption
 *   outputHashtags  — generated hashtags
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"
import { pollRender }                from "@/lib/server/render/shotstack"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

export async function GET(
  _req:    NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    // ── Load job ──────────────────────────────────────────────────────────────
    const { data: job, error } = await (nt(supabase))
      .from("clip_forge_jobs")
      .select("id, brand_id, status, render_progress, shotstack_render_id, output_video_url, output_caption, output_hashtags")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    type JobRow = {
      id: string
      brand_id: string
      status: string
      render_progress: number
      shotstack_render_id: string | null
      output_video_url: string | null
      output_caption: string | null
      output_hashtags: string[] | null
    }
    const j = job as JobRow

    // ── If rendering: poll Shotstack ──────────────────────────────────────────
    if (j.status === "rendering" && j.shotstack_render_id) {
      try {
        const renderStatus = await pollRender(j.shotstack_render_id)

        let newStatus = j.status
        if (renderStatus.status === "done")   newStatus = "ready"
        if (renderStatus.status === "failed") newStatus = "failed"

        const updates: Record<string, unknown> = {
          render_progress: renderStatus.progress,
        }
        if (renderStatus.url)  updates.output_video_url = renderStatus.url
        if (newStatus !== j.status) updates.status = newStatus

        await (nt(supabase))
          .from("clip_forge_jobs")
          .update(updates)
          .eq("id", jobId)

        return NextResponse.json({
          status:         newStatus,
          renderProgress: renderStatus.progress,
          outputVideoUrl: renderStatus.url ?? j.output_video_url,
          outputCaption:  j.output_caption,
          outputHashtags: j.output_hashtags,
          error:          renderStatus.error,
        })
      } catch (pollErr) {
        console.warn("[clip-forge/get] Shotstack poll failed:", pollErr)
        // Return last known state on poll failure
      }
    }

    return NextResponse.json({
      status:         j.status,
      renderProgress: j.render_progress,
      outputVideoUrl: j.output_video_url,
      outputCaption:  j.output_caption,
      outputHashtags: j.output_hashtags,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
