/**
 * GET /api/auth/linkedin/callback
 *
 * LinkedIn OAuth 2.0 callback — exchanges the authorization code for an
 * access token, fetches the user's profile via the OIDC userinfo endpoint,
 * and upserts into social_accounts.
 *
 * On success/error: popup → postMessage + close, full page → redirect.
 */

import { NextRequest } from "next/server"
import { createClient }   from "@/lib/supabase/server"
import { getActiveBrand } from "@/lib/server/brand/getActiveBrand"
import { inngest }        from "@/inngest/client"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

function oauthResult(opts: {
  success:  boolean
  platform: string
  handle?:  string
  returnTo: string
  error?:   string
}): Response {
  const { success, platform, handle = "", returnTo, error = "unknown" } = opts
  const msg = success
    ? `{ type: 'pf_oauth_success', platform: '${platform}', handle: ${JSON.stringify(handle)} }`
    : `{ type: 'pf_oauth_error', platform: '${platform}', error: ${JSON.stringify(error)} }`
  const fallback = success
    ? `${REDIRECT_BASE}${returnTo}${returnTo.includes("?") ? "&" : "?"}connected=${platform}`
    : `${REDIRECT_BASE}/settings/connections?error=${encodeURIComponent(error)}`
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connecting…</title></head><body>
<script>
  if (window.opener && !window.opener.closed) {
    try { window.opener.postMessage(${msg}, '${REDIRECT_BASE}') } catch(e) {}
    window.close()
  } else {
    window.location.replace('${fallback}')
  }
</script>
<p style="font-family:system-ui,sans-serif;padding:2rem;color:#6b7280;text-align:center">
  ${success ? "Connected! You can close this window." : "Something went wrong. Redirecting…"}
</p>
</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Decode return_to from state ────────────────────────────────────────────
  const stateParam = searchParams.get("state")
  let returnTo = "/settings/connections"
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as { rt?: string }
      if (typeof decoded.rt === "string" && decoded.rt.startsWith("/")) returnTo = decoded.rt
    } catch { /* use default */ }
  }

  const err = (reason: string) => oauthResult({ success: false, platform: "linkedin", returnTo, error: reason })

  // ── LinkedIn error response ────────────────────────────────────────────────
  const liError = searchParams.get("error")
  if (liError) {
    const desc = searchParams.get("error_description") ?? liError
    console.error("[linkedin-callback] LinkedIn returned error:", liError, desc)
    return err(desc)
  }

  const code = searchParams.get("code")
  if (!code) return err("missing_code")

  // ── Auth + brand ───────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.redirect(`${REDIRECT_BASE}/login`)

  const brand = await getActiveBrand()
  if (!brand) return err("no_brand")

  const clientId     = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  const redirectUri  = `${REDIRECT_BASE}/api/auth/linkedin/callback`

  if (!clientId || !clientSecret) {
    console.error("[linkedin-callback] Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET")
    return err("server_misconfigured")
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
      return err("token_exchange_failed")
    }

    const tokenData = JSON.parse(tokenBody) as {
      access_token:       string
      expires_in?:        number
      error?:             string
      error_description?: string
    }

    if (tokenData.error) {
      console.error("[linkedin-callback] Token error:", tokenData.error, tokenData.error_description)
      return err(`li_${tokenData.error}`)
    }

    const { access_token, expires_in } = tokenData
    const expiresAt = new Date(Date.now() + (expires_in ?? 5_184_000) * 1000).toISOString()

    // ── Step 2: Fetch profile ──────────────────────────────────────────────
    // Try OIDC userinfo first (works if "Sign In with LinkedIn via OpenID Connect"
    // product is enabled). Fall back to /v2/me for just the member ID.
    let displayName = "LinkedIn user"
    let sub         = ""
    let profileUrl: string | null = null

    const oidcRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        "Authorization":    `Bearer ${access_token}`,
        "LinkedIn-Version": "202401",
      },
    })

    if (oidcRes.ok) {
      const profile = await oidcRes.json() as {
        sub?:         string
        name?:        string
        given_name?:  string
        family_name?: string
        picture?:     string
      }
      sub         = profile.sub ?? ""
      displayName = profile.name ?? (`${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim() || displayName)
      profileUrl  = profile.picture ?? null
    } else {
      // OIDC not available — fall back to basic member ID via /v2/me
      console.info("[linkedin-callback] OIDC userinfo unavailable, trying /v2/me")
      const meRes = await fetch("https://api.linkedin.com/v2/me", {
        headers: { "Authorization": `Bearer ${access_token}` },
      })
      if (meRes.ok) {
        const me = await meRes.json() as {
          id?:                  string
          localizedFirstName?:  string
          localizedLastName?:   string
        }
        sub         = me.id ?? ""
        const name  = `${me.localizedFirstName ?? ""} ${me.localizedLastName ?? ""}`.trim()
        if (name) displayName = name
      } else {
        console.warn("[linkedin-callback] /v2/me also failed:", await meRes.text())
      }
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
      return err("db_error")
    }

    console.log(`[linkedin-callback] Connected ${displayName} (sub: ${sub}) for brand ${brand.id}`)

    // Fire-and-forget feed import (P3, 2026-07-14) — never blocks the redirect.
    void inngest.send({ name: "postflow/social.connected", data: { brandId: brand.id, platform: "linkedin" } })
      .catch(e => console.error("[linkedin-callback] feed import event failed to enqueue:", e))

    return oauthResult({ success: true, platform: "linkedin", handle: displayName, returnTo })

  } catch (e) {
    console.error("[linkedin-callback] Unexpected error:", e)
    return err("unexpected")
  }
}
