/**
 * GET /api/auth/instagram
 *
 * Initiates Instagram Business Login OAuth flow.
 * Redirects the user to Meta's OAuth authorization URL.
 *
 * Required scopes for PostFlow:
 *   - instagram_basic           (read profile, media)
 *   - instagram_content_publish (publish posts/reels)
 *   - instagram_manage_comments (read/respond to comments)
 *   - instagram_manage_insights (read analytics)
 *   - pages_show_list           (required for business login)
 *   - pages_read_engagement     (required for IG business login)
 */

import { NextResponse } from "next/server"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

export async function GET() {
  const appId      = process.env.INSTAGRAM_APP_ID
  const redirectUri = `${REDIRECT_BASE}/api/auth/instagram/callback`

  if (!appId) {
    return NextResponse.json({ error: "INSTAGRAM_APP_ID not configured" }, { status: 500 })
  }

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
  ].join(",")

  const oauthUrl = new URL("https://www.facebook.com/dialog/oauth")
  oauthUrl.searchParams.set("client_id",     appId)
  oauthUrl.searchParams.set("redirect_uri",  redirectUri)
  oauthUrl.searchParams.set("scope",         scopes)
  oauthUrl.searchParams.set("response_type", "code")

  return NextResponse.redirect(oauthUrl.toString())
}
