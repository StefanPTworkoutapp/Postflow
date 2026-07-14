/**
 * GET /api/auth/threads
 *
 * Initiates the Threads OAuth 2.0 flow.
 * Redirects the user to Meta's Threads authorization endpoint.
 *
 * Required scopes for PostFlow:
 *   - threads_basic            (read profile, required baseline scope)
 *   - threads_content_publish  (create and publish Threads posts)
 *
 * Required env vars:
 *   THREADS_APP_ID       — Threads use-case app ID from the Meta App dashboard.
 *                          Falls back to META_APP_ID, then INSTAGRAM_APP_ID
 *                          (PostFlow's existing Meta app), since a Threads
 *                          use case can be added to the same Meta app.
 *   NEXT_PUBLIC_APP_URL  — base URL
 */

import { NextResponse } from "next/server"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

export async function GET(req: Request) {
  const appId =
    process.env.THREADS_APP_ID ?? process.env.META_APP_ID ?? process.env.INSTAGRAM_APP_ID
  const redirectUri = `${REDIRECT_BASE}/api/auth/threads/callback`

  if (!appId) {
    console.error("[threads-auth] THREADS_APP_ID (or META_APP_ID / INSTAGRAM_APP_ID fallback) not set in environment")
    return NextResponse.redirect(
      `${REDIRECT_BASE}/settings/connections?error=threads_not_configured`
    )
  }

  // Encode optional return_to in OAuth state so callback can redirect back
  const returnTo = new URL(req.url).searchParams.get("return_to") ?? "/settings/connections"
  const state = Buffer.from(JSON.stringify({ rt: returnTo })).toString("base64url")

  const scopes = ["threads_basic", "threads_content_publish"].join(",")

  const oauthUrl = new URL("https://threads.net/oauth/authorize")
  oauthUrl.searchParams.set("client_id", appId)
  oauthUrl.searchParams.set("redirect_uri", redirectUri)
  oauthUrl.searchParams.set("scope", scopes)
  oauthUrl.searchParams.set("response_type", "code")
  oauthUrl.searchParams.set("state", state)

  return NextResponse.redirect(oauthUrl.toString())
}
