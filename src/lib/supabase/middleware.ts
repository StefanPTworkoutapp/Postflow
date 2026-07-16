import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"

export async function updateSession(request: NextRequest) {
  // Expose pathname to server components (layout.tsx reads it via headers()).
  // Must be set on the REQUEST headers before NextResponse.next({ request }) —
  // setting it on the response (the old bug) is invisible to server components,
  // which made (app)/layout.tsx's isOnboarding check always false and sent every
  // brand-less user into an infinite /onboarding redirect loop.
  request.headers.set("x-pathname", request.nextUrl.pathname)

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
    pathname.startsWith("/forgot-password") ||          // Public: request a reset link
    pathname.startsWith("/reset-password") ||           // Public: recovery link lands here (session arrives via the URL, no cookie yet)
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/api/inngest") ||          // Inngest webhook — must be public
    pathname.startsWith("/api/webhooks/") ||        // Stripe/Mollie/Buffer webhooks
    pathname.startsWith("/api/billing/") ||         // Billing redirects (Stripe/Mollie)
    pathname.startsWith("/api/calendar/add") ||     // Magic link from trend email
    pathname.startsWith("/api/contact") ||          // Public contact form endpoint
    pathname.startsWith("/join") ||                 // Public marketing landing page
    pathname.startsWith("/contact") ||              // Public contact page
    pathname.startsWith("/privacy") ||              // Public legal pages
    pathname.startsWith("/terms")

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

  // (x-pathname for server components is set on the REQUEST headers at the
  // top of this function — a response header here would be invisible to them.)

  return supabaseResponse
}
