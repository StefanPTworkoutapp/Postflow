import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "postflow" },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must not contain any logic between createServerClient
  // and getUser that might cause early return
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup")
  const isPublicRoute =
    isAuthRoute ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/api/inngest") ||          // Inngest webhook — must be public
    pathname.startsWith("/api/webhooks/") ||        // Stripe/Mollie/Buffer webhooks
    pathname.startsWith("/api/billing/") ||         // Billing redirects (Stripe/Mollie)
    pathname.startsWith("/api/calendar/add")        // Magic link from trend email

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Expose pathname to server components via a request header
  supabaseResponse.headers.set("x-pathname", pathname)

  return supabaseResponse
}
