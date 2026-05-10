/**
 * LinkedIn Analytics API — post analytics fetcher
 *
 * Requires per-social-account:
 *   - platform_access_token: OAuth2 token with r_organization_social scope
 *   - platform_account_id:   LinkedIn Organization URN (urn:li:organization:12345)
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/organizations/share-statistics
 */

import { createServiceClient } from "@/lib/supabase/service"

const LI_BASE = "https://api.linkedin.com/v2"

interface LiShareStat {
  totalShareStatistics: {
    impressionCount:     number
    uniqueImpressionsCount: number
    clickCount:          number
    engagementCount:     number
    likeCount:           number
    commentCount:        number
    shareCount:          number
  }
}

async function fetchShareStats(
  shareUrn:    string,
  accessToken: string,
): Promise<LiShareStat["totalShareStatistics"] | null> {
  const encoded = encodeURIComponent(shareUrn)
  const url = `${LI_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encoded}&shares=List(${encodeURIComponent(shareUrn)})`

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "LinkedIn-Version": "202401",
    },
  })

  if (!res.ok) {
    console.warn(`[linkedin-analytics] stats fetch failed: ${res.status}`)
    return null
  }

  const json = await res.json() as {
    elements?: LiShareStat[]
    errorCode?: number
    message?: string
  }

  if (json.errorCode) {
    console.warn(`[linkedin-analytics] API error:`, json.message)
    return null
  }

  return json.elements?.[0]?.totalShareStatistics ?? null
}

export async function fetchAndStoreLinkedInAnalytics(brandId: string): Promise<{
  processed: number
  errors: number
}> {
  const supabase = createServiceClient()

  const { data: social } = await supabase
    .from("social_accounts")
    .select("platform_access_token, platform_account_id")
    .eq("brand_id", brandId)
    .eq("platform", "linkedin")
    .eq("is_active", true)
    .maybeSingle()

  if (!social?.platform_access_token) return { processed: 0, errors: 0 }

  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)

  // Fetch posted LinkedIn posts (buffer_post_id is the share URN for LinkedIn)
  const { data: posts } = await supabase
    .from("posts")
    .select("id, buffer_post_id")
    .eq("brand_id", brandId)
    .eq("platform", "linkedin")
    .eq("status", "posted")
    .gte("posted_at", since90.toISOString())
    .not("buffer_post_id", "is", null)

  if (!posts?.length) return { processed: 0, errors: 0 }

  let processed = 0
  let errors    = 0

  for (const post of posts) {
    if (!post.buffer_post_id) continue
    const stats = await fetchShareStats(post.buffer_post_id, social.platform_access_token)
    if (!stats) { errors++; continue }

    const reach = stats.uniqueImpressionsCount || 1
    const engagementRate = (stats.engagementCount / reach)

    const { error } = await supabase
      .from("post_analytics")
      .upsert({
        post_id:           post.id,
        impressions:       stats.impressionCount,
        reach:             stats.uniqueImpressionsCount,
        likes:             stats.likeCount,
        comments:          stats.commentCount,
        shares:            stats.shareCount,
        saves:             0,
        clicks:            stats.clickCount,
        engagement_rate:   engagementRate,
        fetched_at:        new Date().toISOString(),
        performance_score: Math.min(100, Math.round(engagementRate * 500)),
      }, { onConflict: "post_id" })

    if (error) { errors++ }
    else processed++
  }

  return { processed, errors }
}
