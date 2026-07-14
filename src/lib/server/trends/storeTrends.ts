/**
 * Orchestrates the weekly trend fetch + storage pipeline.
 *
 * 1. Fetch Google Trends for brand's niche keyword
 * 2. Fetch News API headlines for brand's industry/niche
 * 3. Score relevance vs brand context
 * 4. Upsert into postflow.niche_trends for the current week
 *
 * Designed to be called from an Inngest cron job.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { fetchGoogleTrends } from "./fetchGoogleTrends"
import { fetchNewsHeadlines } from "./fetchNewsHeadlines"

/** Get the Monday of the current week as YYYY-MM-DD */
function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)  // adjust to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split("T")[0]
}

export async function storeTrendsForBrand(brandId: string): Promise<{
  google: number
  news: number
}> {
  const supabase = createServiceClient()

  // Load brand context
  const { data: brand } = await supabase
    .from("brands")
    .select("industry, niche, name")
    .eq("id", brandId)
    .maybeSingle()

  if (!brand) return { google: 0, news: 0 }

  const weekOf  = getWeekStart()
  // De-fitness-ified (P3, 2026-07-14): brand.niche/industry always wins; the
  // ultimate fallback (brand has neither set) is a neutral generic term so a
  // non-fitness brand isn't force-fed fitness trend keywords.
  const keyword = brand.niche ?? brand.industry ?? "general business"

  // Fetch from both sources in parallel
  const [googleTrends, newsHeadlines] = await Promise.all([
    fetchGoogleTrends({ keyword, limit: 10 }),
    fetchNewsHeadlines({ industry: brand.industry, niche: brand.niche, limit: 15 }),
  ])

  const toInsert = [
    ...googleTrends.map(t => ({
      brand_id:        brandId,
      source:          "google_trends" as const,
      topic:           t.topic,
      relevance_score: t.score,
      week_of:         weekOf,
    })),
    ...newsHeadlines.map(h => ({
      brand_id:        brandId,
      source:          "news_api" as const,
      topic:           h.topic,
      headline:        h.headline,
      url:             h.url,
      relevance_score: 70,  // news items are inherently relevant to the search query
      week_of:         weekOf,
    })),
  ]

  if (!toInsert.length) return { google: 0, news: 0 }

  // Delete existing rows for this week first (clean replacement)
  await supabase
    .from("niche_trends")
    .delete()
    .eq("brand_id", brandId)
    .eq("week_of", weekOf)

  const { error } = await supabase
    .from("niche_trends")
    .insert(toInsert)

  if (error) {
    console.error("[store-trends] insert error:", error.message)
    return { google: 0, news: 0 }
  }

  return {
    google: googleTrends.length,
    news:   newsHeadlines.length,
  }
}
