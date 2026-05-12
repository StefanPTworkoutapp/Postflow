/**
 * PATCH /api/templates/health/[id]
 *
 * Toggle locked_by_user on a template_health row.
 * Locked templates are excluded from automatic suggestion generation.
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

  const body = await req.json().catch(() => ({})) as { locked?: boolean }

  if (typeof body.locked !== "boolean") {
    return NextResponse.json({ error: "Must provide { locked: boolean }" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("template_health")
    .update({ locked_by_user: body.locked })
    .eq("id", id)
    .eq("brand_id", brand.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, locked: body.locked })
}
