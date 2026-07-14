/**
 * Instagram & TikTok post reminders.
 * Triggered by postflow/post.scheduled event.
 * Sends 24h + 1h reminder emails for manual-publish platforms.
 */

import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { Resend } from "resend"
import { buildEmailBrandHeader, buildEmailFooter, EMAIL_FROM } from "@/lib/server/email/emailBrand"

// Lazy init — avoids throwing at build time when env vars are absent
function getResend() { return new Resend(process.env.RESEND_API_KEY!) }

const MANUAL_PLATFORMS = ["instagram", "tiktok"]

interface ReminderEmailData {
  recipientEmail: string
  brandName:      string
  platform:       string
  topic:          string | null
  scheduledFor:   string
  postUrl:        string
  hoursUntil:     24 | 1
}

function buildReminderHtml(d: ReminderEmailData): string {
  const platformLabel = d.platform.charAt(0).toUpperCase() + d.platform.slice(1)
  const emoji         = d.platform === "tiktok" ? "🎵" : "📸"
  const scheduledDate = new Date(d.scheduledFor).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
  })

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">
    ${buildEmailBrandHeader({ background: "#6366f1" })}
    <div style="background:#6366f1;padding:8px 28px 24px 28px;">
      <p style="margin:0;color:#fff;font-size:22px;">${emoji} ${platformLabel} post ${d.hoursUntil === 24 ? "tomorrow" : "in 1 hour"}</p>
      <p style="margin:6px 0 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${d.brandName}</p>
    </div>
    <div style="padding:24px 28px;">
      ${d.topic ? `<p style="margin:0 0 8px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Post topic</p>
      <p style="margin:0 0 20px 0;font-size:16px;font-weight:600;color:#1e293b;">${d.topic}</p>` : ""}
      <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">Scheduled for</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#1e293b;">${scheduledDate} (Amsterdam)</p>
      ${d.hoursUntil === 24
        ? `<p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.6;">
            Make sure you've taken your photo or filmed your reel.<br>
            ${d.platform === "tiktok" ? "TikTok" : "Instagram"} will send you a push notification when it's time to post.
           </p>`
        : `<p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.6;">
            Your post publishes in <strong>1 hour</strong>. Open your phone — ${d.platform === "tiktok" ? "TikTok" : "Instagram"} will notify you.
           </p>`}
      <a href="${d.postUrl}" style="display:inline-block;background:#6366f1;color:#fff;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;text-decoration:none;">
        View post in PostFlow →
      </a>
    </div>
    ${buildEmailFooter({
      extra: `<p style="margin:8px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">Post reminder</p>`,
    })}
  </div>
</body>
</html>`
}

export const schedulePostReminders = inngest.createFunction(
  {
    id:       "schedule-post-reminders",
    name:     "Schedule Post Reminders",
    triggers: [{ event: "postflow/post.scheduled" }],
  },
  async ({ event, step }) => {
    const data = event.data as { postId: string; platform: string; scheduledAt: string }
    const { postId, platform, scheduledAt } = data

    if (!MANUAL_PLATFORMS.includes(platform)) {
      return { skipped: true, reason: "not a manual platform" }
    }

    const supabase   = createServiceClient()
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow.app"

    const postData = await step.run("load-post", async () => {
      const { data: post } = await supabase
        .from("posts")
        .select("id, brand_id, content_calendar(topic)")
        .eq("id", postId)
        .maybeSingle()
      if (!post) return null

      const { data: brand } = await supabase
        .from("brands")
        .select("name, accounts(email)")
        .eq("id", post.brand_id)
        .maybeSingle()

      return {
        topic: (post.content_calendar as unknown as { topic?: string } | null)?.topic ?? null,
        brandName: (brand?.name) ?? "Your brand",
        email: (brand?.accounts as unknown as { email?: string } | null)?.email ?? null,
      }
    })

    if (!postData?.email) return { skipped: true, reason: "no email" }

    const baseData: Omit<ReminderEmailData, "hoursUntil"> = {
      recipientEmail: postData.email,
      brandName:      postData.brandName,
      platform,
      topic:          postData.topic,
      scheduledFor:   scheduledAt,
      postUrl:        `${appUrl}/posts/${postId}`,
    }

    const scheduledMs = new Date(scheduledAt).getTime()
    const now         = Date.now()
    const ms24h       = scheduledMs - 24 * 60 * 60 * 1000
    const ms1h        = scheduledMs -      60 * 60 * 1000

    if (ms24h > now) {
      await step.sleepUntil("sleep-24h", new Date(ms24h))
      await step.run("send-24h-reminder", () =>
        getResend().emails.send({
          from:    EMAIL_FROM,
          to:      postData.email!,
          subject: `${platform === "tiktok" ? "🎵" : "📸"} Heads up — ${platform} post tomorrow`,
          html:    buildReminderHtml({ ...baseData, hoursUntil: 24 }),
        })
      )
    }

    if (ms1h > now) {
      await step.sleepUntil("sleep-1h", new Date(ms1h))
      await step.run("send-1h-reminder", () =>
        getResend().emails.send({
          from:    EMAIL_FROM,
          to:      postData.email!,
          subject: `${platform === "tiktok" ? "🎵" : "📸"} Posting in 1 hour`,
          html:    buildReminderHtml({ ...baseData, hoursUntil: 1 }),
        })
      )
    }

    return { sent: true }
  }
)
