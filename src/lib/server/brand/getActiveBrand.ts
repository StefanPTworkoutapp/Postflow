import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

const ACTIVE_BRAND_COOKIE = "pf_active_brand"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * Resolves the active brand for the current user:
 *   1. If the `pf_active_brand` cookie is set and points to a brand owned by
 *      the user, return that brand.
 *   2. Otherwise fall back to the oldest brand for the user, set the cookie
 *      so subsequent requests are stable, and return it.
 *   3. If the user has no brands, return null.
 *
 * Setting the cookie inside this server-side helper means callers (server
 * components) get a stable active brand from the very first request.
 */
export async function getActiveBrand() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value

  // ── Try the cookie first ──────────────────────────────────────────────────
  if (cookieValue) {
    const { data: owned } = await supabase
      .from("brands")
      .select("id")
      .eq("id", cookieValue)
      .eq("account_id", user.id)
      .maybeSingle()

    if (owned) {
      const { data: full } = await supabase
        .from("brands")
        .select("*")
        .eq("id", cookieValue)
        .single()

      if (full) return full
    }
  }

  // ── Fallback: oldest brand ────────────────────────────────────────────────
  const { data: fallback } = await supabase
    .from("brands")
    .select("*")
    .eq("account_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!fallback) return null

  // Persist the cookie so future requests resolve in one query. This may
  // throw silently if invoked from a pure server component — the Supabase
  // cookies helper in createClient swallows the same error, so this is fine.
  try {
    cookieStore.set(ACTIVE_BRAND_COOKIE, fallback.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    })
  } catch {
    // Server components can't write cookies; the API route or layout will set it.
  }

  return fallback
}

export const PF_ACTIVE_BRAND_COOKIE = ACTIVE_BRAND_COOKIE
export const PF_ACTIVE_BRAND_MAX_AGE = COOKIE_MAX_AGE
