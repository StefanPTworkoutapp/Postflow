/**
 * GET /api/auth/instagram/debug
 *
 * Diagnostic endpoint — shows what env vars are set and what redirect URIs
 * will be used in the OAuth flow. Helps diagnose "token exchange failed" errors.
 *
 * REMOVE THIS ROUTE before going public — it exposes config (not secrets).
 */

import { NextResponse } from "next/server"

export async function GET() {
  const appId      = process.env.INSTAGRAM_APP_ID
  const appSecret  = process.env.INSTAGRAM_APP_SECRET
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL
  const redirectBase = appUrl ?? "https://postflow-amber.vercel.app"

  return NextResponse.json({
    INSTAGRAM_APP_ID:       appId      ? `${appId.slice(0, 4)}…${appId.slice(-4)}` : "NOT SET",
    INSTAGRAM_APP_SECRET:   appSecret  ? `${appSecret.slice(0, 4)}…[redacted]` : "NOT SET",
    NEXT_PUBLIC_APP_URL:    appUrl     ?? "(not set — using fallback)",
    redirectUri:            `${redirectBase}/api/auth/instagram/callback`,
    authUrl_preview: `https://www.facebook.com/dialog/oauth?client_id=${appId ?? "NOT_SET"}&redirect_uri=${encodeURIComponent(`${redirectBase}/api/auth/instagram/callback`)}&scope=instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,pages_read_engagement&response_type=code`,
  })
}
