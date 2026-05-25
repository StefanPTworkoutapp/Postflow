/**
 * GET /api/auth/tiktok/callback
 *
 * TikTok OAuth 2.0 callback — exchanges the authorization code for an
 * access token (using PKCE code_verifier from cookie), fetches basic
 * user info, and upserts into social_accounts.
 *
 * Flow:
 *   1. Read code_verifier from cookie
 *   2. Exchange code + verifier → access_token at open.tiktokapis.com
 *   3. Fetch user info: open_id, display_name, avatar_url
 *   4. Upsert social_accounts (platform = "tiktok")
 *   5. Redirect → /settings/connections?connected=tiktok
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies }                   from "next/headers"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"
const TT_API        = "https://open.tiktokapis.com/v2"

function errorRedirect(reason: string) {
  return NextResponse.redirect(
    `${REDIRECT_BASE}/settings/connections?error=${encodeURIComponent(reason)}`
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── TikTok error response ──────────────────────────────────────────────────
  const ttError = searchParams.get("error")
  if (ttError) {
    const desc = searchParams.get("error_description") ?? ttError
    console.error("[tiktok-callback] TikTok returned error:", ttError, desc)
    return errorRedirect(desc)
  }

  const code = searchParams.get("code")
  if (!code) return errorRedirect("missing_code")

  // ── Auth + brand ───────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${REDIRECT_BASE}/login`)

  const brand = await getBrand()
  if (!brand) return errorRedirect("no_brand")

  const clientKey    = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  const redirectUri  = `${REDIRECT_BASE}/api/auth/tiktok/callback`

  if (!clientKey || !clientSecret) {
    console.error("[tiktok-callback] Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET")
    return errorRedirect("server_misconfigured")
  }

  // ── Read PKCE verifier from cookie ─────────────────────────────────────────
  const cookieStore   = await cookies()
  const codeVerifier  = cookieStore.get("tiktok_code_verifier")?.value
  if (!codeVerifier) {
    console.error("[tiktok-callback] Missing tiktok_code_verifier cookie")
    return errorRedirect("missing_pkce_verifier")
  }
  // Clear the cookie immediately
  cookieStore.delete("tiktok_code_verifier")

  try {
    // ── Step 1: Exchange code for access token ─────────────────────────────
    const tokenRes = await fetch(`${TT_API}/oauth/token/`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key:    clientKey,
        client_secret: clientSecret,
        code,
        grant_type:    "authorization_code",
        redirect_uri:  redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    })

    const tokenBody = await tokenRes.text()

    if (!tokenRes.ok) {
      console.error("[tiktok-callback] Token exchange failed:", tokenRes.status, tokenBody.slice(0, 200))
      return errorRedirect("token_exchange_failed")
    }

    const tokenData = JSON.parse(tokenBody) as {
      data?: {
        access_token:  string
        expires_in:    number
        open_id:       string
        refresh_token: string
      }
      error?: { code: string; message: string }
    }

    if (tokenData.error?.code && tokenData.error.code !== "ok") {
      console.error("[tiktok-callback] TikTok token error:", tokenData.error)
      return errorRedirect(`tt_${tokenData.error.code}`)
    }

    const { access_token, open_id, expires_in } = tokenData.data!
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // ── Step 2: Fetch user info ────────────────────────────────────────────
    let displayName = "TikTok user"
    let avatarUrl:  string | null = null

    const userRes = await fetch(
      `${TT_API}/user/info/?fields=open_id,display_name,avatar_url`,
      { headers: { "Authorization": `Bearer ${access_token}` } }
    )

    if (userRes.ok) {
      const userData = await userRes.json() as {
        data?: { user?: { display_name?: string; avatar_url?: string } }
      }
      displayName = userData.data?.user?.display_name ?? displayName
      avatarUrl   = userData.data?.user?.avatar_url ?? null
    }

    // ── Step 3: Upsert social_accounts ────────────────────────────────────
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          brand_id:              brand.id,
          platform:              "tiktok",
          account_handle:        displayName,
          account_url:           avatarUrl ?? null,
          platform_access_token: access_token,
          platform_account_id:   open_id,
          token_expires_at:      expiresAt,
          is_active:             true,
        },
        { onConflict: "brand_id,platform" }
      )

    if (upsertError) {
      console.error("[tiktok-callback] DB upsert failed:", upsertError.message)
      return errorRedirect("db_error")
    }

    console.log(`[tiktok-callback] Connected @${displayName} (open_id: ${open_id}) for brand ${brand.id}`)

    return NextResponse.redirect(`${REDIRECT_BASE}/settings/connections?connected=tiktok`)

  } catch (err) {
    console.error("[tiktok-callback] Unexpected error:", err)
    return errorRedirect("unexpected")
  }
}
