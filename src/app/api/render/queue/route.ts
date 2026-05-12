/**
 * GET /api/render/queue
 *
 * Returns active and recent (last 7 days) render jobs for the current brand.
 * Aggregates clip_forge_jobs + trend_concepts so RenderQueueDrawer has a
 * single endpoint to poll.
 */

import { NextResponse }  from "next/server"
import { createClient }  from "@/lib/supabase/server"
import { getBrand }      from "@/lib/server/brand/getBrand"
import type { RenderJob } from "@/components/shared/RenderQueueDrawer"

// Tables not yet in generated types — use any cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (c: any) => c as any

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ jobs: [] })

    const db = nt(supabase)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000).toISOString()

    // ── Clip-forge jobs ──────────────────────────────────────────────────────
    const { data: clipJobs } = await db
      .from("clip_forge_jobs")
      .select("id, status, render_url, created_at, goal, platform")
      .eq("brand_id", brand.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    // ── Trend concepts ───────────────────────────────────────────────────────
    const { data: trendJobs } = await db
      .from("trend_concepts")
      .select("id, status, render_url_a, render_url_b, created_at, hook_a")
      .eq("brand_id", brand.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    // ── Normalise to RenderJob shape ─────────────────────────────────────────
    const jobs: RenderJob[] = [
      ...((clipJobs ?? []) as Record<string, any>[]).map(j => ({
        id:        j.id as string,
        source:    "clip_forge" as const,
        title:     `${(j.goal as string | null ?? "Video").replace(/_/g, " ")} · ${j.platform ?? ""}`.trim(),
        status:    mapStatus(j.status as string),
        createdAt: j.created_at as string,
        renderUrl: (j.render_url as string | null) ?? null,
      })),
      ...((trendJobs ?? []) as Record<string, any>[]).map(j => ({
        id:        j.id as string,
        source:    "trend" as const,
        title:     (j.hook_a as string | null ?? "Trend concept").slice(0, 50),
        status:    mapStatus(j.status as string),
        createdAt: j.created_at as string,
        renderUrl: (j.render_url_a as string | null) ?? null,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ jobs })
  } catch (err) {
    console.error("[render/queue]", err)
    return NextResponse.json({ jobs: [] })
  }
}

function mapStatus(s: string): RenderJob["status"] {
  if (s === "rendering" || s === "pending" || s === "processing") return "rendering"
  if (s === "ready"     || s === "complete" || s === "done")       return "done"
  if (s === "failed"    || s === "error")                          return "error"
  return "idle"
}
