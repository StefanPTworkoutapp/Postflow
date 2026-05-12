/**
 * PATCH /api/templates/suggestions/[id]
 *
 * Respond to a template suggestion: approve or dismiss.
 *
 * Approve:  sets status = 'approved', records responded_at
 * Dismiss:  sets status = 'dismissed', increments dismissed_count, records responded_at
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand }     from "@/lib/server/brand/getBrand"

export async function PATCH(
  req:     NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { action?: string }
  const action = body.action

  if (action !== "approved" && action !== "dismissed") {
    return NextResponse.json({ error: "Invalid action — must be 'approved' or 'dismissed'" }, { status: 400 })
  }

  // Verify this suggestion belongs to the brand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: suggestion, error: fetchError } = await (supabase as any)
    .from("template_suggestions")
    .select("id, brand_id, current_slug, suggested_slug, platform, dismissed_count, status")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (fetchError || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })
  }

  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "Suggestion already responded to" }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (action === "approved") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("template_suggestions")
      .update({ status: "approved", responded_at: now })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, action: "approved" })
  }

  // Dismissed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("template_suggestions")
    .update({
      status:          "dismissed",
      dismissed_count: (suggestion.dismissed_count ?? 0) + 1,
      responded_at:    now,
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, action: "dismissed" })
}
