/**
 * POST /api/trend/[id]/pick
 *
 * User picks version A (trend-first) or version B (brand-first).
 * Records chosen_version on the job and nudges brand tokens based on the choice.
 *
 * Token nudge logic (from spec §8.4):
 *   - Version A picked (trend): nudge toward trend structure (+0.05 on pacing, hook_style, music_energy)
 *   - Version B picked (brand): reinforce current brand tokens (+0.05 confidence on same keys)
 *
 * Body: { version: 'a' | 'b' }
 * Returns: { ok: true, chosenVersion }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"
import { nudgeToken }                from "@/lib/server/brand/nudge-token"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) => client as any

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

    const body = await req.json() as { version?: string }
    const { version } = body

    if (version !== "a" && version !== "b") {
      return NextResponse.json({ error: "version must be 'a' or 'b'" }, { status: 400 })
    }

    // ── Load job ──────────────────────────────────────────────────────────────
    const { data: job, error: jobError } = await (nt(supabase))
      .from("trend_builder_jobs")
      .select("id, brand_id, status, chosen_version, selected_concept_id, version_a_tokens_snapshot, version_b_tokens_snapshot")
      .eq("id", jobId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (jobError || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    type JobRow = {
      id: string; brand_id: string; status: string; chosen_version: string | null
      selected_concept_id: string | null
      version_a_tokens_snapshot: Record<string, unknown> | null
      version_b_tokens_snapshot: Record<string, unknown> | null
    }
    const j = job as JobRow

    if (!["ready", "approved"].includes(j.status)) {
      return NextResponse.json({ error: `Job in '${j.status}' state — cannot pick version yet` }, { status: 409 })
    }

    if (j.chosen_version) {
      return NextResponse.json({ error: "Version already chosen" }, { status: 409 })
    }

    // ── Update job ────────────────────────────────────────────────────────────
    await (nt(supabase))
      .from("trend_builder_jobs")
      .update({ chosen_version: version })
      .eq("id", jobId)

    // ── Nudge brand tokens based on choice ────────────────────────────────────
    // Load concept to get trend spec
    const { data: concept } = await (nt(supabase))
      .from("trend_concepts")
      .select("format_spec")
      .eq("id", j.selected_concept_id)
      .maybeSingle()

    const spec = (concept as { format_spec?: Record<string, unknown> } | null)?.format_spec

    if (spec && version === "a") {
      // User preferred trend-first → nudge toward trend structure
      const nudgePromises = [
        nudgeToken(brand.id, "pacing",       String(spec.pacing       ?? "medium"),      +0.05, "feedback", jobId),
        nudgeToken(brand.id, "hook_style",   String(spec.hook_style   ?? "fast_question"),+0.05, "feedback", jobId),
        nudgeToken(brand.id, "music_energy", String(spec.music_energy ?? "medium_high"), +0.05, "feedback", jobId),
      ]
      await Promise.allSettled(nudgePromises)
    } else if (spec && version === "b") {
      // User preferred brand-first → reinforce existing brand tokens
      const tokensSnap = j.version_b_tokens_snapshot ?? {}
      const getNudgeKeys = ["pacing", "hook_style", "music_energy", "text_overlay_style"] as const
      const nudgePromises = getNudgeKeys.map(key => {
        const t = (tokensSnap as Record<string, { value: unknown } | undefined>)[key]
        if (!t?.value) return Promise.resolve()
        return nudgeToken(brand.id, key, String(t.value), +0.05, "feedback", jobId)
      })
      await Promise.allSettled(nudgePromises)
    }

    return NextResponse.json({ ok: true, chosenVersion: version })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
