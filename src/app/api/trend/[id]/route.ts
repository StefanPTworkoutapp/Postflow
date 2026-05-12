/**
 * GET /api/trend/[id]
 *
 * Polls a trend-builder job for status and both A/B render progress.
 * When rendering: polls Shotstack for both render IDs and updates the job.
 *
 * Returns:
 *   status          — pending_concept | rendering | ready | approved | rejected | failed
 *   renderProgress  — 0–100 (average of A and B)
 *   versionAUrl     — video URL when A is done
 *   versionBUrl     — video URL when B is done
 *   chosenVersion   — 'a' | 'b' | null
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

    const { data: job, error } = await (nt(supabase))
      .from("trend_builder_jobs")
      .select("id, brand_id, status, render_progress, version_a_url, version_b_url, chosen_version, output_caption, output_hashtags, version_a_tokens_snapshot, version_b_tokens_snapshot")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (error || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    type JobRow = {
      id: string; brand_id: string; status: string; render_progress: number
      version_a_url: string | null; version_b_url: string | null
      chosen_version: string | null; output_caption: string | null
      output_hashtags: string[] | null
      version_a_tokens_snapshot: Record<string, unknown> | null
      version_b_tokens_snapshot: Record<string, unknown> | null
    }
    const j = job as JobRow

    if (j.status === "rendering") {
      const renderAId = (j.version_a_tokens_snapshot as Record<string, unknown> | null)?._render_id as string | null
      const renderBId = (j.version_b_tokens_snapshot as Record<string, unknown> | null)?._render_id as string | null

      // Poll both in parallel
      const [pollA, pollB] = await Promise.allSettled([
        renderAId ? pollRender(renderAId) : Promise.resolve(null),
        renderBId ? pollRender(renderBId) : Promise.resolve(null),
      ])

      const statusA = pollA.status === "fulfilled" ? pollA.value : null
      const statusB = pollB.status === "fulfilled" ? pollB.value : null

      const progressA = statusA?.progress ?? (j.version_a_url ? 100 : 0)
      const progressB = statusB?.progress ?? (j.version_b_url ? 100 : 0)
      const avgProgress = Math.round((progressA + progressB) / 2)

      const urlA = statusA?.status === "done" ? statusA.url : j.version_a_url
      const urlB = statusB?.status === "done" ? statusB.url : j.version_b_url

      const doneA = statusA?.status === "done" || !!j.version_a_url
      const doneB = statusB?.status === "done" || !!j.version_b_url
      const failedA = statusA?.status === "failed"
      const failedB = statusB?.status === "failed"

      // New overall status
      let newStatus = j.status
      if ((doneA || failedA) && (doneB || failedB)) {
        newStatus = (doneA || doneB) ? "ready" : "failed"
      }

      const updates: Record<string, unknown> = { render_progress: avgProgress }
      if (urlA)             updates.version_a_url = urlA
      if (urlB)             updates.version_b_url = urlB
      if (newStatus !== j.status) updates.status = newStatus

      await (nt(supabase))
        .from("trend_builder_jobs")
        .update(updates)
        .eq("id", jobId)

      return NextResponse.json({
        status:         newStatus,
        renderProgress: avgProgress,
        versionAUrl:    urlA ?? null,
        versionBUrl:    urlB ?? null,
        chosenVersion:  j.chosen_version,
        outputCaption:  j.output_caption,
        outputHashtags: j.output_hashtags,
      })
    }

    return NextResponse.json({
      status:         j.status,
      renderProgress: j.render_progress,
      versionAUrl:    j.version_a_url,
      versionBUrl:    j.version_b_url,
      chosenVersion:  j.chosen_version,
      outputCaption:  j.output_caption,
      outputHashtags: j.output_hashtags,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
