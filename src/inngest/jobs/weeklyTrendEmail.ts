/**
 * Weekly trend intelligence email — runs Monday 06:00 UTC.
 */

import { inngest } from "../client"
import { EMAIL_FROM } from "@/lib/server/email/emailBrand"
import { createServiceClient } from "@/lib/supabase/service"
import { Resend } from "resend"
import Anthropic from "@anthropic-ai/sdk"
import { buildTrendEmailHtml } from "@/lib/server/email/trendEmailTemplate"
import { SignJWT } from "jose"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

// Lazy init — avoids throwing at build time when env vars are absent
function getResend()    { return new Resend(process.env.RESEND_API_KEY!) }
function getAnthropic() { return new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY! }) }

async function generateNarrative(opts: {
  brandId:      string
  brandName:    string
  industry:     string | null
  niche:        string | null
  googleTopics: string[]
  newsItems:    Array<{ headline: string }>
  patterns:     Array<{ platform: string; avg_engagement_rate: number | null; best_content_pillars: string[] | null }>
}): Promise<string> {
  const patternSummary = opts.patterns.map(p =>
    `${p.platform}: avg engagement ${((p.avg_engagement_rate ?? 0) * 100).toFixed(2)}%, best pillars: ${(p.best_content_pillars ?? []).join(", ")}`
  ).join("\n")

  const msg = await getAnthropic().messages.create({
    model:      MODELS.trendEmail,
    max_tokens: 600,
    messages: [{
      role:    "user",
      content: `You are a social media strategist writing a weekly trend intelligence briefing for a brand.

Brand: ${opts.brandName}
Industry: ${opts.industry ?? "general business"}
Niche: ${opts.niche ?? "general"}

Trending topics this week (Google Trends):
${opts.googleTopics.slice(0, 5).join(", ")}

Top news headlines:
${opts.newsItems.slice(0, 5).map(h => `- ${h.headline}`).join("\n")}

Brand performance patterns:
${patternSummary || "No data yet — brand is new."}

Write a 3-paragraph trend intelligence briefing (100–140 words total):
1. What's trending in their niche this week and why it matters
2. One specific content idea they should act on immediately
3. A quick note on their best-performing format and when to post

Write in second person ("your brand", "you"). Be direct and actionable. No fluff.
Return only the 3 paragraphs, separated by blank lines.`,
    }],
  })

  logAiUsage({ brandId: opts.brandId, model: MODELS.trendEmail, feature: "trend_email", usage: msg.usage })
  return msg.content[0].type === "text" ? msg.content[0].text : ""
}

async function generateMagicLink(brandId: string, topic: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.CALENDAR_LINK_SECRET ?? "fallback-secret-change-in-production"
  )
  const token = await new SignJWT({ brandId, topic, action: "add_calendar" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret)

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow.app"
  return `${base}/api/calendar/add?token=${token}`
}

interface BrandRow {
  id:       string
  name:     string
  industry: string | null
  niche:    string | null
  email:    string | null
}

export const weeklyTrendEmail = inngest.createFunction(
  {
    id:       "weekly-trend-email",
    name:     "Weekly Trend Intelligence Email",
    triggers: [{ cron: "0 6 * * 1" }],
    concurrency: { limit: 2 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    const brands: BrandRow[] = await step.run("get-brands", async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name, industry, niche, account_id, accounts(email)")

      return (data ?? []).map((b: {
        id: string; name: string; industry: string | null; niche: string | null
        accounts: { email: string } | null
      }) => ({
        id:       b.id,
        name:     b.name,
        industry: b.industry,
        niche:    b.niche,
        email:    b.accounts?.email ?? null,
      }))
    })

    const weekStart = (() => {
      const d = new Date()
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    })()

    const results = await Promise.all(
      brands.map((brand: BrandRow) =>
        step.run(`send-email-${brand.id}`, async () => {
          if (!brand.email) return { brandId: brand.id, skipped: true, reason: "no email" }

          const weekOf = new Date()
          const mon    = new Date(weekOf)
          mon.setDate(mon.getDate() - (weekOf.getDay() || 7) + 1)
          const weekKey = mon.toISOString().split("T")[0]

          const { data: trends } = await supabase
            .from("niche_trends")
            .select("source, topic, headline, url")
            .eq("brand_id", brand.id)
            .eq("week_of", weekKey)
            .order("relevance_score", { ascending: false })
            .limit(20)

          const googleTopics = (trends ?? []).filter((t: { source: string }) => t.source === "google_trends").map((t: { topic: string }) => t.topic)
          const newsItems    = (trends ?? []).filter((t: { source: string }) => t.source === "news_api").map((t: { headline?: string | null; topic: string; url?: string | null }) => ({
            headline: t.headline ?? t.topic,
            url:      t.url ?? "#",
          }))

          const { data: patterns } = await supabase
            .from("performance_patterns")
            .select("platform, avg_engagement_rate, best_content_pillars")
            .eq("brand_id", brand.id)

          const narrative = await generateNarrative({
            brandId:      brand.id,
            brandName:    brand.name,
            industry:     brand.industry,
            niche:        brand.niche,
            googleTopics,
            newsItems,
            patterns: (patterns ?? []) as Array<{ platform: string; avg_engagement_rate: number | null; best_content_pillars: string[] | null }>,
          })

          const topTopic    = googleTopics[0] ?? newsItems[0]?.headline ?? "trending topic"
          const calendarLink = await generateMagicLink(brand.id, topTopic)

          const html = buildTrendEmailHtml({
            brandName:      brand.name,
            recipientEmail: brand.email!,
            weekOf:         weekStart,
            narrative,
            googleTopics,
            newsItems,
            calendarLink,
          })

          const { error } = await getResend().emails.send({
            from:    EMAIL_FROM,
            to:      brand.email!,
            subject: `📊 Your weekly trend brief — ${weekStart}`,
            html,
          })

          if (error) return { brandId: brand.id, sent: false, error: error.message }
          return { brandId: brand.id, sent: true }
        })
      )
    )

    return { success: true, results }
  }
)
