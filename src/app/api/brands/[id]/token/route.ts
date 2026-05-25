/**
 * PATCH /api/brands/[id]/token
 *
 * Allows a brand owner to manually set a specific intelligence token value.
 * Writes through nudgeToken() so the audit trail is maintained.
 *
 * Body: { tokenKey: string, value: string }
 *
 * Currently supports: style_volatility_preference
 * Extend ALLOWED_TOKEN_KEYS as new manual overrides are added.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { nudgeToken } from "@/lib/server/brand/nudge-token"

// Tokens that the user is explicitly allowed to set via this endpoint.
// Confidence is set to a high value (0.95) since this is a deliberate manual choice.
const ALLOWED_TOKEN_KEYS = new Set(["style_volatility_preference"])

// A manual override is always high-confidence — the user knows what they want.
const MANUAL_CONFIDENCE = 0.95

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: brandId } = await params

  // Verify ownership
  const { data: brand } = await supabase
    .from("brands")
    .select("id, account_id")
    .eq("id", brandId)
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
  const { tokenKey, value } = body

  if (typeof tokenKey !== "string" || !ALLOWED_TOKEN_KEYS.has(tokenKey)) {
    return NextResponse.json({ error: "Invalid tokenKey" }, { status: 400 })
  }

  if (typeof value !== "string" || !value.trim()) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 })
  }

  // Write through nudgeToken — this maintains the full audit trail in brand_token_events.
  // signal_type "manual" = deliberate user choice, highest weight possible.
  // We set allowCreate:true so the token is created if it doesn't exist yet.
  await nudgeToken(
    brandId,
    tokenKey,
    value.trim(),
    MANUAL_CONFIDENCE,
    "manual",
    undefined,
    { source: "brand_settings_ui" },
    true,
  )

  return NextResponse.json({ ok: true, tokenKey, value: value.trim() })
}
