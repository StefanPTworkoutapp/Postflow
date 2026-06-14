/**
 * GET  /api/brands/[id]/templates          — list all template slots grouped by post_type
 * POST /api/brands/[id]/templates          — add a template slot
 * DELETE /api/brands/[id]/templates        — remove a template slot
 * PATCH /api/brands/[id]/templates/[slot]  — toggle lock (handled separately)
 *
 * Plan enforcement:
 *   - Add slot: check templateSlotsPerPostType limit for user's plan
 *   - Lock:     check templateLockSlots limit
 */

import { NextResponse }        from "next/server"
import { createClient }        from "@/lib/supabase/server"
import { getLimits }           from "@/lib/server/billing/plans"
import { addTemplateSlot, removeTemplateSlot, toggleSlotLock } from "@/lib/server/render/selectTemplate"

// ── Auth + ownership ──────────────────────────────────────────────────────────

async function guardBrand(brandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const { data: brand } = await supabase
    .from("brands")
    .select("id, account_id")
    .eq("id", brandId)
    .single()

  if (!brand) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, subscription_tier")
    .eq("id", user.id)
    .single()

  if (brand.account_id !== account?.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }

  return { supabase, user, account, brand, error: null }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const g = await guardBrand(id)
  if (g.error) return g.error

  const { data, error } = await g.supabase!
    .from("brand_template_preferences")
    .select("id, post_type, template_slug, slot_index, locked, created_at")
    .eq("brand_id", id)
    .order("post_type")
    .order("slot_index")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Group by post_type for easier consumption in the UI
  const grouped: Record<string, Array<{ id: string; template_slug: string; slot_index: number; locked: boolean }>> = {}
  for (const row of data ?? []) {
    if (!grouped[row.post_type]) grouped[row.post_type] = []
    grouped[row.post_type].push({ id: row.id, template_slug: row.template_slug, slot_index: row.slot_index, locked: row.locked })
  }

  const tier   = (g.account as { subscription_tier?: string })?.subscription_tier ?? "free"
  const limits = getLimits(tier)

  return NextResponse.json({
    slots: grouped,
    limits: {
      slotsPerPostType: limits.templateSlotsPerPostType,
      lockSlots:        limits.templateLockSlots,
    },
  })
}

// ── POST — add a slot ────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const g = await guardBrand(id)
  if (g.error) return g.error

  const body = await req.json() as { post_type: string; template_slug: string }
  if (!body.post_type || !body.template_slug) {
    return NextResponse.json({ error: "post_type and template_slug required" }, { status: 400 })
  }

  // Check plan limit
  const tier   = (g.account as { subscription_tier?: string })?.subscription_tier ?? "free"
  const limits = getLimits(tier)

  const { data: existing } = await g.supabase!
    .from("brand_template_preferences")
    .select("slot_index")
    .eq("brand_id", id)
    .eq("post_type", body.post_type)
    .order("slot_index", { ascending: true })

  const currentCount = existing?.length ?? 0
  if (currentCount >= limits.templateSlotsPerPostType) {
    return NextResponse.json({
      error:       "slot_limit_reached",
      limit:       limits.templateSlotsPerPostType,
      plan:        tier,
      upgradeHint: `Upgrade to Pro+ to save up to 3 templates per post type`,
    }, { status: 403 })
  }

  // Find next available slot_index
  const usedIndexes = new Set((existing ?? []).map(r => r.slot_index))
  let nextIndex = 0
  while (usedIndexes.has(nextIndex)) nextIndex++

  await addTemplateSlot(id, body.post_type, body.template_slug, nextIndex)

  return NextResponse.json({ ok: true, slot_index: nextIndex })
}

// ── DELETE — remove a slot ────────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const g = await guardBrand(id)
  if (g.error) return g.error

  const body = await req.json() as { post_type: string; slot_index: number }
  if (!body.post_type || body.slot_index === undefined) {
    return NextResponse.json({ error: "post_type and slot_index required" }, { status: 400 })
  }

  await removeTemplateSlot(id, body.post_type, body.slot_index)
  return NextResponse.json({ ok: true })
}

// ── PATCH — toggle lock ───────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const g = await guardBrand(id)
  if (g.error) return g.error

  const body = await req.json() as { post_type: string; slot_index: number; locked: boolean }
  if (!body.post_type || body.slot_index === undefined || body.locked === undefined) {
    return NextResponse.json({ error: "post_type, slot_index, and locked required" }, { status: 400 })
  }

  // Check lock limit when locking
  if (body.locked) {
    const tier   = (g.account as { subscription_tier?: string })?.subscription_tier ?? "free"
    const limits = getLimits(tier)

    if (limits.templateLockSlots === 0) {
      return NextResponse.json({
        error:       "lock_not_available",
        plan:        tier,
        upgradeHint: "Upgrade to Pro to lock template slots",
      }, { status: 403 })
    }

    const { data: lockedSlots } = await g.supabase!
      .from("brand_template_preferences")
      .select("slot_index")
      .eq("brand_id", id)
      .eq("post_type", body.post_type)
      .eq("locked", true)

    if ((lockedSlots?.length ?? 0) >= limits.templateLockSlots) {
      return NextResponse.json({
        error:       "lock_limit_reached",
        limit:       limits.templateLockSlots,
        plan:        tier,
        upgradeHint: `Your plan allows ${limits.templateLockSlots} locked slot${limits.templateLockSlots > 1 ? "s" : ""} per post type`,
      }, { status: 403 })
    }
  }

  await toggleSlotLock(id, body.post_type, body.slot_index, body.locked)
  return NextResponse.json({ ok: true })
}
