import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Root page — session-aware routing.
 *
 * Authenticated   → /dashboard  (straight into the app)
 * Unauthenticated → /join       (public landing page)
 *
 * This means postflowsocials.app/ always shows something useful:
 * logged-in users drop into their workspace; visitors see the landing page.
 */
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  redirect("/join")
}
