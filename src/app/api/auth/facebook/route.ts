/**
 * GET /api/auth/facebook
 *
 * Initiates Facebook Pages OAuth flow.
 * Reuses the same Meta app as Instagram (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET)
 * but requests page management scopes instead of Instagram scopes.
 *
 * Scopes:
 *   - pages_show_list         (list the user's Pages)
 *   - pages_read_engagement   (read Page analytics)
 *   - pages_manage_posts      (publish to the Page)
 *   - read_insights           (Page-level insights)
 *
 * Required env vars:
 *   INSTAGRAM_APP_ID   — Meta App ID (same app used for Instagram)
 *   NEXT_PUBLIC_APP_URL
 */

import { NextResponse } from "next/server"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

export async function GET(req: Request) {
  const appId       = process.env.INSTAGRAM_APP_ID
  const redirectUri = `${REDIRECT_BASE}/api/auth/facebook/callback`

  if (!appId) {
    console.error("[facebook-auth] INSTAGRAM_APP_ID not set")
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=facebook_not_configured`
    )
  }

  const returnTo = new URL(req.url).searchParams.get("return_to") ?? "/settings/connections"
  const state    = Buffer.from(JSON.stringify({ rt: returnTo })).toString("base64url")

  const scopes = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "read_insights"].join(",")

  const oauthUrl = new URL("https://www.facebook.com/dialog/oauth")
  oauthUrl.searchParams.set("client_id",     appId)
  oauthUrl.searchParams.set("redirect_uri",  redirectUri)
  oauthUrl.searchParams.set("scope",         scopes)
  oauthUrl.searchParams.set("response_type", "code")
  oauthUrl.searchParams.set("state",         state)

  return NextResponse.redirect(oauthUrl.toString())
}
