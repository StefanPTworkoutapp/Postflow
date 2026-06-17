/**
 * POST /api/contact
 *
 * Handles the public contact form submission (landing page → agency enquiries).
 * Sends an email to support@mindyourbodypt.app via Resend.
 *
 * Bot protection layers (in order):
 *  1. Honeypot field — hidden `website` input bots fill, humans leave blank
 *  2. Timing check  — submission < 3 s after page load = likely bot
 *  3. Field validation — name, email, message all required; email must look real
 *  4. Simple rate-limit — 1 submission per email address per 5 min (in-memory,
 *     resets on cold start; sufficient for low-volume contact forms)
 */

import { NextResponse } from "next/server"
import { Resend }       from "resend"

const RECIPIENT  = "support@mindyourbodypt.app"
const FROM       = "PostFlow <hello@postflowsocials.app>"
const MIN_MS     = 3_000   // submissions faster than this = bot
const RATE_WINDOW = 5 * 60 * 1000 // 5 minutes per email

// Simple in-memory rate-limit store (resets on cold start — fine for contact forms)
const recentSubmissions = new Map<string, number>()

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?:      string
      email?:     string
      company?:   string
      message?:   string
      // Honeypot — must be empty
      website?:   string
      // Timing — unix ms when form mounted
      _t?:        number
    }

    // ── 1. Honeypot check ────────────────────────────────────────────────
    if (body.website) {
      // Silently accept so bots don't know they were caught
      return NextResponse.json({ success: true })
    }

    // ── 2. Timing check ──────────────────────────────────────────────────
    const elapsed = body._t ? Date.now() - body._t : Infinity
    if (elapsed < MIN_MS) {
      return NextResponse.json({ success: true })
    }

    // ── 3. Field validation ──────────────────────────────────────────────
    const name    = (body.name    ?? "").trim()
    const email   = (body.email   ?? "").trim().toLowerCase()
    const company = (body.company ?? "").trim()
    const message = (body.message ?? "").trim()

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Please enter your name" }, { status: 400 })
    }
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }
    if (!message || message.length < 10) {
      return NextResponse.json({ error: "Please write a short message" }, { status: 400 })
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 })
    }

    // ── 4. Rate limiting ─────────────────────────────────────────────────
    const lastSent = recentSubmissions.get(email)
    if (lastSent && Date.now() - lastSent < RATE_WINDOW) {
      return NextResponse.json(
        { error: "Already received your message — we'll be in touch soon." },
        { status: 429 },
      )
    }
    recentSubmissions.set(email, Date.now())

    // Clean up old entries occasionally
    if (recentSubmissions.size > 500) {
      const cutoff = Date.now() - RATE_WINDOW
      for (const [k, v] of recentSubmissions) {
        if (v < cutoff) recentSubmissions.delete(k)
      }
    }

    // ── Send email ───────────────────────────────────────────────────────
    const resend = getResend()
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      RECIPIENT,
      replyTo: `${name} <${email}>`,
      subject: `PostFlow contact: ${name}${company ? ` (${company})` : ""}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0F172A">
          <div style="background:#0DA5A5;padding:20px 24px;border-radius:8px 8px 0 0">
            <p style="color:#fff;font-size:14px;font-weight:600;margin:0">New contact from PostFlow</p>
          </div>
          <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr>
                <td style="padding:6px 12px 6px 0;color:#64748B;white-space:nowrap;vertical-align:top">Name</td>
                <td style="padding:6px 0;font-weight:500">${name}</td>
              </tr>
              <tr>
                <td style="padding:6px 12px 6px 0;color:#64748B;white-space:nowrap;vertical-align:top">Email</td>
                <td style="padding:6px 0"><a href="mailto:${email}" style="color:#0DA5A5">${email}</a></td>
              </tr>
              ${company ? `
              <tr>
                <td style="padding:6px 12px 6px 0;color:#64748B;white-space:nowrap;vertical-align:top">Company</td>
                <td style="padding:6px 0">${company}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:12px 12px 6px 0;color:#64748B;white-space:nowrap;vertical-align:top">Message</td>
                <td style="padding:12px 0 6px;line-height:1.6;white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
              </tr>
            </table>
            <p style="margin-top:20px;font-size:12px;color:#94A3B8">
              Hit Reply to respond directly to ${email}.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error("[contact] Resend error:", error)
      return NextResponse.json(
        { error: "Failed to send — please email us directly at hello@postflowsocials.app" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[contact] Unexpected error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
