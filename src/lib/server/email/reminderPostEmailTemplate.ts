/**
 * Reminder publish-mode email — sent at the scheduled time instead of a
 * direct API publish (posts.publish_mode = 'reminder').
 *
 * Reuses the exact send mechanism already used for the manual-platform
 * "get ready" emails (src/inngest/jobs/postReminders.ts): the `resend`
 * package directly, no new email pipeline. This is the "ready-to-post
 * package" email — the client copies the caption/hashtags, opens the
 * rendered media, and posts it themselves (adding the recommended song
 * manually in-app).
 */

import { Resend } from "resend"

// Lazy init — avoids throwing at build time when env vars are absent (same
// pattern as postReminders.ts / weeklyTrendEmail.ts).
export function getResend() { return new Resend(process.env.RESEND_API_KEY!) }

export interface ReminderPostEmailData {
  recipientEmail: string
  brandName:      string
  platform:       string
  caption:        string
  hashtags:       string[]
  /** Direct link to the rendered image/video/carousel the client should download and post */
  mediaUrl:       string | null
  songName:       string | null
  songVibe:       string | null
  postUrl:        string
}

const PLATFORM_STEPS: Record<string, string[]> = {
  instagram: [
    "Save the media below to your phone's camera roll.",
    "Open Instagram and start a new post (or Reel/Story, matching the media).",
    "Select the saved media.",
    "Tap the music note icon and search for the recommended song below.",
    "Paste the caption + hashtags (copy button below) into the caption field.",
    "Tap Share.",
  ],
  tiktok: [
    "Save the media below to your phone's camera roll.",
    "Open TikTok and tap + to start a new post.",
    "Upload the saved media.",
    "Tap Sounds and search for the recommended song below.",
    "Paste the caption + hashtags into the caption field.",
    "Tap Post.",
  ],
}

const DEFAULT_STEPS = [
  "Save the media below to your device.",
  "Open the app and start a new post.",
  "Upload the saved media.",
  "Add the recommended song using the app's own audio picker, if it has one.",
  "Paste the caption + hashtags into the caption field.",
  "Share it.",
]

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function buildReminderPostEmailHtml(d: ReminderPostEmailData): string {
  const platformLabel = d.platform.charAt(0).toUpperCase() + d.platform.slice(1)
  const steps = PLATFORM_STEPS[d.platform] ?? DEFAULT_STEPS
  const captionBlock = [d.caption, d.hashtags.length ? d.hashtags.map(h => `#${h}`).join(" ") : ""]
    .filter(Boolean)
    .join("\n\n")

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">
    <div style="background:#6366f1;padding:24px 28px;">
      <p style="margin:0;color:#fff;font-size:22px;">⏰ Time to post on ${platformLabel}</p>
      <p style="margin:6px 0 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${d.brandName} · reminder mode</p>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px 0;font-size:14px;color:#374151;line-height:1.6;">
        Your ready-to-post package for ${platformLabel} is below. PostFlow doesn't
        publish this one automatically — post it yourself so you can add the
        recommended song directly in the app.
      </p>

      ${d.mediaUrl ? `
      <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Media</p>
      <a href="${d.mediaUrl}" style="display:inline-block;margin:0 0 20px 0;color:#4f46e5;font-size:14px;font-weight:600;text-decoration:none;">
        Open / download your media →
      </a>` : ""}

      <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Caption + hashtags (copy-ready)</p>
      <div style="margin:0 0 20px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;white-space:pre-wrap;line-height:1.6;">${escapeHtml(captionBlock)}</div>

      ${d.songName ? `
      <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Recommended song</p>
      <p style="margin:0 0 20px 0;font-size:15px;color:#1e293b;">
        🎵 Search for <strong>${escapeHtml(d.songName)}</strong> in ${platformLabel}'s audio picker
        ${d.songVibe ? `<br><span style="color:#64748b;font-size:13px;">${escapeHtml(d.songVibe)}</span>` : ""}
      </p>` : ""}

      <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Step by step</p>
      <ol style="margin:0 0 20px 0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
        ${steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
      </ol>

      <a href="${d.postUrl}" style="display:inline-block;background:#6366f1;color:#fff;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;text-decoration:none;">
        Open post in PostFlow →
      </a>
      <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">
        Once it's live, come back and tap "Mark as posted" on this post so your analytics stay accurate.
      </p>
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">PostFlow reminder-mode post</p>
    </div>
  </div>
</body>
</html>`
}

/** Sends the reminder-mode "ready to post" email via Resend. Throws on failure — the
 *  caller (an Inngest step.run) is expected to let that propagate so Inngest's normal
 *  retry + onFailure handling applies, exactly like a failed direct publish would. */
export async function sendReminderPostEmail(d: ReminderPostEmailData): Promise<void> {
  const platformLabel = d.platform.charAt(0).toUpperCase() + d.platform.slice(1)
  await getResend().emails.send({
    from:    "PostFlow <hello@postflow.app>",
    to:      d.recipientEmail,
    subject: `⏰ Time to post on ${platformLabel} — your package is ready`,
    html:    buildReminderPostEmailHtml(d),
  })
}
