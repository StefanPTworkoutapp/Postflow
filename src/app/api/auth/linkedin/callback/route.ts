/**
 * GET /api/auth/linkedin/callback
 *
 * LinkedIn OAuth 2.0 callback — exchanges the authorization code for an
 * access token, fetches the user's profile via the OIDC userinfo endpoint,
 * and upserts into social_accounts.
 *
 * Flow:
 *   1. Exchange code → access_token at linkedin.com/oauth/v2/accessToken
 *   2. Fetch profile: GET api.linkedin.com/v2/userinfo (OIDC)
 *   3. Upsert social_accounts (platform = "linkedin")
 *   4. Redirect → /settings/connections?connected=linkedin
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

function errorRedirect(reason: string) {
  return NextResponse.redirect(
    `${REDIRECT_BASE}/settings/connections?error=${encodeURIComponent(reason)}`
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── LinkedIn error response ────────────────────────────────────────────────
  const liError = searchParams.get("error")
  if (liError) {
    const desc = searchParams.get("error_description") ?? liError
    console.error("[linkedin-callback] LinkedIn returned error:", liError, desc)
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

  const clientId     = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  const redirectUri  = `${REDIRECT_BASE}/api/auth/linkedin/callback`

  if (!clientId || !clientSecret) {
    console.error("[linkedin-callback] Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET")
    return errorRedirect("server_misconfigured")
  }

  try {
    // ── Step 1: Exchange code for access token ─────────────────────────────
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        client_secret: clientSecret,
      }).toString(),
    })

    const tokenBody = await tokenRes.text()

    if (!tokenRes.ok) {
      console.error("[linkedin-callback] Token exchange failed:", tokenRes.status, tokenBody.slice(0, 200))
      return errorRedirect("token_exchange_failed")
    }

    const tokenData = JSON.parse(tokenBody) as {
      access_token:  string
      expires_in?:   number
      error?:        string
      error_description?: string
    }

    if (tokenData.error) {
      console.error("[linkedin-callback] Token error:", tokenData.error, tokenData.error_description)
      return errorRedirect(`li_${tokenData.error}`)
    }

    const { access_token, expires_in } = tokenData
    // LinkedIn tokens typically expire in 60 days (5_184_000 seconds)
    const expiresAt = new Date(Date.now() + (expires_in ?? 5_184_000) * 1000).toISOString()

    // ── Step 2: Fetch profile via OIDC userinfo ────────────────────────────
    let displayName = "LinkedIn user"
    let sub         = ""
    let profileUrl: string | null = null

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        "Authorization":    `Bearer ${access_token}`,
        "LinkedIn-Version": "202401",
      },
    })

    if (profileRes.ok) {
      const profile = await profileRes.json() as {
        sub?:            string
        name?:           string
        given_name?:     string
        family_name?:    string
        picture?:        string
        email?:          string
      }
      sub         = profile.sub ?? ""
      displayName = profile.name ?? (`${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim() || displayName)
      profileUrl  = profile.picture ?? null
    } else {
      console.warn("[linkedin-callback] Failed to fetch profile:", await profileRes.text())
    }

    // ── Step 3: Upsert social_accounts ────────────────────────────────────
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          brand_id:              brand.id,
          platform:              "linkedin",
          account_handle:        displayName,
          account_url:           profileUrl,
          platform_access_token: access_token,
          platform_account_id:   sub || null,
          token_expires_at:      expiresAt,
          is_active:             true,
        },
        { onConflict: "brand_id,platform" }
      )

    if (upsertError) {
      console.error("[linkedin-callback] DB upsert failed:", upsertError.message)
      return errorRedirect("db_error")
    }

    console.log(`[linkedin-callback] Connected ${displayName} (sub: ${sub}) for brand ${brand.id}`)

    return NextResponse.redirect(`${REDIRECT_BASE}/settings/connections?connected=linkedin`)

  } catch (err) {
    console.error("[linkedin-callback] Unexpected error:", err)
    return errorRedirect("unexpected")
  }
}
