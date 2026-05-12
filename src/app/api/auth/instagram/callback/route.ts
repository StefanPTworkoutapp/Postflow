/**
 * GET /api/auth/instagram/callback
 *
 * OAuth 2.0 callback for Instagram Business Login.
 *
 * Meta redirects here after the user completes the Instagram Business Login
 * flow. We exchange the short-lived code for a long-lived access token, then
 * store it in `social_connections` against the user's brand.
 *
 * Flow:
 *   1. User clicks "Connect Instagram" → redirected to Meta OAuth URL
 *   2. User authorises → Meta redirects to this URL with ?code=xxx&state=yyy
 *   3. We exchange code for short-lived token (POST to /oauth/access_token)
 *   4. Exchange short-lived for long-lived token (GET /access_token?grant_type=ig_exchange_token)
 *   5. Fetch basic profile (/me?fields=id,username)
 *   6. Upsert into social_connections
 *   7. Redirect to /settings/connections
 *
 * Error path:
 *   Meta sends ?error=xxx&error_description=yyy → redirect with error param
 *
 * Required env vars:
 *   INSTAGRAM_APP_ID      — from Meta App dashboard
 *   INSTAGRAM_APP_SECRET  — from Meta App dashboard
 *   NEXT_PUBLIC_APP_URL   — base URL (e.g. https://postflow-amber.vercel.app)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: any) => client as any

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Error from Meta ────────────────────────────────────────────────────────
  const metaError = searchParams.get("error")
  if (metaError) {
    const desc = searchParams.get("error_description") ?? metaError
    console.error("[instagram-callback] Meta returned error:", metaError, desc)
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=${encodeURIComponent(desc)}`
    )
  }

  // ── Auth code ──────────────────────────────────────────────────────────────
  const code = searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=missing_code`
    )
  }

  // ── Supabase session ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${REDIRECT_BASE}/login`)
  }

  const brand = await getBrand()
  if (!brand) {
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=no_brand`
    )
  }

  const appId     = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  const redirectUri = `${REDIRECT_BASE}/api/auth/instagram/callback`

  if (!appId || !appSecret) {
    console.error("[instagram-callback] INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET not set")
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=server_misconfigured`
    )
  }

  try {
    // ── Step 1: Exchange code for short-lived token ──────────────────────────
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     appId,
        client_secret: appSecret,
        grant_type:    "authorization_code",
        redirect_uri:  redirectUri,
        code,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error("[instagram-callback] Token exchange failed:", err)
      return NextResponse.redirect(
        `${REDIRECT_BASE}/settings/connections?error=token_exchange_failed`
      )
    }

    const shortToken = await tokenRes.json() as {
      access_token: string
      user_id:      number
    }

    // ── Step 2: Exchange for long-lived token (60-day) ───────────────────────
    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken.access_token}`
    )

    let accessToken = shortToken.access_token
    let expiresAt: string | null = null

    if (longTokenRes.ok) {
      const longToken = await longTokenRes.json() as {
        access_token: string
        token_type:   string
        expires_in:   number
      }
      accessToken = longToken.access_token
      expiresAt   = new Date(Date.now() + longToken.expires_in * 1000).toISOString()
    }

    // ── Step 3: Fetch profile ────────────────────────────────────────────────
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
    )

    let username = "instagram"
    let igUserId = String(shortToken.user_id)

    if (profileRes.ok) {
      const profile = await profileRes.json() as { id: string; username: string }
      username = profile.username
      igUserId = profile.id
    }

    // ── Step 4: Upsert social_connections ───────────────────────────────────
    await nt(supabase)
      .from("social_connections")
      .upsert(
        {
          brand_id:         brand.id,
          platform:         "instagram",
          account_handle:   username,
          account_url:      `https://instagram.com/${username}`,
          platform_user_id: igUserId,
          access_token:     accessToken,
          token_expires_at: expiresAt,
          is_active:        true,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: "brand_id,platform" }
      )

    console.log(`[instagram-callback] Connected @${username} (${igUserId}) for brand ${brand.id}`)

    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?connected=instagram`
    )

  } catch (err) {
    console.error("[instagram-callback] Unexpected error:", err)
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=unexpected`
    )
  }
}
