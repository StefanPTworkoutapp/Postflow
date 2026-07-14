/**
 * App-owned authentication emails.
 *
 * Supabase's built-in Auth mailer is broken for this project (returns 500
 * "unexpected_failure" on every send despite a provably-correct Resend SMTP
 * config — confirmed a Supabase-side fault). Auto-confirm is ON, so signup
 * activates the user instantly with NO confirmation email. The app therefore
 * owns the two auth emails it actually needs and sends them through Resend
 * (which works — postflowsocials.app is verified):
 *
 *   1. Welcome  — friendly "you're in" note, no link required (user is active).
 *   2. Password reset — mints a Supabase *recovery* link via the admin
 *      generateLink API (so Supabase never sends anything itself) and delivers
 *      it through Resend with a branded "Reset your password" button.
 *
 * Reuses the same send mechanism (the `resend` package directly) and brand
 * header/footer as the other transactional emails (trend / reminder / margin).
 */

import { Resend } from "resend"
import { createServiceClient } from "@/lib/supabase/service"
import {
  buildEmailBrandHeader,
  buildEmailFooter,
  EMAIL_FROM,
} from "./emailBrand"

/** Reply-to for all auth emails — humans land in the support inbox. */
const EMAIL_REPLY_TO = "support@mindyourbodypt.nl"

/**
 * Production base URL for links the app owns.
 *
 * The password-reset redirect MUST be a URL that is whitelisted in the
 * Supabase project's "Redirect URLs" list, or the recovery link is rejected.
 * We default to the live production host and only allow an explicit override.
 */
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflowsocials.app"

/** Where the recovery link lands. Must be whitelisted in Supabase Auth settings. */
export const PASSWORD_RESET_REDIRECT_URL = `${APP_BASE_URL}/reset-password`

/** Lazy init — avoids throwing at build time when env vars are absent. */
function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML templates
// ─────────────────────────────────────────────────────────────────────────────

function buildEmailShell(opts: {
  accent: string
  eyebrow: string
  heading: string
  bodyHtml: string
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">
    ${buildEmailBrandHeader({ background: opts.accent })}
    <div style="background:${opts.accent};padding:12px 32px 28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${opts.eyebrow}</p>
      <h1 style="margin:6px 0 0 0;color:#fff;font-size:22px;font-weight:700;">${opts.heading}</h1>
    </div>
    <div style="padding:28px 32px 8px 32px;">
      ${opts.bodyHtml}
    </div>
    ${buildEmailFooter()}
  </div>
</body>
</html>`
}

export function buildWelcomeEmailHtml(opts: { name?: string | null }): string {
  const greeting = opts.name?.trim() ? `Hi ${opts.name.trim()},` : "Hi there,"
  const dashboardUrl = `${APP_BASE_URL}/dashboard`
  return buildEmailShell({
    accent: "#6366f1",
    eyebrow: "Welcome aboard",
    heading: "Welcome to PostFlow 🎉",
    bodyHtml: `
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.7;">${greeting}</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.7;">
        Your account is ready — no confirmation needed. PostFlow plans, writes and schedules
        your social content so you can stay consistent without living inside a content calendar.
      </p>
      <div style="margin:24px 0;text-align:center;">
        <a href="${dashboardUrl}"
          style="display:inline-block;background:#6366f1;color:#fff;border-radius:8px;padding:12px 24px;font-size:15px;font-weight:600;text-decoration:none;">
          Open your dashboard →
        </a>
      </div>
      <p style="margin:0 0 8px 0;color:#374151;font-size:15px;line-height:1.7;">
        A few good first steps: connect a social account, add your brand voice, and let PostFlow
        draft your first week of posts.
      </p>
      <p style="margin:16px 0 0 0;color:#64748b;font-size:14px;line-height:1.6;">
        Questions? Just reply to this email — a real person reads it.
      </p>`,
  })
}

export function buildPasswordResetEmailHtml(opts: { actionLink: string }): string {
  return buildEmailShell({
    accent: "#1B2B4B",
    eyebrow: "Account security",
    heading: "Reset your password",
    bodyHtml: `
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.7;">
        We received a request to reset the password for your PostFlow account.
        Click the button below to choose a new one.
      </p>
      <div style="margin:24px 0;text-align:center;">
        <a href="${opts.actionLink}"
          style="display:inline-block;background:#1B2B4B;color:#fff;border-radius:8px;padding:12px 24px;font-size:15px;font-weight:600;text-decoration:none;">
          Reset your password
        </a>
      </div>
      <p style="margin:0 0 16px 0;color:#64748b;font-size:13px;line-height:1.6;">
        This link expires in about an hour and can only be used once. If the button doesn't work,
        copy and paste this URL into your browser:
      </p>
      <p style="margin:0 0 16px 0;word-break:break-all;">
        <a href="${opts.actionLink}" style="color:#6366f1;font-size:13px;">${opts.actionLink}</a>
      </p>
      <p style="margin:16px 0 0 0;color:#64748b;font-size:14px;line-height:1.6;">
        Didn't ask for this? You can safely ignore this email — your password won't change
        until you create a new one.
      </p>`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Senders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send the branded welcome email. Fire-and-forget at call sites — a failure
 * here must never break signup. Returns whether the send succeeded.
 */
export async function sendWelcomeEmail(
  email: string,
  opts: { name?: string | null } = {},
): Promise<{ sent: boolean }> {
  try {
    const { error } = await getResend().emails.send({
      from:    EMAIL_FROM,
      to:      email,
      replyTo: EMAIL_REPLY_TO,
      subject: "Welcome to PostFlow 🎉",
      html:    buildWelcomeEmailHtml({ name: opts.name }),
    })
    if (error) {
      console.error("[authEmails] welcome Resend error:", error)
      return { sent: false }
    }
    return { sent: true }
  } catch (err) {
    console.error("[authEmails] welcome unexpected error:", err)
    return { sent: false }
  }
}

/**
 * Mint a Supabase recovery link (admin generateLink — Supabase itself sends
 * nothing) and deliver it through Resend.
 *
 * Security: never reveals whether the address maps to an existing account.
 * A missing user, a generateLink failure, or a Resend failure all resolve to
 * { sent: false } after logging, and the calling route returns a generic
 * "if that email exists…" success either way.
 */
export async function sendPasswordResetEmail(
  email: string,
): Promise<{ sent: boolean }> {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.admin.generateLink({
      type:  "recovery",
      email,
      options: { redirectTo: PASSWORD_RESET_REDIRECT_URL },
    })

    if (error || !data?.properties?.action_link) {
      // user-not-found / disabled signups / any generateLink failure — do NOT
      // leak which emails exist. Log for us, return soft failure to the caller.
      console.error("[authEmails] reset generateLink error:", error?.message ?? "no action_link")
      return { sent: false }
    }

    const { error: sendError } = await getResend().emails.send({
      from:    EMAIL_FROM,
      to:      email,
      replyTo: EMAIL_REPLY_TO,
      subject: "Reset your PostFlow password",
      html:    buildPasswordResetEmailHtml({ actionLink: data.properties.action_link }),
    })

    if (sendError) {
      console.error("[authEmails] reset Resend error:", sendError)
      return { sent: false }
    }
    return { sent: true }
  } catch (err) {
    console.error("[authEmails] reset unexpected error:", err)
    return { sent: false }
  }
}
