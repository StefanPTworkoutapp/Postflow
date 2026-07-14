/**
 * GET /api/auth/tiktok
 *
 * Initiates TikTok OAuth 2.0 (v2) flow with PKCE.
 * TikTok v2 mandates PKCE — we generate a code_verifier, derive the
 * code_challenge (SHA-256 base64url), store the verifier in a cookie,
 * then redirect to TikTok's authorization endpoint.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY    — from TikTok Developer Portal → App → Client Key
 *   NEXT_PUBLIC_APP_URL  — base URL
 */

import { NextResponse } from "next/server"
import { cookies }      from "next/headers"
import crypto           from "crypto"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

/** Generate a cryptographically random code verifier (43–128 chars, URL-safe) */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url")
}

/** Derive code_challenge = BASE64URL(SHA-256(code_verifier)) */
async function deriveCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash("sha256").update(verifier).digest()
  return hash.toString("base64url")
}

export async function GET(req: Request) {
  const clientKey  = process.env.TIKTOK_CLIENT_KEY
  const redirectUri = `${REDIRECT_BASE}/api/auth/tiktok/callback`

  if (!clientKey) {
    console.error("[tiktok-auth] TIKTOK_CLIENT_KEY not set")
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=tiktok_not_configured`
    )
  }

  const codeVerifier  = generateCodeVerifier()
  const codeChallenge = await deriveCodeChallenge(codeVerifier)

  // Store verifier in a short-lived cookie (5 min) — read back in callback
  const cookieStore = await cookies()
  cookieStore.set("tiktok_code_verifier", codeVerifier, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    maxAge:   300, // 5 minutes
    path:     "/",
    sameSite: "lax",
  })

  // Store return_to so the callback knows where to send the user back
  const returnTo = new URL(req.url).searchParams.get("return_to") ?? "/settings/connections"
  cookieStore.set("tiktok_return_to", returnTo, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    maxAge:   300,
    path:     "/",
    sameSite: "lax",
  })

  // user.info.basic — profile info and analytics identity
  //
  // video.publish was removed: TikTok denied the production app submission.
  // It's added back automatically once TIKTOK_DIRECT_PUBLISH_ENABLED=true (the
  // same flag publishToTikTok.ts gates on) — flipping that one env var re-enables
  // both the scope request and the publish call together. Existing TikTok users
  // must still reconnect after the flag flips so their stored token picks up the
  // new scope. See publishToTikTok.ts header for the full re-enable checklist.
  const scopes =
    process.env.TIKTOK_DIRECT_PUBLISH_ENABLED === "true"
      ? "user.info.basic,video.publish"
      : "user.info.basic"

  const oauthUrl = new URL("https://www.tiktok.com/v2/auth/authorize/")
  oauthUrl.searchParams.set("client_key",             clientKey)
  oauthUrl.searchParams.set("redirect_uri",           redirectUri)
  oauthUrl.searchParams.set("scope",                  scopes)
  oauthUrl.searchParams.set("response_type",          "code")
  oauthUrl.searchParams.set("code_challenge",         codeChallenge)
  oauthUrl.searchParams.set("code_challenge_method",  "S256")

  return NextResponse.redirect(oauthUrl.toString())
}
