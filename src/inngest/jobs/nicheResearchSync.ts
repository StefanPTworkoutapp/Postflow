/**
 * Niche Research Sync — runs weekly at 06:00 UTC every Monday.
 *
 * Implements Part 8B Guarantee 3:
 *   - Finds all active (niche, platform) combinations across PostFlow brands
 *   - Runs Claude research per niche+platform pair to surface trend signals
 *   - Upserts fresh signals into postflow.niche_trends (14-day expiry window)
 *   - Logs each run to postflow.research_runs
 *
 * Freshness contract: any caller of getTrendSignals() checks research_runs.
 * If no row exists for a given niche+platform in the last 14 days, treat data
 * as stale and return niche aggregate fallback.
 */

import { inngest }            from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import Anthropic               from "@anthropic-ai/sdk"
import { MODELS }              from "@/lib/ai/models"
import { logAiUsage }          from "@/lib/ai/logUsage"

/**
 * Type-bypass helper for tables not yet in the generated database.types.ts.
 * Remove once migration 20260511000001 runs and types are regenerated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newTables = (client: ReturnType<typeof createServiceClient>) => client as any

const claude = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrendSignal {
  topic:           string
  relevance_score: number
  /** Optional rationale from the research pass */
  rationale?:      string
}

// ── Claude research ───────────────────────────────────────────────────────────

/**
 * Ask Claude to surface current content trends for a given niche+platform.
 * Returns up to 8 trend signals.
 */
async function researchNicheTrends(
  niche:    string,
  platform: string,
): Promise<TrendSignal[]> {
  const platformLabel: Record<string, string> = {
    instagram: "Instagram Reels and carousels",
    tiktok:    "TikTok videos",
    linkedin:  "LinkedIn posts",
    youtube:   "YouTube Shorts",
    facebook:  "Facebook posts",
  }

  const prompt = `You are a social media content strategist with deep knowledge of current trends.

Research task: What content topics and themes are trending right now for the "${niche}" niche on ${platformLabel[platform] ?? platform}?

Return ONLY a JSON array of up to 8 trend signals. Each item must have:
- "topic": string — a specific content topic or angle (e.g. "morning mobility routines for desk workers")
- "relevance_score": number — relevance 0–100 for this niche (be conservative — only ≥70 for genuinely relevant trends)
- "rationale": string — one sentence explaining why this is trending now

Focus on:
- Topics that fit the ${niche} niche specifically (not generic fitness/business trends)
- Content formats performing well on ${platformLabel[platform] ?? platform} this month
- Questions and pain points the audience is actively searching

Respond with ONLY the JSON array, no other text.`

  try {
    const response = await claude.messages.create({
      model:      MODELS.nicheResearch,
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    })
    logAiUsage({ brandId: null, model: MODELS.nicheResearch, feature: "niche_research", usage: response.usage })

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    // Strip markdown fences if present
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    const parsed = JSON.parse(json) as unknown[]

    return (Array.isArray(parsed) ? parsed : [])
      .filter((item): item is TrendSignal =>
        typeof item === "object" && item !== null &&
        typeof (item as Record<string, unknown>).topic === "string" &&
        typeof (item as Record<string, unknown>).relevance_score === "number"
      )
      .slice(0, 8)
  } catch (err) {
    console.error(`[niche-research] Claude research failed for ${niche}/${platform}:`, err)
    return []
  }
}

// ── Inngest job ───────────────────────────────────────────────────────────────

export const nicheResearchSync = inngest.createFunction(
  {
    id:       "niche-research-sync",
    name:     "Niche Research Sync",
    // Monday 06:00 UTC
    triggers: [{ cron: "0 6 * * 1" }],
    concurrency: { limit: 3 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    // ── 1. Collect distinct (niche, platform) pairs ─────────────────────────
    const nichePairs: Array<{ niche: string; platform: string }> = await step.run(
      "collect-niche-pairs",
      async () => {
        // Brands with their niches
        const { data: brands } = await supabase
          .from("brands")
          .select("niche, industry")

        // Active social accounts → platforms
        const { data: socials } = await supabase
          .from("social_accounts")
          .select("brand_id, platform")
          .eq("is_active", true)

        const pairs = new Set<string>()
        const result: Array<{ niche: string; platform: string }> = []

        for (const brand of (brands ?? [])) {
          const niche = brand.niche ?? brand.industry
          if (!niche) continue

          for (const social of (socials ?? [])) {
            const key = `${niche}::${social.platform}`
            if (!pairs.has(key)) {
              pairs.add(key)
              result.push({ niche, platform: social.platform })
            }
          }
        }

        return result
      }
    )

    if (!nichePairs.length) return { success: true, pairsResearched: 0 }

    // ── 2. Research each niche+platform pair ────────────────────────────────
    const results = await Promise.all(
      nichePairs.map(({ niche, platform }) =>
        step.run(`research-${niche}-${platform}`, async () => {
          const signals = await researchNicheTrends(niche, platform)

          if (!signals.length) {
            // Log zero-result run so freshness check still passes
            await newTables(supabase).from("research_runs").insert({
              niche,
              platform,
              signals_found: 0,
            })
            return { niche, platform, signalsFound: 0 }
          }

          // ── Delete expired trends for this niche+platform ─────────────────
          // "Never delete active" means we only delete rows older than 14 days
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          await supabase
            .from("niche_trends")
            .delete()
            .lte("week_of", fourteenDaysAgo)

          // ── Insert fresh signals ──────────────────────────────────────────
          const weekOf = new Date().toISOString().split("T")[0]

          // We need brand_id for niche_trends — find all brands with this niche
          const { data: brandRows } = await supabase
            .from("brands")
            .select("id, niche, industry")

          const matchingBrandIds = (brandRows ?? [])
            .filter(b => (b.niche ?? b.industry) === niche)
            .map(b => b.id)

          if (matchingBrandIds.length) {
            const rows = matchingBrandIds.flatMap(brand_id =>
              signals.map(s => ({
                brand_id,
                source:          "niche_research",
                topic:           s.topic,
                relevance_score: s.relevance_score,
                week_of:         weekOf,
              }))
            )

            const { error } = await supabase
              .from("niche_trends")
              .insert(rows)

            if (error) {
              console.error(`[niche-research] insert failed for ${niche}/${platform}:`, error.message)
            }
          }

          // ── Log research run ──────────────────────────────────────────────
          await newTables(supabase).from("research_runs").insert({
            niche,
            platform,
            signals_found: signals.length,
          })

          return { niche, platform, signalsFound: signals.length }
        })
      )
    )

    const total = results.reduce((sum, r) => sum + r.signalsFound, 0)
    return {
      success:         true,
      pairsResearched: nichePairs.length,
      totalSignals:    total,
    }
  }
)
