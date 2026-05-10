import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateAccount } from "@/lib/server/accounts/getOrCreateAccount"

/**
 * PATCH /api/onboarding/save
 * Upserts partial brand data during onboarding. Called after each step.
 * Body: Partial brand fields + optional brand_id (omit to create new).
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const account = await getOrCreateAccount()
    const body = await request.json()

    const { brand_id, ...fields } = body

    if (brand_id) {
      // Update existing brand (verify ownership)
      const { data, error } = await supabase
        .from("brands")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", brand_id)
        .eq("account_id", account.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ brand: data })
    } else {
      // Create new brand row (first step of onboarding)
      const { data, error } = await supabase
        .from("brands")
        .insert({ account_id: account.id, ...fields })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ brand: data })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
