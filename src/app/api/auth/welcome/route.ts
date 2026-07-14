/**
 * POST /api/auth/welcome
 *
 * Sends the branded welcome email after a successful signup. Called by the
 * signup page (fire-and-forget) once supabase.auth.signUp establishes the
 * session client-side.
 *
 * Security: the recipient is ALWAYS the authenticated session's own email —
 * the request body is ignored. This means the endpoint can only ever email
 * the currently-signed-in user (no arbitrary-email abuse), and it does nothing
 * if there is no session.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendWelcomeEmail } from "@/lib/server/email/authEmails"

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      // Not signed in — nothing to do. Return generic success so a lost race
      // (welcome fired before the session cookie is readable) never surfaces
      // an error to the user.
      return NextResponse.json({ success: true })
    }

    const name =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null

    // Awaited so the serverless function doesn't terminate before the send,
    // but the client calls this fire-and-forget so the user never waits.
    await sendWelcomeEmail(user.email, { name })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[api/auth/welcome] unexpected error:", err)
    // Never break the signup flow on a welcome-email failure.
    return NextResponse.json({ success: true })
  }
}
