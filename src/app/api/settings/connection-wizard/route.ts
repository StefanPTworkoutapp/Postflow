/**
 * GET/PATCH /api/settings/connection-wizard
 *
 * Persists progress through the guided "connect all platforms" wizard
 * (ConnectWizardModal) per brand + platform, so closing the overlay mid-flow
 * and reopening it later (even from a different device) can offer
 * "Continue at step N or start over?" instead of losing progress.
 *
 * Backed by postflow.connection_wizard_progress (migration
 * 20260714000007_connection_wizard_progress.sql). Degrades gracefully if that
 * migration hasn't been applied yet: GET returns an empty list, PATCH no-ops
 * with { ok: false } rather than throwing — the wizard UI just starts fresh
 * every time in that case instead of crashing.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand }     from "@/lib/server/brand/getBrand"

export interface WizardProgressRow {
  platform:     string
  current_step: number
  completed:    boolean
}

// GET — all saved progress rows for the active brand
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ progress: [] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("connection_wizard_progress")
      .select("platform, current_step, completed")
      .eq("brand_id", brand.id)

    if (error) {
      // Table not migrated yet (or other transient issue) — degrade to "no saved progress"
      console.warn("[GET /api/settings/connection-wizard] read failed (migration pending?):", error.message)
      return NextResponse.json({ progress: [] })
    }

    return NextResponse.json({ progress: (data ?? []) as WizardProgressRow[] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH — upsert one platform's progress. Body: { platform, current_step, completed? }
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No active brand" }, { status: 400 })

    const body = await request.json() as {
      platform?:     string
      current_step?: number
      completed?:    boolean
    }
    if (!body.platform) {
      return NextResponse.json({ error: "platform is required" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("connection_wizard_progress")
      .upsert(
        {
          brand_id:     brand.id,
          platform:     body.platform,
          current_step: body.current_step ?? 0,
          ...(body.completed !== undefined && { completed: body.completed }),
        },
        { onConflict: "brand_id,platform" },
      )

    if (error) {
      // Table not migrated yet — no-op rather than error out the whole wizard flow.
      console.warn("[PATCH /api/settings/connection-wizard] write failed (migration pending?):", error.message)
      return NextResponse.json({ ok: false })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
