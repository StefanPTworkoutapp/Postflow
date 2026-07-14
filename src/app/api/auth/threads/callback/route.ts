/**
 * GET /api/auth/threads/callback
 *
 * OAuth 2.0 callback for Threads.
 *
 * Meta redirects here after the user completes the Threads authorization
 * flow. We exchange the short-lived code for a short-lived token, exchange
 * that for a long-lived token (60-day), fetch the Threads profile, then
 * upsert into `social_accounts`.
 *
 * Flow:
 *   1. Exchange code → short-lived token + threads user id (POST graph.threads.net/oauth/access_token)
 *   2. Exchange short-lived → long-lived token (GET graph.threads.net/access_token, th_exchange_token)
 *   3. GET /me?fields=id,username for the Threads profile
 *   4. Upsert social_accounts row (platform = "threads")
 *   5. Redirect to /settings/connections?connected=threads
 *
 * Error path:
 *   Any failure → redirect with ?error=<reason>
 *
 * Required env vars:
 *   THREADS_APP_ID       — falls back to META_APP_ID, then INSTAGRAM_APP_ID
 *   THREADS_APP_SECRET   — falls back to META_APP_SECRET, then INSTAGRAM_APP_SECRET
 *   NEXT_PUBLIC_APP_URL  — base URL (e.g. https://postflow-amber.vercel.app)
 */

import { NextRequest } from "next/server"
import { createClient }   from "@/lib/supabase/server"
import { getActiveBrand } from "@/lib/server/brand/getActiveBrand"

const THREADS_GRAPH = "https://graph.threads.net"
const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

/** Respond with an HTML page that postMessages back to the opener (popup mode)
 *  or falls back to a normal redirect if opened as a full navigation. */
function oauthResult(opts: {
  success: boolean
  handle?: string
  returnTo: string
  error?: string
}): Response {
  const { success, handle = "", returnTo, error = "unknown" } = opts
  const msg = success
    ? `{ type: 'pf_oauth_success', platform: 'threads', handle: ${JSON.stringify(handle)} }`
    : `{ type: 'pf_oauth_error', platform: 'threads', error: ${JSON.stringify(error)} }`
  const fallback = success
    ? `${REDIRECT_BASE}${returnTo}${returnTo.includes("?") ? "&" : "?"}connected=threads`
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

  // ── Error from Meta ────────────────────────────────────────────────────────
  const metaError = searchParams.get("error")
  if (metaError) {
    const desc = searchParams.get("error_description") ?? metaError
    console.error("[threads-callback] Meta returned error:", metaError, desc)
    return oauthResult({ success: false, returnTo: "/settings/connections", error: desc })
  }

  const code = searchParams.get("code")
  if (!code) return oauthResult({ success: false, returnTo: "/settings/connections", error: "missing_code" })

  // Decode return_to from state parameter (set during initiation)
  const stateParam = searchParams.get("state")
  let returnTo = "/settings/connections"
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as { rt?: string }
      if (typeof decoded.rt === "string" && decoded.rt.startsWith("/")) returnTo = decoded.rt
    } catch { /* use default */ }
  }

  // ── Supabase session ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.redirect(`${REDIRECT_BASE}/login`)

  const brand = await getActiveBrand()
  if (!brand) return oauthResult({ success: false, returnTo, error: "no_brand" })

  const appId =
    process.env.THREADS_APP_ID ?? process.env.META_APP_ID ?? process.env.INSTAGRAM_APP_ID
  const appSecret =
    process.env.THREADS_APP_SECRET ?? process.env.META_APP_SECRET ?? process.env.INSTAGRAM_APP_SECRET
  const redirectUri = `${REDIRECT_BASE}/api/auth/threads/callback`

  if (!appId || !appSecret) {
    console.error("[threads-callback] Missing THREADS_APP_ID/SECRET (and no META_*/INSTAGRAM_* fallback)")
    return oauthResult({ success: false, returnTo, error: "server_misconfigured" })
  }

  try {
    // ── Step 1: Exchange code for short-lived token ───────────────────────────
    // Threads' token exchange endpoint takes form-encoded params, POST only.
    const tokenRes = await fetch(`${THREADS_GRAPH}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }).toString(),
    })

    const tokenBody = await tokenRes.text()

    if (!tokenRes.ok) {
      console.error("[threads-callback] Short-lived token exchange failed:", tokenRes.status, tokenBody.slice(0, 200))
      let msg = "token_exchange_failed"
      try {
        const errBody = JSON.parse(tokenBody) as { error_message?: string; error?: { message?: string } }
        const m = errBody.error_message ?? errBody.error?.message
        if (m) msg = `th_${m}`
      } catch { /* leave default */ }
      return oauthResult({ success: false, returnTo, error: msg })
    }

    const shortToken = JSON.parse(tokenBody) as { access_token: string; user_id: string | number }

    // ── Step 2: Exchange short-lived → long-lived token (60-day) ──────────────
    const longTokenUrl = new URL(`${THREADS_GRAPH}/access_token`)
    longTokenUrl.searchParams.set("grant_type", "th_exchange_token")
    longTokenUrl.searchParams.set("client_secret", appSecret)
    longTokenUrl.searchParams.set("access_token", shortToken.access_token)

    const longTokenRes = await fetch(longTokenUrl.toString())

    let accessToken = shortToken.access_token
    let expiresAt: string | null = null

    if (longTokenRes.ok) {
      const lt = (await longTokenRes.json()) as { access_token: string; expires_in?: number }
      accessToken = lt.access_token
      // Threads long-lived tokens last ~60 days (5_184_000 seconds)
      expiresAt = new Date(Date.now() + (lt.expires_in ?? 5_184_000) * 1000).toISOString()
    } else {
      console.warn("[threads-callback] Long-lived token exchange failed, using short-lived token")
    }

    // ── Step 3: Fetch Threads profile ─────────────────────────────────────────
    let username = "threads_user"
    const threadsUserId = String(shortToken.user_id)

    const profileRes = await fetch(
      `${THREADS_GRAPH}/v1.0/me?fields=id,username&access_token=${accessToken}`
    )
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as { id: string; username: string }
      username = profile.username
    }

    // ── Step 4: Upsert social_accounts ────────────────────────────────────────
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          brand_id: brand.id,
          platform: "threads",
          account_handle: username,
          account_url: `https://www.threads.net/@${username}`,
          platform_access_token: accessToken,
          platform_account_id: threadsUserId,
          token_expires_at: expiresAt,
          is_active: true,
        },
        { onConflict: "brand_id,platform" }
      )

    if (upsertError) {
      console.error("[threads-callback] DB upsert failed:", upsertError.message)
      return oauthResult({ success: false, returnTo, error: "db_error" })
    }

    console.log(`[threads-callback] Connected @${username} (threads_user_id: ${threadsUserId}) for brand ${brand.id}`)

    return oauthResult({ success: true, handle: username, returnTo })
  } catch (err) {
    console.error("[threads-callback] Unexpected error:", err)
    return oauthResult({ success: false, returnTo, error: "unexpected" })
  }
}
