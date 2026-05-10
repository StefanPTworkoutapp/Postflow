/**
 * Analytics dashboard — /analytics
 *
 * Server component. Loads:
 *   - 90-day posted posts with analytics
 *   - performance_patterns (pre-computed weekly)
 *
 * Displays:
 *   - Overview KPI cards
 *   - Platform comparison bars
 *   - Top posts table (by engagement rate)
 *   - Posting time heatmap (day × hour from real data)
 *   - Content intelligence (pillars, hashtags, post types)
 */

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  BarChart2,
  TrendingUp,
  Eye,
  Heart,
  Users,
  Clock,
  Hash,
  ImageIcon,
  Info,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface PostAnalyticsRow {
  impressions:     number
  reach:           number
  engagement_rate: number | null
  likes:           number
  comments:        number
  shares:          number
  saves:           number
}

interface PostWithAnalytics {
  id:                  string
  platform:            string
  caption:             string | null
  generated_image_url: string | null
  posted_at:           string | null
  scheduled_for:       string | null
  post_analytics:      PostAnalyticsRow | PostAnalyticsRow[] | null
  content_calendar:    { topic: string | null; content_pillar: string | null } | null
}

interface PerformancePattern {
  platform:             string
  avg_engagement_rate:  number | null
  avg_impressions:      number | null
  avg_reach:            number | null
  best_days_of_week:    number[] | null
  best_hours_of_day:    number[] | null
  best_content_pillars: string[] | null
  best_post_types:      string[] | null
  top_hashtags:         string[] | null
  sample_size:          number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500",
  linkedin:  "bg-blue-600",
  facebook:  "bg-blue-500",
  tiktok:    "bg-zinc-900",
  x:         "bg-zinc-700",
  threads:   "bg-zinc-800",
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  linkedin:  "LinkedIn",
  facebook:  "Facebook",
  tiktok:    "TikTok",
  x:         "X (Twitter)",
  threads:   "Threads",
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function fmtEngagement(rate: number | null): string {
  if (rate == null) return "—"
  return `${(rate * 100).toFixed(2)}%`
}

function fmtNumber(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getAnalytics(post: PostWithAnalytics): PostAnalyticsRow | null {
  if (!post.post_analytics) return null
  return Array.isArray(post.post_analytics)
    ? post.post_analytics[0] ?? null
    : post.post_analytics
}

/** Build a 7×24 engagement heatmap matrix from raw posts */
function buildHeatmap(posts: PostWithAnalytics[]): { matrix: number[][]; maxVal: number } {
  // matrix[day][hour] = sum of engagement_rate across posts in that slot
  const counts  = Array.from({ length: 7 }, () => Array(24).fill(0))
  const sums    = Array.from({ length: 7 }, () => Array(24).fill(0))

  for (const post of posts) {
    const a = getAnalytics(post)
    if (!a?.engagement_rate) continue
    const dateStr = post.posted_at ?? post.scheduled_for
    if (!dateStr) continue
    const d    = new Date(dateStr)
    const day  = d.getDay()
    const hour = d.getHours()
    sums[day][hour]   += a.engagement_rate
    counts[day][hour] += 1
  }

  const matrix = sums.map((row, d) =>
    row.map((sum, h) => counts[d][h] > 0 ? sum / counts[d][h] : 0)
  )
  const maxVal = Math.max(...matrix.flat(), 0.0001)
  return { matrix, maxVal }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const brand    = await getBrand()

  if (!brand) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <BarChart2 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">
          Create your brand to start seeing analytics.
        </p>
        <Link href="/brand" className="text-sm text-indigo-500 hover:underline">
          Set up brand →
        </Link>
      </div>
    )
  }

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [
    { data: rawPosts },
    { data: patterns },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(`
        id, platform, caption, generated_image_url, posted_at, scheduled_for,
        post_analytics(impressions, reach, engagement_rate, likes, comments, shares, saves),
        content_calendar(topic, content_pillar)
      `)
      .eq("brand_id", brand.id)
      .eq("status", "posted")
      .gte("posted_at", ninetyDaysAgo.toISOString())
      .order("posted_at", { ascending: false })
      .limit(200),

    supabase
      .from("performance_patterns")
      .select("platform, avg_engagement_rate, avg_impressions, avg_reach, best_days_of_week, best_hours_of_day, best_content_pillars, best_post_types, top_hashtags, sample_size")
      .eq("brand_id", brand.id)
      .order("avg_engagement_rate", { ascending: false }),
  ])

  const posts         = (rawPosts ?? []) as unknown as PostWithAnalytics[]
  const perfPatterns  = (patterns ?? []) as PerformancePattern[]

  // ── Overview metrics ──────────────────────────────────────────────────────
  let totalImpressions = 0
  let totalReach       = 0
  let totalLikes       = 0
  let engRates: number[] = []

  for (const post of posts) {
    const a = getAnalytics(post)
    if (!a) continue
    totalImpressions += a.impressions ?? 0
    totalReach       += a.reach ?? 0
    totalLikes       += a.likes ?? 0
    if (a.engagement_rate != null) engRates.push(a.engagement_rate)
  }

  const avgEngRate = engRates.length
    ? engRates.reduce((a, b) => a + b, 0) / engRates.length
    : null

  // Best platform by avg engagement from performance_patterns
  const bestPattern = perfPatterns[0] ?? null

  // ── Top posts ─────────────────────────────────────────────────────────────
  const topPosts = [...posts]
    .filter(p => getAnalytics(p)?.engagement_rate != null)
    .sort((a, b) => (getAnalytics(b)?.engagement_rate ?? 0) - (getAnalytics(a)?.engagement_rate ?? 0))
    .slice(0, 8)

  // ── Heatmap ───────────────────────────────────────────────────────────────
  const { matrix: heatMatrix, maxVal: heatMax } = buildHeatmap(posts)

  // Which hours have ANY data across all days
  const activeHours = Array.from({ length: 24 }, (_, h) => h)
    .filter(h => heatMatrix.some(row => row[h] > 0))

  // ── Platform stats aggregated from raw posts (fallback if no patterns yet) ─
  const platformStats = new Map<string, { impressions: number; likes: number; rates: number[]; count: number }>()
  for (const post of posts) {
    const a = getAnalytics(post)
    if (!a) continue
    const s = platformStats.get(post.platform) ?? { impressions: 0, likes: 0, rates: [], count: 0 }
    s.impressions += a.impressions ?? 0
    s.likes       += a.likes ?? 0
    if (a.engagement_rate != null) s.rates.push(a.engagement_rate)
    s.count++
    platformStats.set(post.platform, s)
  }

  // Merge with performance_patterns (patterns take precedence for avg)
  const platformComparison = Array.from(platformStats.entries())
    .map(([platform, s]) => {
      const pattern = perfPatterns.find(p => p.platform === platform)
      return {
        platform,
        count:       s.count,
        impressions: s.impressions,
        avgEngRate:  pattern?.avg_engagement_rate
          ?? (s.rates.length ? s.rates.reduce((a, b) => a + b, 0) / s.rates.length : null),
      }
    })
    .sort((a, b) => (b.avgEngRate ?? 0) - (a.avgEngRate ?? 0))

  const maxEngRate = Math.max(...platformComparison.map(p => p.avgEngRate ?? 0), 0.0001)

  // ── Pillars + hashtags (merge across all patterns) ────────────────────────
  const pillarCounts  = new Map<string, number>()
  const hashtagCounts = new Map<string, number>()
  for (const p of perfPatterns) {
    for (const pillar  of p.best_content_pillars ?? []) pillarCounts.set(pillar, (pillarCounts.get(pillar) ?? 0) + 1)
    for (const hashtag of p.top_hashtags ?? [])         hashtagCounts.set(hashtag, (hashtagCounts.get(hashtag) ?? 0) + 1)
  }
  const topPillars  = [...pillarCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k)
  const topHashtags = [...hashtagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k)

  const hasData = posts.length > 0

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 90 days · {posts.length} published posts</p>
      </div>

      {/* No data state */}
      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <BarChart2 className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-medium text-muted-foreground">No analytics yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Analytics appear once your posts are published and synced.
              </p>
            </div>
            <Link href="/calendar" className="text-sm text-indigo-500 hover:underline">
              Go to calendar →
            </Link>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Eye className="h-4 w-4" />}
              label="Total Impressions"
              value={fmtNumber(totalImpressions)}
              sub="90 days"
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Avg Engagement"
              value={fmtEngagement(avgEngRate)}
              sub={`${engRates.length} posts`}
              highlight={avgEngRate != null && avgEngRate > 0.02}
            />
            <KpiCard
              icon={<Heart className="h-4 w-4" />}
              label="Total Likes"
              value={fmtNumber(totalLikes)}
              sub="across all platforms"
            />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Total Reach"
              value={fmtNumber(totalReach)}
              sub="unique accounts"
            />
          </div>

          {/* ── Platform Comparison ─────────────────────────────────────── */}
          {platformComparison.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Platform Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {platformComparison.map(({ platform, count, avgEngRate: rate, impressions }) => {
                  const barW = rate != null ? Math.round((rate / maxEngRate) * 100) : 0
                  return (
                    <div key={platform} className="grid grid-cols-[120px_1fr_100px_80px] items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", PLATFORM_COLORS[platform] ?? "bg-zinc-400")} />
                        <span className="text-sm font-medium truncate">
                          {PLATFORM_LABEL[platform] ?? platform}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", PLATFORM_COLORS[platform] ?? "bg-indigo-400")}
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-right font-mono tabular-nums">
                        {fmtEngagement(rate)}
                      </div>
                      <div className="text-xs text-right text-muted-foreground">
                        {fmtNumber(impressions)} impr
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Engagement = (likes + comments + shares + saves) ÷ impressions
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Top Posts ───────────────────────────────────────────────── */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Top Posts by Engagement</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 pl-6 font-medium">Post</th>
                        <th className="text-left py-2 font-medium">Platform</th>
                        <th className="text-right py-2 font-medium">Eng %</th>
                        <th className="text-right py-2 font-medium">Impressions</th>
                        <th className="text-right py-2 font-medium">Likes</th>
                        <th className="text-right py-2 pr-6 font-medium">Saves</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPosts.map(post => {
                        const a    = getAnalytics(post)!
                        const date = post.posted_at
                          ? new Date(post.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : "—"
                        const snippet = post.content_calendar?.topic
                          ?? post.caption?.slice(0, 60)
                          ?? "—"
                        return (
                          <tr key={post.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-3 pl-6 pr-4">
                              <div className="flex items-center gap-3">
                                {post.generated_image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={post.generated_image_url}
                                    alt=""
                                    className="h-9 w-9 rounded object-cover shrink-0 bg-zinc-100"
                                  />
                                ) : (
                                  <div className="h-9 w-9 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate max-w-[200px] font-medium text-foreground/90">{snippet}</p>
                                  <p className="text-xs text-muted-foreground">{date}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              <Badge variant="secondary" className="text-xs capitalize">
                                {post.platform}
                              </Badge>
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">
                              {fmtEngagement(a.engagement_rate)}
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">
                              {fmtNumber(a.impressions)}
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">
                              {fmtNumber(a.likes)}
                            </td>
                            <td className="py-3 pr-6 text-right font-mono tabular-nums text-muted-foreground">
                              {fmtNumber(a.saves)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* ── Posting Time Heatmap ─────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Best Posting Times
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Avg engagement rate by day & hour (Amsterdam time)
                </p>
              </CardHeader>
              <CardContent>
                {activeHours.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Not enough data yet — keep posting!
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[320px]">
                      {/* Hour labels */}
                      <div className="flex mb-1 ml-9 gap-0.5">
                        {activeHours.map(h => (
                          <div key={h} className="w-6 shrink-0 text-center text-[9px] text-muted-foreground/60 leading-none">
                            {h}
                          </div>
                        ))}
                      </div>
                      {/* Rows */}
                      {DAY_LABELS.map((day, d) => (
                        <div key={d} className="flex items-center gap-0.5 mb-0.5">
                          <span className="w-8 shrink-0 text-xs text-muted-foreground text-right pr-1.5">
                            {day}
                          </span>
                          {activeHours.map(h => {
                            const val      = heatMatrix[d][h]
                            const opacity  = val > 0 ? 0.15 + (val / heatMax) * 0.85 : 0
                            const hasValue = val > 0
                            return (
                              <div
                                key={h}
                                title={hasValue ? `${fmtEngagement(val)} avg engagement` : undefined}
                                className={cn(
                                  "w-6 h-5 rounded-sm shrink-0 transition-opacity",
                                  hasValue ? "bg-indigo-500" : "bg-zinc-100 dark:bg-zinc-800"
                                )}
                                style={hasValue ? { opacity } : undefined}
                              />
                            )
                          })}
                        </div>
                      ))}
                      {/* Legend */}
                      <div className="flex items-center gap-2 mt-3 justify-end">
                        <span className="text-[10px] text-muted-foreground">Less</span>
                        {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
                          <div key={o} className="w-3 h-3 rounded-sm bg-indigo-500" style={{ opacity: o }} />
                        ))}
                        <span className="text-[10px] text-muted-foreground">More</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Content Intelligence ─────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Content Intelligence
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Patterns from your best-performing posts
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {perfPatterns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Patterns are computed weekly. Check back after the next Sunday.
                  </p>
                ) : (
                  <>
                    {/* Best days across all platforms */}
                    {(() => {
                      const allBestDays = perfPatterns.flatMap(p => p.best_days_of_week ?? [])
                      const dayCounts   = new Map<number, number>()
                      for (const d of allBestDays) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
                      const sorted = [...dayCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
                      if (!sorted.length) return null
                      return (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Best days to post
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {sorted.map(([day]) => (
                              <Badge key={day} variant="secondary" className="text-xs">
                                {DAY_LABELS[day]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Best content pillars */}
                    {topPillars.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Top content pillars
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {topPillars.map(pillar => (
                            <Badge key={pillar} className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0">
                              {pillar}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top hashtags */}
                    {topHashtags.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Hash className="h-3 w-3" /> Top hashtags
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {topHashtags.map(tag => (
                            <span key={tag} className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">
                              #{tag.replace(/^#/, "")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Per-platform sample sizes */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Sample sizes (90 days)
                      </p>
                      <div className="space-y-1">
                        {perfPatterns.map(p => (
                          <div key={p.platform} className="flex items-center justify-between text-xs">
                            <span className="capitalize text-foreground/70">{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                            <span className="font-mono text-muted-foreground">{p.sample_size} posts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  highlight = false,
}: {
  icon:       React.ReactNode
  label:      string
  value:      string
  sub:        string
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className={cn(
          "text-3xl font-bold tracking-tight",
          highlight ? "text-indigo-600 dark:text-indigo-400" : "text-foreground"
        )}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}
