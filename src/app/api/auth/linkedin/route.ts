/**
 * GET /api/auth/linkedin
 *
 * Initiates LinkedIn OAuth 2.0 flow.
 * Redirects to LinkedIn's authorization endpoint.
 *
 * Scopes requested:
 *   - openid, profile, email  (OIDC — gives us name + sub for upsert)
 *   - w_member_social         (post on behalf of user)
 *   - r_organization_social   (read org post analytics)
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID   — from LinkedIn Developer Portal
 *   NEXT_PUBLIC_APP_URL  — base URL
 */

import { NextResponse } from "next/server"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

export async function GET() {
  const clientId   = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = `${REDIRECT_BASE}/api/auth/linkedin/callback`

  if (!clientId) {
    console.error("[linkedin-auth] LINKEDIN_CLIENT_ID not set")
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=linkedin_not_configured`
    )
  }

  const scopes = [
    "openid",
    "profile",
    "email",
    "w_member_social",
    "r_organization_social",
  ].join(" ")

  const oauthUrl = new URL("https://www.linkedin.com/oauth/v2/authorization")
  oauthUrl.searchParams.set("client_id",     clientId)
  oauthUrl.searchParams.set("redirect_uri",  redirectUri)
  oauthUrl.searchParams.set("scope",         scopes)
  oauthUrl.searchParams.set("response_type", "code")

  return NextResponse.redirect(oauthUrl.toString())
}
