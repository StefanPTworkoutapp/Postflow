/**
 * GET /api/auth/linkedin
 *
 * Initiates LinkedIn OAuth 2.0 flow.
 * Redirects to LinkedIn's authorization endpoint.
 *
 * Scopes requested:
 *   - w_member_social         (post on behalf of user)
 *   - r_organization_social   (read org post analytics)
 *
 * Note: openid/profile/email (OIDC) are omitted — they require the separate
 * "Sign In with LinkedIn using OpenID Connect" product. Profile is fetched
 * gracefully via /v2/userinfo with fallback to /v2/me.
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID   — from LinkedIn Developer Portal
 *   NEXT_PUBLIC_APP_URL  — base URL
 */

import { NextResponse } from "next/server"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

export async function GET(req: Request) {
  const clientId    = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = `${REDIRECT_BASE}/api/auth/linkedin/callback`

  if (!clientId) {
    console.error("[linkedin-auth] LINKEDIN_CLIENT_ID not set")
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=linkedin_not_configured`
    )
  }

  const returnTo = new URL(req.url).searchParams.get("return_to") ?? "/settings/connections"
  const state    = Buffer.from(JSON.stringify({ rt: returnTo })).toString("base64url")

  // w_member_social: post on behalf of user (Share on LinkedIn product)
  // r_organization_social requires Marketing Developer Platform — add later
  const scopes = ["w_member_social"].join(" ")

  const oauthUrl = new URL("https://www.linkedin.com/oauth/v2/authorization")
  oauthUrl.searchParams.set("client_id",     clientId)
  oauthUrl.searchParams.set("redirect_uri",  redirectUri)
  oauthUrl.searchParams.set("scope",         scopes)
  oauthUrl.searchParams.set("response_type", "code")
  oauthUrl.searchParams.set("state",         state)

  return NextResponse.redirect(oauthUrl.toString())
}
