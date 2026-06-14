/**
 * /insights — merged Analytics + Trend Builder page
 *
 * Tab navigation via URL param: ?tab=analytics (default) | trends
 * Server component: reads searchParams, fetches data, renders the right content.
 */

import type { Metadata }   from "next"
import { Suspense }        from "react"
import { redirect }        from "next/navigation"
import Link                from "next/link"
import { createClient }    from "@/lib/supabase/server"
import { getActiveBrand }        from "@/lib/server/brand/getActiveBrand"
import { InsightsTabBar }  from "./InsightsTabBar"
import { SyncButton }      from "./SyncButton"
import { TrendClient }     from "../trend/TrendClient"
import { PageSkeleton }    from "@/components/ui/PageSkeleton"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }    from "@/components/ui/badge"
import { cn }       from "@/lib/utils"
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
  Brain,
  LayoutTemplate,
} from "lucide-react"

export const metadata: Metadata = { title: "PostFlow · Insights" }

// ── Types ─────────────────────────────────────────────────────────────────────

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
  id:                   string
  platform:             string
  caption:              string | null
  generated_image_url:  string | null
  posted_at:            string | null
  scheduled_for:        string | null
  post_analytics:       PostAnalyticsRow | PostAnalyticsRow[] | null
  content_calendar:     { topic: string | null; content_pillar: string | null; post_type?: string | null } | null
  predicted_performance?: { token_snapshot?: Record<string, unknown>; captured_at?: string } | null
  actual_performance?:    { engagement_rate?: number | null; impressions?: number | null; fetched_at?: string } | null
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getAnalytics(post: PostWithAnalytics): PostAnalyticsRow | null {
  if (!post.post_analytics) return null
  return Array.isArray(post.post_analytics)
    ? post.post_analytics[0] ?? null
    : post.post_analytics
}

function buildHeatmap(posts: PostWithAnalytics[]): { matrix: number[][]; maxVal: number } {
  const counts = Array.from({ length: 7 }, () => Array(24).fill(0))
  const sums   = Array.from({ length: 7 }, () => Array(24).fill(0))

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

// ── Template helpers ──────────────────────────────────────────────────────────

interface TemplateHealthRow {
  template_slug: string
  health_score:  number
  trend:         string | null
  posts_count:   number
}

interface TemplateSuggestionRow {
  current_slug:   string
  suggested_slug: string
  reason:         string | null
  status:         string
}

function toHumanTemplateName(slug: string): string {
  return slug
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function templateScoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
}

function templateTrendLabel(trend: string | null): { label: string; className: string } {
  switch (trend) {
    case "rising":   return { label: "↑ rising",   className: "text-green-600 dark:text-green-400" }
    case "declining":return { label: "↓ declining", className: "text-red-500 dark:text-red-400" }
    default:         return { label: "→ stable",    className: "text-zinc-400 dark:text-zinc-500" }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, highlight = false,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean
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

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "analytics" | "trends"

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; postType?: string }>
}) {
  const params    = await searchParams
  const activeTab = (params.tab as Tab | undefined) ?? "analytics"
  const postTypeFilter = params.postType ?? "all"

  const supabase = await createClient()
  const brand    = await getActiveBrand()

  // For the trends tab, brand must exist (guard)
  if (activeTab === "trends" && !brand) redirect("/onboarding")

  // ── Analytics data (always fetched for analytics tab) ─────────────────────
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [{ data: rawPosts }, { data: patterns }, { data: templateHealth }, { data: templateSuggestions }] = brand
    ? await Promise.all([
        supabase
          .from("posts")
          .select(`
            id, platform, caption, generated_image_url, posted_at, scheduled_for,
            predicted_performance, actual_performance,
            post_analytics(impressions, reach, engagement_rate, likes, comments, shares, saves),
            content_calendar(topic, content_pillar, post_type)
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

        supabase
          .from("template_health")
          .select("template_slug, health_score, trend, posts_count")
          .eq("brand_id", brand.id)
          .gte("posts_count", 1)
          .order("health_score", { ascending: false })
          .limit(8),

        supabase
          .from("template_suggestions")
          .select("current_slug, suggested_slug, reason, status")
          .eq("brand_id", brand.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(3),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const posts            = (rawPosts ?? []) as unknown as PostWithAnalytics[]
  const perfPatterns     = (patterns ?? []) as PerformancePattern[]
  const templateHealthRows  = (templateHealth ?? []) as TemplateHealthRow[]
  const templateSuggestionRows = (templateSuggestions ?? []) as TemplateSuggestionRow[]

  // ── Overview metrics ───────────────────────────────────────────────────────
  let totalImpressions = 0
  let totalReach       = 0
  let totalLikes       = 0
  const engRates: number[] = []

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

  const POST_TYPE_VALUES: Record<string, string> = {
    photo:    "photo",
    carousel: "carousel",
    reel:     "reel",
    story:    "story",
  }

  const topPosts = [...posts]
    .filter(p => {
      if (!getAnalytics(p)?.engagement_rate) return false
      if (postTypeFilter === "all" || !POST_TYPE_VALUES[postTypeFilter]) return true
      const pt = (p.content_calendar as any)?.post_type as string | null | undefined
      return pt === POST_TYPE_VALUES[postTypeFilter]
    })
    .sort((a, b) => (getAnalytics(b)?.engagement_rate ?? 0) - (getAnalytics(a)?.engagement_rate ?? 0))
    .slice(0, 8)

  const { matrix: heatMatrix, maxVal: heatMax } = buildHeatmap(posts)
  const activeHours = Array.from({ length: 24 }, (_, h) => h)
    .filter(h => heatMatrix.some(row => row[h] > 0))

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Analytics and trend intelligence for your brand.
        </p>
      </div>

      {/* Tab bar */}
      <InsightsTabBar activeTab={activeTab} />

      {/* ── Analytics tab ───────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="max-w-6xl space-y-8">

          {!brand && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <BarChart2 className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">Create your brand to start seeing analytics.</p>
              <Link href="/brand" className="text-sm text-indigo-500 hover:underline">Set up brand →</Link>
            </div>
          )}

          {brand && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Last 90 days · {posts.length} published posts</p>
                <SyncButton />
              </div>

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
                    <Link href="/schedule?tab=calendar" className="text-sm text-indigo-500 hover:underline">
                      Go to calendar →
                    </Link>
                  </CardContent>
                </Card>
              )}

              {hasData && (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={<Eye className="h-4 w-4" />} label="Total Impressions" value={fmtNumber(totalImpressions)} sub="90 days" />
                    <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Avg Engagement" value={fmtEngagement(avgEngRate)} sub={`${engRates.length} posts`} highlight={avgEngRate != null && avgEngRate > 0.02} />
                    <KpiCard icon={<Heart className="h-4 w-4" />} label="Total Likes" value={fmtNumber(totalLikes)} sub="across all platforms" />
                    <KpiCard icon={<Users className="h-4 w-4" />} label="Total Reach" value={fmtNumber(totalReach)} sub="unique accounts" />
                  </div>

                  {/* Platform Comparison */}
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
                                <span className="text-sm font-medium truncate">{PLATFORM_LABEL[platform] ?? platform}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                  <div className={cn("h-full rounded-full transition-all", PLATFORM_COLORS[platform] ?? "bg-indigo-400")} style={{ width: `${barW}%` }} />
                                </div>
                              </div>
                              <div className="text-sm text-right font-mono tabular-nums">{fmtEngagement(rate)}</div>
                              <div className="text-xs text-right text-muted-foreground">{fmtNumber(impressions)} impr · {count}</div>
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

                  {/* Template Performance */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                        Template performance
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Which post formats are working</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {templateHealthRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 text-center">
                          No template data yet — generate and post content to see which formats perform best.
                        </p>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-xs text-muted-foreground">
                                  <th className="text-left py-2 font-medium">Template</th>
                                  <th className="text-center py-2 font-medium">Score</th>
                                  <th className="text-left py-2 font-medium">Trend</th>
                                  <th className="text-right py-2 font-medium">Posts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {templateHealthRows.map(row => {
                                  const trend = templateTrendLabel(row.trend)
                                  return (
                                    <tr key={row.template_slug} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                      <td className="py-2.5 pr-4">
                                        <span className="font-medium text-foreground/90">{toHumanTemplateName(row.template_slug)}</span>
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums", templateScoreColor(row.health_score))}>
                                          {row.health_score}
                                        </span>
                                      </td>
                                      <td className="py-2.5">
                                        <span className={cn("text-xs font-medium", trend.className)}>{trend.label}</span>
                                      </td>
                                      <td className="py-2.5 text-right text-xs text-muted-foreground">{row.posts_count} posts</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                          {templateSuggestionRows.length > 0 && (
                            <div className="space-y-2 pt-1">
                              {templateSuggestionRows.map((s, i) => (
                                <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                                  <span className="font-medium">Consider replacing</span>{" "}
                                  <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">{toHumanTemplateName(s.current_slug)}</span>{" "}
                                  <span className="font-medium">with</span>{" "}
                                  <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">{toHumanTemplateName(s.suggested_slug)}</span>
                                  {s.reason && <> — {s.reason}</>}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Posts */}
                    <Card className="lg:col-span-2">
                      <CardHeader className="pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <CardTitle className="text-base font-semibold">Top Posts by Engagement</CardTitle>
                          {/* Post-type filter chips */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { key: "all",      label: "All" },
                              { key: "photo",    label: "Photo" },
                              { key: "carousel", label: "Carousel" },
                              { key: "reel",     label: "Reel / Video" },
                              { key: "story",    label: "Story" },
                            ].map(({ key, label }) => (
                              <Link
                                key={key}
                                href={`?tab=analytics&postType=${key}`}
                                className={cn(
                                  "text-xs px-2.5 py-1 rounded-full border font-medium transition-colors",
                                  (postTypeFilter === key || (key === "all" && postTypeFilter === "all"))
                                    ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500"
                                    : "bg-transparent text-muted-foreground border-border hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                )}
                              >
                                {label}
                              </Link>
                            ))}
                          </div>
                        </div>
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
                              {topPosts.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                    No posts found for this filter.
                                  </td>
                                </tr>
                              ) : topPosts.map(post => {
                                const a       = getAnalytics(post)!
                                const date    = post.posted_at ? new Date(post.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"
                                const snippet = post.content_calendar?.topic ?? post.caption?.slice(0, 60) ?? "—"
                                return (
                                  <tr key={post.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-3 pl-6 pr-4">
                                      <div className="flex items-center gap-3">
                                        {post.generated_image_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={post.generated_image_url} alt="" className="h-9 w-9 rounded object-cover shrink-0 bg-zinc-100" />
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
                                    <td className="py-3"><Badge variant="secondary" className="text-xs capitalize">{post.platform}</Badge></td>
                                    <td className="py-3 text-right font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">{fmtEngagement(a.engagement_rate)}</td>
                                    <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">{fmtNumber(a.impressions)}</td>
                                    <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">{fmtNumber(a.likes)}</td>
                                    <td className="py-3 pr-6 text-right font-mono tabular-nums text-muted-foreground">{fmtNumber(a.saves)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Posting Time Heatmap */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Best Posting Times
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Avg engagement rate by day & hour (Amsterdam time)</p>
                      </CardHeader>
                      <CardContent>
                        {activeHours.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">Not enough data yet — keep posting!</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <div className="min-w-[320px]">
                              <div className="flex mb-1 ml-9 gap-0.5">
                                {activeHours.map(h => (
                                  <div key={h} className="w-6 shrink-0 text-center text-[9px] text-muted-foreground/60 leading-none">{h}</div>
                                ))}
                              </div>
                              {DAY_LABELS.map((day, d) => (
                                <div key={d} className="flex items-center gap-0.5 mb-0.5">
                                  <span className="w-8 shrink-0 text-xs text-muted-foreground text-right pr-1.5">{day}</span>
                                  {activeHours.map(h => {
                                    const val     = heatMatrix[d][h]
                                    const opacity = val > 0 ? 0.15 + (val / heatMax) * 0.85 : 0
                                    const hasVal  = val > 0
                                    return (
                                      <div
                                        key={h}
                                        title={hasVal ? `${fmtEngagement(val)} avg engagement` : undefined}
                                        className={cn("w-6 h-5 rounded-sm shrink-0 transition-opacity", hasVal ? "bg-indigo-500" : "bg-zinc-100 dark:bg-zinc-800")}
                                        style={hasVal ? { opacity } : undefined}
                                      />
                                    )
                                  })}
                                </div>
                              ))}
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

                    {/* Content Intelligence */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          Content Intelligence
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Patterns from your best-performing posts</p>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {perfPatterns.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            Patterns are computed weekly. Check back after the next Sunday.
                          </p>
                        ) : (
                          <>
                            {(() => {
                              const allBestDays = perfPatterns.flatMap(p => p.best_days_of_week ?? [])
                              const dayCounts   = new Map<number, number>()
                              for (const d of allBestDays) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
                              const sorted = [...dayCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
                              if (!sorted.length) return null
                              return (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Best days to post</p>
                                  <div className="flex flex-wrap gap-2">
                                    {sorted.map(([day]) => (
                                      <Badge key={day} variant="secondary" className="text-xs">{DAY_LABELS[day]}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )
                            })()}
                            {topPillars.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Top content pillars</p>
                                <div className="flex flex-wrap gap-2">
                                  {topPillars.map(pillar => (
                                    <Badge key={pillar} className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0">{pillar}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
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
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Sample sizes (90 days)</p>
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

                  {/* Prediction Accuracy Tracking */}
                  {(() => {
                    const thirtyDaysAgo = new Date()
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                    const trackedPosts = posts.filter(p =>
                      p.predicted_performance != null && p.actual_performance != null &&
                      p.posted_at && new Date(p.posted_at) >= thirtyDaysAgo
                    )
                    const pendingPosts = posts.filter(p =>
                      p.predicted_performance != null && p.actual_performance == null
                    )
                    if (trackedPosts.length === 0 && pendingPosts.length === 0) return null
                    const engRatesTracked = trackedPosts.map(p => p.actual_performance?.engagement_rate).filter((r): r is number => r != null)
                    const avgTrackedEng   = engRatesTracked.length ? engRatesTracked.reduce((a, b) => a + b, 0) / engRatesTracked.length : null
                    return (
                      <Card>
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Brain className="h-4 w-4 text-muted-foreground" />
                            Prediction Tracking
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Posts where brand intelligence was captured at schedule time and verified after publishing
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold tabular-nums">{trackedPosts.length}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Full cycles (last 30d)</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold tabular-nums">{pendingPosts.length}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Awaiting analytics</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                                {avgTrackedEng != null ? `${(avgTrackedEng * 100).toFixed(2)}%` : "—"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">Avg actual engagement</p>
                            </div>
                          </div>
                          {trackedPosts.length > 0 && (
                            <div className="overflow-x-auto border rounded-lg">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pl-4 font-medium">Post</th>
                                    <th className="text-left py-2 font-medium">Platform</th>
                                    <th className="text-right py-2 font-medium">Actual Eng%</th>
                                    <th className="text-right py-2 font-medium">Impressions</th>
                                    <th className="text-right py-2 pr-4 font-medium">Tracked</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {trackedPosts.slice(0, 10).map(post => {
                                    const eng       = post.actual_performance?.engagement_rate
                                    const imp       = post.actual_performance?.impressions
                                    const topic     = post.content_calendar?.topic ?? post.caption?.slice(0, 40)
                                    const fetchedAt = post.actual_performance?.fetched_at
                                    return (
                                      <tr key={post.id} className="border-b last:border-0">
                                        <td className="py-2 pl-4 pr-4 max-w-[200px]"><span className="truncate block text-foreground/80">{topic ?? "—"}</span></td>
                                        <td className="py-2"><span className="capitalize text-muted-foreground">{post.platform}</span></td>
                                        <td className="py-2 text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{eng != null ? `${(eng * 100).toFixed(2)}%` : "—"}</td>
                                        <td className="py-2 text-right font-mono text-muted-foreground">{imp != null ? fmtNumber(imp) : "—"}</td>
                                        <td className="py-2 pr-4 text-right text-muted-foreground">{fetchedAt ? new Date(fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                            <Info className="h-3 w-3 shrink-0" />
                            Brand intelligence snapshot captured at schedule time.{" "}
                            <Link href="/brand?tab=intelligence" className="text-indigo-500 hover:underline">
                              View token confidence →
                            </Link>
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Trends tab ──────────────────────────────────────────────────────── */}
      {activeTab === "trends" && (
        <Suspense fallback={<PageSkeleton rows={5} />}>
          <TrendClient />
        </Suspense>
      )}
    </div>
  )
}
