/**
 * Builds the HTML for the weekly trend intelligence email.
 * Plain TypeScript (no React Email dependency) for simplicity.
 * Claude writes the narrative — this file handles layout + theming.
 */

export interface TrendEmailData {
  brandName:      string
  recipientEmail: string
  weekOf:         string          // e.g. "12 May 2025"
  narrative:      string          // Claude-written narrative (plain text with newlines)
  googleTopics:   string[]        // top 5 Google Trends topics
  newsItems:      Array<{ headline: string; url: string }>  // top 5 news headlines
  calendarLink?:  string          // magic link to add suggested post to calendar
}

export function buildTrendEmailHtml(d: TrendEmailData): string {
  const newsHtml = d.newsItems
    .slice(0, 5)
    .map(item => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <a href="${item.url}" style="color:#6366f1;text-decoration:none;font-size:14px;line-height:1.5;">
            ${item.headline}
          </a>
        </td>
      </tr>`)
    .join("")

  const topicsHtml = d.googleTopics
    .slice(0, 5)
    .map(t => `<span style="display:inline-block;background:#eef2ff;color:#4f46e5;border-radius:9999px;padding:4px 12px;font-size:13px;margin:3px 3px 3px 0;">${t}</span>`)
    .join("")

  const narrativeHtml = d.narrative
    .split("\n\n")
    .map(p => `<p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.7;">${p.trim()}</p>`)
    .join("")

  const ctaSection = d.calendarLink
    ? `<div style="margin:28px 0;text-align:center;">
        <a href="${d.calendarLink}"
          style="display:inline-block;background:#6366f1;color:#fff;border-radius:8px;padding:12px 24px;font-size:15px;font-weight:600;text-decoration:none;">
          → Add top idea to calendar
        </a>
      </div>`
    : ""

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#6366f1;padding:28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">PostFlow · Trend Intelligence</p>
      <h1 style="margin:6px 0 0 0;color:#fff;font-size:22px;font-weight:700;">Week of ${d.weekOf}</h1>
      <p style="margin:4px 0 0 0;color:rgba(255,255,255,0.75);font-size:14px;">${d.brandName}</p>
    </div>

    <!-- Narrative -->
    <div style="padding:28px 32px 20px 32px;">
      <h2 style="margin:0 0 16px 0;font-size:17px;color:#1e293b;font-weight:600;">📊 This week's intelligence</h2>
      ${narrativeHtml}
    </div>

    ${ctaSection}

    <!-- Trending topics -->
    <div style="padding:0 32px 24px 32px;">
      <h2 style="margin:0 0 12px 0;font-size:15px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">🔥 Trending now</h2>
      <div>${topicsHtml}</div>
    </div>

    <!-- News headlines -->
    ${d.newsItems.length ? `
    <div style="padding:0 32px 28px 32px;">
      <h2 style="margin:0 0 12px 0;font-size:15px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">📰 In the news</h2>
      <table style="width:100%;border-collapse:collapse;">${newsHtml}</table>
    </div>` : ""}

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
        PostFlow · You're receiving this because you have an active brand.<br>
        <a href="#" style="color:#6366f1;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
