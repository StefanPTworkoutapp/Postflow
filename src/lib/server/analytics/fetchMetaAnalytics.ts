/**
 * Meta Graph API — Instagram post analytics fetcher
 *
 * Requires per-social-account:
 *   - platform_access_token: long-lived page/instagram access token
 *   - platform_account_id:   Instagram Business Account ID
 *
 * Flow:
 *   1. Fetch published media from Instagram Graph API (last 90 days)
 *   2. Match each media item to a PostFlow post via caption prefix
 *   3. Fetch insights for each media item (standard + Reels metrics)
 *   4. Upsert into postflow.post_analytics
 *   5. Update posts.actual_performance with the latest metrics
 *
 * Docs: https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
 */

import { createServiceClient } from "@/lib/supabase/service"

const GRAPH_BASE = "https://graph.facebook.com/v21.0"

export interface MetaInsights {
  impressions:      number
  reach:            number
  likes:            number
  comments:         number
  shares:           number
  saved:            number
  engagement:       number
  /** Reels only — total video plays */
  plays?:           number
  /** Reels only — users who watched ≥ 97% of the video */
  video_views?:     number
}

/** Fetch insights for a standard (non-Reel) IG media item */
async function fetchMediaInsights(
  mediaId:     string,
  accessToken: string,
): Promise<MetaInsights | null> {
  const metrics = "impressions,reach,likes,comments,shares,saved,engagement"
  const url = `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`[meta-analytics] insights fetch failed for media ${mediaId}: ${res.status}`)
    return null
  }

  const json = await res.json() as {
    data: Array<{ name: string; values: Array<{ value: number }> }>
    error?: { message: string }
  }

  if (json.error) {
    console.warn(`[meta-analytics] insights API error for ${mediaId}:`, json.error.message)
    return null
  }

  const get = (name: string) => json.data.find(d => d.name === name)?.values?.[0]?.value ?? 0

  return {
    impressions: get("impressions"),
    reach:       get("reach"),
    likes:       get("likes"),
    comments:    get("comments"),
    shares:      get("shares"),
    saved:       get("saved"),
    engagement:  get("engagement"),
  }
}

/** Fetch insights for a Reel — uses different metric set */
async function fetchReelInsights(
  mediaId:     string,
  accessToken: string,
): Promise<MetaInsights | null> {
  // Reels use a different insights set: plays, reach, likes, comments, shares, saved
  // video_views = users who watched to completion (≥97%)
  const metrics = "plays,reach,likes,comments,shares,saved,video_views,impressions"
  const url = `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`[meta-analytics] reel insights fetch failed for ${mediaId}: ${res.status}`)
    // Fall back to standard insights on error
    return fetchMediaInsights(mediaId, accessToken)
  }

  const json = await res.json() as {
    data: Array<{ name: string; values: Array<{ value: number }> }>
    error?: { message: string }
  }

  // If Reel insights fail (e.g., media is not a Reel), fall back to standard
  if (json.error) {
    console.warn(`[meta-analytics] reel insights API error for ${mediaId}:`, json.error.message)
    return fetchMediaInsights(mediaId, accessToken)
  }

  const get = (name: string) => json.data.find(d => d.name === name)?.values?.[0]?.value ?? 0

  return {
    impressions:  get("impressions"),
    reach:        get("reach"),
    likes:        get("likes"),
    comments:     get("comments"),
    shares:       get("shares"),
    saved:        get("saved"),
    engagement:   get("likes") + get("comments") + get("shares") + get("saved"),
    plays:        get("plays"),
    video_views:  get("video_views"),
  }
}

/** Fetch all published IG media for the account (last 90 days), including media_type */
async function fetchRecentMedia(
  accountId:   string,
  accessToken: string,
  since:       Date,
): Promise<Array<{ id: string; caption?: string; timestamp: string; media_type?: string }>> {
  const sinceTs = Math.floor(since.getTime() / 1000)
  const url = `${GRAPH_BASE}/${accountId}/media?fields=id,caption,timestamp,media_type&since=${sinceTs}&limit=50&access_token=${accessToken}`

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`[meta-analytics] media list failed: ${res.status}`)
    return []
  }

  const json = await res.json() as {
    data: Array<{ id: string; caption?: string; timestamp: string; media_type?: string }>
    error?: { message: string }
  }

  if (json.error) {
    console.warn(`[meta-analytics] media list API error:`, json.error.message)
    return []
  }

  return json.data ?? []
}

/**
 * Main entry point.
 * Fetches analytics for all Instagram posts for a brand and upserts them.
 * Also updates posts.actual_performance with the latest metrics.
 * Uses the service-role Supabase client (runs inside Inngest, no user session).
 */
export async function fetchAndStoreMetaAnalytics(brandId: string): Promise<{
  processed: number
  errors: number
}> {
  const supabase = createServiceClient()

  // 1. Get the Instagram social account with platform token
  const { data: social } = await supabase
    .from("social_accounts")
    .select("id, platform_access_token, platform_account_id")
    .eq("brand_id", brandId)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .maybeSingle()

  if (!social?.platform_access_token || !social?.platform_account_id) {
    // No Meta token configured yet — skip silently
    return { processed: 0, errors: 0 }
  }

  // 2. Fetch the brand's current intelligence_tokens snapshot (for brand_tokens_snapshot column)
  const { data: brand } = await supabase
    .from("brands")
    .select("intelligence_tokens")
    .eq("id", brandId)
    .maybeSingle()

  const tokenSnapshot = brand?.intelligence_tokens ?? {}

  // 3. Fetch all published PostFlow posts for Instagram in last 90 days
  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)

  const { data: posts } = await supabase
    .from("posts")
    .select("id, caption, posted_at, buffer_post_id")
    .eq("brand_id", brandId)
    .eq("platform", "instagram")
    .eq("status", "posted")
    .gte("posted_at", since90.toISOString())

  if (!posts?.length) return { processed: 0, errors: 0 }

  // 4. Fetch recent IG media from Meta (with media_type for Reel detection)
  const mediaItems = await fetchRecentMedia(
    social.platform_account_id,
    social.platform_access_token,
    since90,
  )

  let processed = 0
  let errors    = 0

  // 5. Match media items to posts by caption prefix (first 50 chars)
  for (const media of mediaItems) {
    const captionPrefix = (media.caption ?? "").slice(0, 50).trim()
    const matchedPost   = posts.find(p =>
      captionPrefix && p.caption?.startsWith(captionPrefix)
    )
    if (!matchedPost) continue

    // Use Reel insights endpoint for VIDEO/REEL types, standard otherwise
    const isReel    = media.media_type === "VIDEO" || media.media_type === "REELS"
    const insights  = isReel
      ? await fetchReelInsights(media.id, social.platform_access_token)
      : await fetchMediaInsights(media.id, social.platform_access_token)

    if (!insights) { errors++; continue }

    const reachVal        = insights.reach || 1
    const engagementRate  = insights.engagement / reachVal
    const performanceScore = Math.min(100, Math.round(engagementRate * 1000))

    // Derive completion_rate for Reels: plays / reach
    // plays = total number of times the video started playing
    const completionRate = (isReel && insights.plays != null && insights.reach > 0)
      ? insights.plays / insights.reach
      : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analyticsRow: Record<string, any> = {
      post_id:               matchedPost.id,
      impressions:           insights.impressions,
      reach:                 insights.reach,
      likes:                 insights.likes,
      comments:              insights.comments,
      shares:                insights.shares,
      saves:                 insights.saved,
      clicks:                0,  // not available via basic insights
      engagement_rate:       engagementRate,
      fetched_at:            new Date().toISOString(),
      performance_score:     performanceScore,
      brand_tokens_snapshot: tokenSnapshot,
    }

    if (completionRate !== null) analyticsRow.completion_rate = completionRate

    const { error } = await supabase
      .from("post_analytics")
      .upsert(analyticsRow, { onConflict: "post_id" })

    if (error) {
      console.error("[meta-analytics] upsert error:", error.message)
      errors++
      continue
    }

    // 6. Update posts.actual_performance with the latest metrics
    const actualPerformance = {
      engagement_rate:   engagementRate,
      impressions:       insights.impressions,
      reach:             insights.reach,
      saves:             insights.saved,
      completion_rate:   completionRate,
      fetched_at:        new Date().toISOString(),
    }

    await supabase
      .from("posts")
      .update({ actual_performance: actualPerformance })
      .eq("id", matchedPost.id)

    processed++
  }

  return { processed, errors }
}
