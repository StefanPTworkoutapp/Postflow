/**
 * POST /api/portal/invite
 *
 * Generates a portal invite token for a brand and sends the client an email
 * with a read-only calendar link.
 *
 * Plan gate: Pro+ only.
 *
 * Body: { brandId: string, email: string, expiresInDays?: number }
 * Response: { inviteId, portalUrl }
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { Resend } from "resend"
import { z } from "zod"
import { randomBytes } from "crypto"

const schema = z.object({
  brandId:       z.string().uuid(),
  email:         z.string().email(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

const PRO_TIERS = new Set(["pro", "business"])

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

function generateToken(): string {
  // 32 random bytes → 64-char hex string — URL-safe, unguessable
  return randomBytes(32).toString("hex")
}

function buildPortalUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.postflow.io"
  return `${base}/portal/${token}`
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
  }
  const { brandId, email, expiresInDays } = parsed.data

  // ── Plan gate: Pro+ only ─────────────────────────────────
  const { data: account } = await supabase
    .from("accounts")
    .select("subscription_tier")
    .eq("id", user.id)
    .single()

  if (!account || !PRO_TIERS.has(account.subscription_tier ?? "free")) {
    return NextResponse.json(
      { error: "Client portal is a Pro feature. Upgrade your plan to send portal invites." },
      { status: 403 },
    )
  }

  // ── Verify brand ownership ───────────────────────────────
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, account_id")
    .eq("id", brandId)
    .single()

  if (!brand || brand.account_id !== user.id) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  // ── Generate invite ──────────────────────────────────────
  const token = generateToken()
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const serviceClient = createServiceClient()

  const { data: invite, error: insertError } = await serviceClient
    .from("portal_invites")
    .insert({
      brand_id:   brandId,
      email,
      token,
      role:       "reviewer",
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (insertError || !invite) {
    console.error("portal invite insert error:", insertError?.message)
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 })
  }

  const portalUrl = buildPortalUrl(token)

  // ── Send email ───────────────────────────────────────────
  const expiryNote = expiresInDays
    ? `This link is valid for ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}.`
    : "This link does not expire."

  try {
    const resend = getResend()
    await resend.emails.send({
      from:    "PostFlow <noreply@postflow.io>",
      to:      email,
      subject: `${brand.name} — your content preview is ready`,
      html: buildPortalInviteEmail({
        brandName: brand.name ?? "Your brand",
        portalUrl,
        expiryNote,
      }),
    })
  } catch (emailErr) {
    console.error("portal invite email error:", emailErr)
    // Don't fail the request if email delivery fails — invite is already created
    // The caller can copy the link manually
  }

  return NextResponse.json({ inviteId: invite.id, portalUrl })
}

// ── Email HTML ────────────────────────────────────────────

function buildPortalInviteEmail(opts: {
  brandName: string
  portalUrl: string
  expiryNote: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your content preview is ready</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#4f46e5;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">PostFlow</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;font-size:22px;color:#18181b;">Your content preview is ready</h2>
              <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
                The team at <strong>${opts.brandName}</strong> has shared their upcoming content calendar with you.
                Click below to review the scheduled posts and give your feedback.
              </p>
              <a href="${opts.portalUrl}"
                 style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                View content calendar →
              </a>
              <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;">${opts.expiryNote}</p>
              <p style="margin:8px 0 0;font-size:13px;color:#a1a1aa;">
                Or copy this link: <a href="${opts.portalUrl}" style="color:#4f46e5;">${opts.portalUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Powered by PostFlow · You received this because you were invited by a PostFlow user.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
