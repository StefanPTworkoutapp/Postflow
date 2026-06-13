import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateAccount } from "@/lib/server/accounts/getOrCreateAccount"
import { checkBrandLimit } from "@/lib/server/billing/checkBrandLimit"

/**
 * GET /api/brands — list all brands for the current user.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("brands")
      .select("id, name, logo_url, created_at")
      .eq("account_id", user.id)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ brands: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/brands — create a new brand under the current account.
 * Body: { name: string, industry?: string, primary_goal?: string }
 * Returns 403 with { error: "brand_limit_reached", limit, plan, upgradeTo }
 * if the user has hit their plan limit.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const account = await getOrCreateAccount()
    const body = await request.json() as {
      name?: string
      industry?: string
      primary_goal?: string
    }

    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 })
    }

    // ── Plan enforcement ───────────────────────────────────────────────────
    const limitCheck = await checkBrandLimit()
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: "brand_limit_reached",
          limit: limitCheck.limit,
          plan: limitCheck.plan,
          upgradeTo: limitCheck.upgradeTo,
          current: limitCheck.current,
        },
        { status: 403 }
      )
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from("brands")
      .insert({
        account_id:   account.id,
        name:         body.name.trim(),
        industry:     body.industry ?? null,
        primary_goal: body.primary_goal ?? null,
      })
      .select("id, name")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ brand: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
