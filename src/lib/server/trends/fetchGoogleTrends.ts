/**
 * Google Trends fetcher via SerpAPI
 *
 * Requires env: SERPAPI_KEY (from serpapi.com)
 *
 * Uses the "google_trends" engine to get trending queries
 * related to the brand's industry/niche.
 *
 * Docs: https://serpapi.com/google-trends-api
 */

export interface TrendingTopic {
  topic: string
  score: number   // 0–100 relative interest
}

export async function fetchGoogleTrends(opts: {
  keyword: string   // e.g. "physiotherapy" or "padel"
  geo?:    string   // e.g. "NL", "US" — default "US"
  limit?:  number
}): Promise<TrendingTopic[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) {
    console.warn("[trends] SERPAPI_KEY not set — skipping Google Trends fetch")
    return []
  }

  const params = new URLSearchParams({
    engine:         "google_trends",
    q:              opts.keyword,
    geo:            opts.geo ?? "NL",
    data_type:      "RELATED_QUERIES",
    date:           "now 7-d",
    api_key:        key,
  })

  const url = `https://serpapi.com/search?${params}`
  const res = await fetch(url)

  if (!res.ok) {
    console.warn(`[trends] SerpAPI request failed: ${res.status}`)
    return []
  }

  const json = await res.json() as {
    related_queries?: {
      rising?: Array<{ query: string; value: number | string }>
      top?:    Array<{ query: string; value: number | string }>
    }
    error?: string
  }

  if (json.error) {
    console.warn("[trends] SerpAPI error:", json.error)
    return []
  }

  const items = [
    ...(json.related_queries?.rising ?? []),
    ...(json.related_queries?.top    ?? []),
  ]

  const seen = new Set<string>()
  return items
    .filter(item => {
      if (seen.has(item.query)) return false
      seen.add(item.query)
      return true
    })
    .slice(0, opts.limit ?? 10)
    .map(item => ({
      topic: item.query,
      score: typeof item.value === "number" ? item.value : 50,
    }))
}
