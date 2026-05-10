/**
 * NewsAPI fetcher — pulls trending health/fitness/business headlines
 * relevant to the brand's industry + niche.
 *
 * Requires env: NEWSAPI_KEY (from newsapi.org)
 *
 * Docs: https://newsapi.org/docs/endpoints/everything
 */

export interface NewsHeadline {
  topic:     string   // cleaned headline
  headline:  string   // full headline
  url:       string
}

function buildQuery(industry: string | null, niche: string | null): string {
  const terms: string[] = []
  if (niche)     terms.push(`"${niche}"`)
  else if (industry) terms.push(industry)
  // Always add general health/fitness/wellness context
  if (!terms.some(t => t.toLowerCase().includes("health"))) {
    terms.push("fitness OR wellness OR health")
  }
  return terms.join(" AND ")
}

export async function fetchNewsHeadlines(opts: {
  industry: string | null
  niche:    string | null
  limit?:   number
}): Promise<NewsHeadline[]> {
  const key = process.env.NEWSAPI_KEY
  if (!key) {
    console.warn("[news] NEWSAPI_KEY not set — skipping news fetch")
    return []
  }

  const q = buildQuery(opts.industry, opts.niche)
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=popularity&pageSize=${opts.limit ?? 20}&apiKey=${key}`

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`[news] fetch failed: ${res.status}`)
    return []
  }

  const json = await res.json() as {
    status: string
    articles: Array<{ title: string; url: string; description?: string }>
    message?: string
  }

  if (json.status !== "ok") {
    console.warn("[news] API error:", json.message)
    return []
  }

  return (json.articles ?? [])
    .filter(a => a.title && a.url && !a.title.startsWith("[Removed]"))
    .map(a => ({
      topic:    a.title.split(" - ")[0].trim(),   // strip source name suffix
      headline: a.title,
      url:      a.url,
    }))
}
