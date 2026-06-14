/**
 * GET  /api/brands/[id]/voice — full voice profile + last 20 token events
 * PATCH /api/brands/[id]/voice — update tone_profile fields + custom rules
 *
 * Plan gating:
 *   view  → all plans
 *   edit  → Starter+
 *   custom rules → Pro+
 */

import { NextResponse }     from "next/server"
import { createClient }     from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

// ── Auth helper — returns { supabase, userId, error? } ────────────────────────
async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  return { supabase, userId: user.id, error: null }
}

// ── Ownership check ───────────────────────────────────────────────────────────
async function ownsBrand(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, brandId: string) {
  const { data } = await supabase
    .from("brands")
    .select("id, account_id")
    .eq("id", brandId)
    .single()
  if (!data) return false
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", userId)
    .single()
  return data.account_id === account?.id
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, userId, error } = await auth()
  if (error) return error
  const { id } = await params
  if (!(await ownsBrand(supabase, userId!, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const [brandResult, eventsResult] = await Promise.all([
    supabase
      .from("brands")
      .select("tone_profile, tone_examples, custom_do_rules, custom_dont_rules, voice_updated_at")
      .eq("id", id)
      .single(),
    supabase
      .from("brand_token_events")
      .select("id, token_key, old_value, new_value, signal_type, delta, metadata, created_at")
      .eq("brand_id", id)
      .in("signal_type", ["manual", "calibration", "feedback", "reject"])
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  if (brandResult.error) return NextResponse.json({ error: brandResult.error.message }, { status: 400 })

  return NextResponse.json({
    voice:   brandResult.data,
    history: eventsResult.data ?? [],
  })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, userId, error } = await auth()
  if (error) return error
  const { id } = await params
  if (!(await ownsBrand(supabase, userId!, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as {
    // tone_profile sub-fields (merged, not replaced)
    do_use?:             string[]
    do_not_use?:         string[]
    signature_phrases?:  string[]
    // custom rules
    custom_do_rules?:    string | null
    custom_dont_rules?:  string | null
  }

  // Load current tone_profile
  const { data: current } = await supabase
    .from("brands")
    .select("tone_profile")
    .eq("id", id)
    .single()

  const existingProfile = (current?.tone_profile as Record<string, unknown> | null) ?? {}

  // Merge only the fields that were sent
  const mergedProfile: Record<string, unknown> = { ...existingProfile }
  if (body.do_use !== undefined)            mergedProfile.do_use            = body.do_use
  if (body.do_not_use !== undefined)        mergedProfile.do_not_use        = body.do_not_use
  if (body.signature_phrases !== undefined) mergedProfile.signature_phrases = body.signature_phrases

  // Build the brands update
  const update: Record<string, unknown> = {
    tone_profile:    mergedProfile,
    voice_updated_at: new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  }
  if ("custom_do_rules"   in body) update.custom_do_rules   = body.custom_do_rules   ?? null
  if ("custom_dont_rules" in body) update.custom_dont_rules = body.custom_dont_rules ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await supabase
    .from("brands")
    .update(update as any)
    .eq("id", id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  // Log manual edit as a brand_token_events entry (service client bypasses RLS)
  const service = createServiceClient()
  const changedFields = [
    body.do_use !== undefined && "do_use",
    body.do_not_use !== undefined && "do_not_use",
    body.signature_phrases !== undefined && "signature_phrases",
    body.custom_do_rules !== undefined && "custom_do_rules",
    body.custom_dont_rules !== undefined && "custom_dont_rules",
  ].filter(Boolean) as string[]

  await service.from("brand_token_events").insert({
    brand_id:      id,
    token_key:     "voice_profile",
    signal_type:   "manual",
    old_value:     null,
    new_value:     JSON.stringify({ changed_fields: changedFields }),
    signal_detail: { source: "brand_editor", fields: changedFields },
  })

  return NextResponse.json({ ok: true })
}
