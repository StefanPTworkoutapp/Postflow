/**
 * Feed import — pulls a connected social account's EXISTING published posts
 * (content the brand already posted before or outside PostFlow) into
 * `imported_posts`. This is NOT analytics for PostFlow-created posts
 * (that's fetchMetaAnalytics.ts / fetchLinkedInAnalytics.ts, matched via
 * caption prefix against our own `posts` rows) — feed import has no PostFlow
 * post to match against, it's the account's raw published history.
 *
 * Two callers (P3, 2026-07-14):
 *   - src/inngest/jobs/feedImportOnConnect.ts — event-triggered right after
 *     OAuth connect, imports the last ~50 posts for one account.
 *   - src/inngest/jobs/feedImportNightly.ts — cron, imports anything newer
 *     than each account's last import.
 *
 * Error handling mirrors dailyAnalyticsFetch.ts: never throw out of the
 * per-account call — catch, log to `analytics_sync_errors` (reused rather
 * than a parallel table; that table is already brand_id/platform/error_type/
 * error_detail generic), and return a soft { imported: 0, errors: 1 } result
 * so one account's failure never stops the batch.
 */

import { createServiceClient } from "@/lib/supabase/service"

/**
 * Type-bypass helper for tables not yet in the generated database.types.ts.
 * Remove once migrations 20260714000009/20260714000010 run and types are
 * regenerated. Mirrors the `newTables()` idiom in dailyAnalyticsFetch.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newTables = (client: ReturnType<typeof createServiceClient>) => client as any

const GRAPH   = "https://graph.facebook.com/v21.0"
const LI_REST = "https://api.linkedin.com/rest"

export type ImportablePlatform = "instagram" | "facebook" | "linkedin"

export const IMPORT_PLATFORMS: ImportablePlatform[] = ["instagram", "facebook", "linkedin"]

export interface FeedImportResult {
  imported: number
  errors:   number
}

interface NormalizedPost {
  platform_post_id: string
  caption:          string | null
  media_type:       string | null
  posted_at:        string | null
  engagement:       Record<string, number | null>
}

// ── Per-platform fetch + normalize ──────────────────────────────────────────

async function fetchInstagramPosts(
  accessToken: string,
  igAccountId: string,
  limit: number,
): Promise<NormalizedPost[]> {
  const url = `${GRAPH}/${igAccountId}/media?fields=id,caption,timestamp,media_type,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`instagram media fetch failed: ${res.status} ${await res.text()}`)

  const json = await res.json() as {
    data?: Array<{
      id: string; caption?: string; timestamp?: string
      media_type?: string; like_count?: number; comments_count?: number
    }>
  }

  return (json.data ?? []).map(m => ({
    platform_post_id: m.id,
    caption:          m.caption ?? null,
    media_type:       m.media_type ?? null,
    posted_at:        m.timestamp ?? null,
    engagement: {
      likes:    m.like_count    ?? null,
      comments: m.comments_count ?? null,
    },
  }))
}

async function fetchFacebookPosts(
  accessToken: string,
  pageId:      string,
  limit:       number,
): Promise<NormalizedPost[]> {
  const url = `${GRAPH}/${pageId}/feed?fields=id,message,created_time,likes.summary(true),comments.summary(true),shares&limit=${limit}&access_token=${accessToken}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`facebook feed fetch failed: ${res.status} ${await res.text()}`)

  const json = await res.json() as {
    data?: Array<{
      id: string; message?: string; created_time?: string
      likes?:    { summary?: { total_count?: number } }
      comments?: { summary?: { total_count?: number } }
      shares?:   { count?: number }
    }>
  }

  return (json.data ?? []).map(p => ({
    platform_post_id: p.id,
    caption:          p.message ?? null,
    media_type:       null,
    posted_at:        p.created_time ?? null,
    engagement: {
      likes:    p.likes?.summary?.total_count       ?? null,
      comments: p.comments?.summary?.total_count    ?? null,
      shares:   p.shares?.count                     ?? null,
    },
  }))
}

async function fetchLinkedInPosts(
  accessToken: string,
  authorUrn:   string,
  limit:       number,
): Promise<NormalizedPost[]> {
  // LinkedIn Posts API (versioned REST, same family as publishToLinkedIn.ts's
  // 202406 publish call). Requires r_organization_social / rw_organization_admin
  // depending on whether authorUrn is a person or organization.
  const url = `${LI_REST}/posts?author=${encodeURIComponent(authorUrn)}&q=author&sortBy=CREATED&count=${limit}`
  const res = await fetch(url, {
    headers: {
      "Authorization":    `Bearer ${accessToken}`,
      "LinkedIn-Version": "202406",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  })
  if (!res.ok) throw new Error(`linkedin posts fetch failed: ${res.status} ${await res.text()}`)

  const json = await res.json() as {
    elements?: Array<{
      id: string
      createdAt?: number
      commentary?: string
      lifecycleState?: string
    }>
  }

  return (json.elements ?? []).map(p => ({
    platform_post_id: p.id,
    caption:          p.commentary ?? null,
    media_type:       null,
    posted_at:        p.createdAt ? new Date(p.createdAt).toISOString() : null,
    // LinkedIn's Posts API doesn't return engagement inline — analytics come
    // from organizationalEntityShareStatistics (fetchLinkedInAnalytics.ts).
    // Left empty here; a future pass could join those in by post URN.
    engagement: {},
  }))
}

/**
 * Import (or refresh) posts for one brand+platform's connected social
 * account. `sinceIso`, when provided, is passed through only as a client-side
 * post-fetch filter (none of these APIs support a clean "since" cursor for
 * this use case) — we always fetch the most recent `limit` and filter/upsert,
 * relying on the `imported_posts` unique constraint to no-op re-imports.
 */
export async function importFeedForAccount(
  brandId:  string,
  platform: ImportablePlatform,
  opts:     { limit?: number; sinceIso?: string } = {},
): Promise<FeedImportResult> {
  const supabase = createServiceClient()
  const limit = opts.limit ?? 50

  const { data: account, error: accountErr } = await supabase
    .from("social_accounts")
    .select("platform_access_token, platform_account_id")
    .eq("brand_id", brandId)
    .eq("platform", platform)
    .eq("is_active", true)
    .maybeSingle()

  if (accountErr || !account?.platform_access_token || !account.platform_account_id) {
    // No connected account (or missing token) — nothing to import, not an error.
    return { imported: 0, errors: 0 }
  }

  let posts: NormalizedPost[]
  try {
    if (platform === "instagram") {
      posts = await fetchInstagramPosts(account.platform_access_token, account.platform_account_id, limit)
    } else if (platform === "facebook") {
      posts = await fetchFacebookPosts(account.platform_access_token, account.platform_account_id, limit)
    } else {
      const authorUrn = account.platform_account_id.startsWith("urn:li:")
        ? account.platform_account_id
        : `urn:li:person:${account.platform_account_id}`
      posts = await fetchLinkedInPosts(account.platform_access_token, authorUrn, limit)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[feed-import] ${platform} fetch failed for brand ${brandId}:`, msg)
    await supabase.from("analytics_sync_errors").insert({
      brand_id:     brandId,
      platform,
      error_type:   "feed_import_failed",
      error_detail: { message: msg },
    })
    return { imported: 0, errors: 1 }
  }

  const filtered = opts.sinceIso
    ? posts.filter(p => !p.posted_at || p.posted_at > opts.sinceIso!)
    : posts

  if (!filtered.length) return { imported: 0, errors: 0 }

  const { error: upsertErr } = await newTables(supabase)
    .from("imported_posts")
    .upsert(
      filtered.map(p => ({
        brand_id:         brandId,
        platform,
        platform_post_id: p.platform_post_id,
        caption:          p.caption,
        media_type:       p.media_type,
        posted_at:        p.posted_at,
        engagement:       p.engagement,
      })),
      { onConflict: "brand_id,platform,platform_post_id" },
    )

  if (upsertErr) {
    console.error(`[feed-import] ${platform} upsert failed for brand ${brandId}:`, upsertErr.message)
    await supabase.from("analytics_sync_errors").insert({
      brand_id:     brandId,
      platform,
      error_type:   "feed_import_db_error",
      error_detail: { message: upsertErr.message },
    })
    return { imported: 0, errors: 1 }
  }

  return { imported: filtered.length, errors: 0 }
}
