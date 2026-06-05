/**
 * POST /api/analytics/sync  — manual trigger (requires user auth)
 * GET  /api/analytics/sync  — Vercel cron trigger (requires CRON_SECRET header)
 *
 * 1. Fetches all brands with a connected Buffer account
 * 2. For each brand, pulls recent sent posts from the Buffer GraphQL API
 * 3. Upserts analytics into post_analytics (matched on buffer_post_id or text similarity)
 * 4. Calls nudgeToken() for high-engagement and best-time signals
 * 5. Returns: { synced: number, brands_processed: number, updated_tokens: string[] }
 *
 * Buffer API used: GraphQL (same as scheduleBufferPost in client.ts)
 */

import { NextResponse }          from "next/server"
import { createClient }          from "@/lib/supabase/server"
import { createServiceClient }   from "@/lib/supabase/service"
import { nudgeToken }            from "@/lib/server/brand/nudge-token"

// ─── Buffer GraphQL types ─────────────────────────────────────────────────────

interface BufferSentPost {
  id:     string
  text:   string
  dueAt:  string | null
  status: string
  statistics: {
    reach:     number | null
    clicks:    number | null
    likes:     number | null
    comments:  number | null
    shares:    number | null
    favorites: number | null
  } | null
}

interface BufferChannel {
  id: string
}

// ─── Buffer API helpers ───────────────────────────────────────────────────────

const BUFFER_API = "https://api.buffer.com"

async function bufferGql<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
  accessToken: string,
): Promise<T> {
  const res  = await fetch(BUFFER_API, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  const json = await res.json() as { data?: T; errors?: { message: string }[] }
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `Buffer API error ${res.status}`)
  }
  return json.data as T
}

async function getOrganizationId(accessToken: string): Promise<string> {
  const data = await bufferGql<{ account: { organizations: { id: string }[] } }>(
    `query { account { organizations { id } } }`,
    {},
    accessToken,
  )
  const orgId = data.account?.organizations?.[0]?.id
  if (!orgId) throw new Error("No Buffer organization found for this token.")
  return orgId
}

async function getChannelIds(accessToken: string, orgId: string): Promise<string[]> {
  const data = await bufferGql<{ channels: BufferChannel[] }>(
    `query GetChannels($input: ChannelsInput!) {
       channels(input: $input) { id }
     }`,
    { input: { organizationId: orgId } },
    accessToken,
  )
  return (data.channels ?? []).map(c => c.id)
}

async function getSentPosts(
  accessToken: string,
  channelId: string,
): Promise<BufferSentPost[]> {
  try {
    const data = await bufferGql<{
      channel: { posts: { edges: { node: BufferSentPost }[] } }
    }>(
      `query GetSentPosts($channelId: String!) {
         channel(id: $channelId) {
           posts(filter: { status: SENT }, first: 50) {
             edges {
               node {
                 id
                 text
                 dueAt
                 status
                 statistics {
                   reach
                   clicks
                   likes
                   comments
                   shares
                   favorites
                 }
               }
             }
           }
         }
       }`,
      { channelId },
      accessToken,
    )
    return (data.channel?.posts?.edges ?? []).map(e => e.node)
  } catch (err) {
    // Buffer API may return errors for channels with no analytics access — skip
    console.warn(`getSentPosts: channel ${channelId} error:`, (err as Error).message)
    return []
  }
}

// ─── Analytics mapping ────────────────────────────────────────────────────────

interface MappedStats {
  impressions: number
  likes:       number
  comments:    number
  shares:      number
  reach:       number
  clicks:      number
}

function mapBufferStats(post: BufferSentPost): MappedStats {
  const s = post.statistics ?? { reach: null, clicks: null, likes: null, comments: null, shares: null, favorites: null }

  const likes       = (s.likes ?? 0) + (s.favorites ?? 0)
  const comments    = s.comments ?? 0
  const shares      = s.shares ?? 0
  const clicks      = s.clicks ?? 0
  const reach       = s.reach ?? 0
  // Estimate impressions from reach; if reach is zero, estimate from engagement
  const impressions = reach > 0 ? reach : Math.max(likes + comments + shares, 1) * 10

  return { impressions, likes, comments, shares, reach, clicks }
}

function calcEngagementRate(stats: MappedStats): number {
  if (stats.impressions <= 0) return 0
  return (stats.likes + stats.comments + stats.shares) / stats.impressions
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function runSync(brandId?: string): Promise<{
  synced: number
  brands_processed: number
  updated_tokens: string[]
}> {
  const supabase     = createServiceClient()
  const updatedTokens: string[] = []
  let synced         = 0
  let brandsProcessed = 0

  // Fetch Buffer tokens from social_accounts (platform = 'buffer')
  let accountsQuery = supabase
    .from("social_accounts")
    .select("brand_id, platform_access_token")
    .eq("platform", "buffer")
    .not("platform_access_token", "is", null)

  if (brandId) accountsQuery = accountsQuery.eq("brand_id", brandId)

  const { data: bufferAccounts, error: brandsError } = await accountsQuery
  if (brandsError || !bufferAccounts?.length) {
    return { synced: 0, brands_processed: 0, updated_tokens: [] }
  }

  // Deduplicate by brand_id (take first token per brand)
  const seenBrands = new Map<string, string>()
  for (const acct of bufferAccounts) {
    if (acct.brand_id && acct.platform_access_token && !seenBrands.has(acct.brand_id)) {
      seenBrands.set(acct.brand_id, acct.platform_access_token)
    }
  }

  const brands = Array.from(seenBrands.entries()).map(([id, token]) => ({ id, platform_access_token: token }))

  for (const brand of brands) {
    const accessToken = brand.platform_access_token
    if (!accessToken) continue

    try {
      const orgId      = await getOrganizationId(accessToken)
      const channelIds = await getChannelIds(accessToken, orgId)

      let brandSynced = 0

      for (const channelId of channelIds) {
        const sentPosts = await getSentPosts(accessToken, channelId)

        for (const bufPost of sentPosts) {
          const stats       = mapBufferStats(bufPost)
          const engRate     = calcEngagementRate(stats)

          // Try to find a matching post in our DB by buffer_post_id or text match
          const { data: matchedPost } = await supabase
            .from("posts")
            .select("id, scheduled_for, posted_at")
            .eq("brand_id", brand.id)
            .or(`buffer_post_id.eq.${bufPost.id},caption.ilike.${encodeURIComponent(bufPost.text.slice(0, 80).replace(/'/g, "''"))}`)
            .limit(1)
            .maybeSingle()

          if (!matchedPost) continue

          // Upsert into post_analytics
          const { error: upsertError } = await supabase
            .from("post_analytics")
            .upsert(
              {
                post_id:         matchedPost.id,
                impressions:     stats.impressions,
                reach:           stats.reach,
                likes:           stats.likes,
                comments:        stats.comments,
                shares:          stats.shares,
                clicks:          stats.clicks,
                saves:           0,            // Buffer does not expose saves
                engagement_rate: engRate,
                fetched_at:      new Date().toISOString(),
              },
              { onConflict: "post_id" },
            )

          if (upsertError) {
            console.error(`analytics/sync: upsert failed for post ${matchedPost.id}:`, upsertError.message)
            continue
          }

          brandSynced++

          // ── Token nudging ──────────────────────────────────────────────────

          // High engagement (>5%) → reinforce engagement_style
          if (engRate > 0.05) {
            await nudgeToken(
              brand.id,
              "engagement_style",
              "high",
              0.05,
              "analytics",
              matchedPost.id,
              { engagement_rate: engRate, source: "buffer_sync" },
              true,
            )
            if (!updatedTokens.includes("engagement_style")) {
              updatedTokens.push("engagement_style")
            }
          }

          // Best posting time → nudge best_posting_time if we have scheduling data
          const scheduledAt = matchedPost.scheduled_for ?? matchedPost.posted_at
          if (scheduledAt && engRate > 0.02) {
            const d    = new Date(scheduledAt)
            const hour = d.getHours()
            const day  = d.getDay()
            await nudgeToken(
              brand.id,
              "best_posting_time",
              `day${day}_hour${hour}`,
              0.03,
              "analytics",
              matchedPost.id,
              { hour, day_of_week: day, engagement_rate: engRate, source: "buffer_sync" },
              true,
            )
            if (!updatedTokens.includes("best_posting_time")) {
              updatedTokens.push("best_posting_time")
            }
          }
        }
      }

      synced           += brandSynced
      brandsProcessed  += 1
    } catch (err) {
      console.error(`analytics/sync: brand ${brand.id} failed:`, (err as Error).message)
    }
  }

  return { synced, brands_processed: brandsProcessed, updated_tokens: updatedTokens }
}

// ─── GET — Vercel cron ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "")
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runSync()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("GET /api/analytics/sync:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST — manual trigger ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Resolve the caller's active brand
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("account_id", user.id)
    .limit(1)
    .maybeSingle()

  const brandId = brand?.id as string | undefined

  try {
    const result = await runSync(brandId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("POST /api/analytics/sync:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
