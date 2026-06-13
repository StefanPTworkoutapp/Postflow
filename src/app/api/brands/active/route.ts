import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  PF_ACTIVE_BRAND_COOKIE,
  PF_ACTIVE_BRAND_MAX_AGE,
} from "@/lib/server/brand/getActiveBrand"

/**
 * PATCH /api/brands/active — switch the active brand for the current user.
 * Body: { brandId: string }
 *
 * Verifies ownership, then sets the `pf_active_brand` cookie on the response.
 * The client should reload after a 200 so server components re-read the cookie.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { brandId } = await request.json() as { brandId?: string }
    if (!brandId || typeof brandId !== "string") {
      return NextResponse.json({ error: "brandId required" }, { status: 400 })
    }

    // Verify ownership before trusting the brandId.
    const { data: owned } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("account_id", user.id)
      .maybeSingle()

    if (!owned) return NextResponse.json({ error: "Brand not found" }, { status: 404 })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(PF_ACTIVE_BRAND_COOKIE, brandId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: PF_ACTIVE_BRAND_MAX_AGE,
    })
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
