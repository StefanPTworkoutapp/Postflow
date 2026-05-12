/**
 * POST /api/inspiration/apply
 *
 * Applies the signals from a saved inspiration_posts row to the brand's
 * intelligence tokens via nudgeToken(). Marks the row as applied.
 *
 * Body:   { analysisId: string }
 * Returns: { ok: true, applied: number }  — number of tokens nudged
 *
 * Idempotent guard: if already applied, returns 409.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"
import { nudgeToken }                from "@/lib/server/brand/nudge-token"
import { createServiceClient }       from "@/lib/supabase/service"
import type { InspirationSignal }    from "@/lib/server/inspiration/analyse-post"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (x: unknown) => x as any

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    // ── Body ────────────────────────────────────────────────────────────────────
    let body: { analysisId?: string }
    try {
      body = await req.json() as { analysisId?: string }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { analysisId } = body
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId is required" }, { status: 400 })
    }

    // ── Load inspiration row ────────────────────────────────────────────────────
    const service = createServiceClient()
    const { data: row, error: fetchError } = await nt(service)
      .from("inspiration_posts")
      .select("id, brand_id, signals, applied, source_url")
      .eq("id", analysisId)
      .eq("brand_id", brand.id)
      .maybeSingle()

    if (fetchError || !row) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    type InspirationRow = {
      id:         string
      brand_id:   string
      signals:    InspirationSignal[]
      applied:    boolean
      source_url: string
    }
    const r = row as InspirationRow

    if (r.applied) {
      return NextResponse.json(
        { error: "This inspiration has already been applied." },
        { status: 409 }
      )
    }

    // ── Apply signals via nudgeToken() ──────────────────────────────────────────
    const signals: InspirationSignal[] = Array.isArray(r.signals) ? r.signals : []

    await Promise.allSettled(
      signals.map(signal =>
        nudgeToken(
          brand.id,
          signal.token_key,
          signal.value,
          signal.confidence_delta,
          "inspiration",
          analysisId,
          { source_url: r.source_url, observed_pattern: signal.observed_pattern }
        )
      )
    )

    // ── Mark as applied ─────────────────────────────────────────────────────────
    await nt(service)
      .from("inspiration_posts")
      .update({ applied: true, applied_at: new Date().toISOString() })
      .eq("id", analysisId)

    return NextResponse.json({ ok: true, applied: signals.length })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("[inspiration/apply] unexpected error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
