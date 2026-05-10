/**
 * PATCH /api/brands/[id]
 *
 * Partial update for a single brand field.
 * Only allows a safe allowlist of fields to prevent mass-assignment attacks.
 * Used by the tone suggestion dismiss card, and available for future light updates.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database.types"

type BrandsUpdate = Database["postflow"]["Tables"]["brands"]["Update"]

// Fields that can be patched via this route
const ALLOWED_FIELDS = new Set([
  "tone_suggestion",
  "tone_suggestion_type",
  "tone_suggestion_at",
  "template_style",
])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Verify the brand belongs to this user's account
  const { data: brand } = await supabase
    .from("brands")
    .select("id, account_id")
    .eq("id", id)
    .single()

  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", user.id)
    .single()

  if (brand.account_id !== account?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()

  // Strip any fields not in the allowlist
  const rawUpdates: Partial<BrandsUpdate> = {}
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      (rawUpdates as Record<string, unknown>)[key] = value
    }
  }

  if (!Object.keys(rawUpdates).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const updates: BrandsUpdate = { ...rawUpdates, updated_at: new Date().toISOString() }

  const { data, error } = await supabase
    .from("brands")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ brand: data })
}
