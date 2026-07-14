/**
 * POST /api/auth/forgot-password
 *
 * Body: { email }
 *
 * Mints a Supabase recovery link (via admin generateLink) and emails it through
 * Resend. ALWAYS returns a generic 200 success — it never reveals whether the
 * address maps to an existing account (standard anti-enumeration practice).
 *
 * A basic in-memory rate limit (per email, per IP) throttles abuse; it resets
 * on cold start, which is fine for a low-volume password-reset endpoint.
 */

import { NextResponse } from "next/server"
import { sendPasswordResetEmail } from "@/lib/server/email/authEmails"

const RATE_WINDOW = 5 * 60 * 1000 // 5 minutes
const recentRequests = new Map<string, number>()

const GENERIC_SUCCESS = {
  success: true,
  message: "If that email exists, a reset link is on its way.",
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isRateLimited(key: string): boolean {
  const last = recentRequests.get(key)
  const now = Date.now()
  if (last && now - last < RATE_WINDOW) return true
  recentRequests.set(key, now)
  // Occasional cleanup to bound memory.
  if (recentRequests.size > 500) {
    const cutoff = now - RATE_WINDOW
    for (const [k, v] of recentRequests) {
      if (v < cutoff) recentRequests.delete(k)
    }
  }
  return false
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = (body.email ?? "").trim().toLowerCase()

    // Invalid input still returns generic success — no signal to the caller.
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(GENERIC_SUCCESS)
    }

    // Rate-limit per email + client IP. Silently accept if throttled so an
    // attacker can't distinguish "throttled" from "sent".
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    if (isRateLimited(`${email}|${ip}`)) {
      return NextResponse.json(GENERIC_SUCCESS)
    }

    // Awaited so the send completes before the serverless function ends, but
    // the outcome never changes the response body.
    await sendPasswordResetEmail(email)

    return NextResponse.json(GENERIC_SUCCESS)
  } catch (err) {
    console.error("[api/auth/forgot-password] unexpected error:", err)
    // Even on unexpected failure, don't leak — return generic success.
    return NextResponse.json(GENERIC_SUCCESS)
  }
}
