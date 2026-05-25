/**
 * Brand Intelligence dashboard — /brand-intelligence
 *
 * Shows how PostFlow is learning from this brand's performance:
 *   - Token confidence chart — how certain PostFlow is about each brand style token
 *   - Signal source breakdown — where confidence comes from (calibration / analytics / feedback / inspiration)
 *   - Stuck tokens alert — tokens that haven't been updated in 30+ days
 *   - Recent token activity feed — last 20 nudgeToken() events with source + context
 *
 * Server component. All data loaded server-side — no client interactivity needed.
 */

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
  BarChart2,
  Zap,
  MessageSquare,
  Star,
  Info,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenEntry {
  value:              string | number | string[]
  confidence:         number
  calibration_locked?: boolean
  range?:             [number, number]
  options?:           string[]
}

interface TokenEventRow {
  id:               string
  token_key:        string
  old_value:        string | null
  new_value:        string | null
  old_confidence:   number | null
  new_confidence:   number | null
  signal_type:      string
  signal_source_id: string | null
  signal_detail:    Record<string, unknown> | null
  created_at:       string
}

interface AnalyticsProcessedRow {
  brand_id:        string
  post_id:         string
  platform:        string
  signals_applied: number
  processed_at:    string
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Human-readable labels for token keys */
const TOKEN_LABELS: Record<string, string> = {
  hook_style:                   "Hook style",
  hook_duration_seconds:        "Hook duration",
  pacing:                       "Video pacing",
  transition_style:             "Transitions",
  text_overlay_style:           "Text overlay",
  music_energy:                 "Music energy",
  music_genre:                  "Music genre",
  best_performing_cta:          "Best CTA",
  audience_responds_to:         "Audience responds to",
  audience_drops_at:            "Audience drops at",
  caption_tone:                 "Caption tone",
  hashtag_strategy:             "Hashtag strategy",
  carousel_hook_style:          "Carousel hook",
  carousel_slide_count:         "Slide count",
  carousel_slide_pacing:        "Slide pacing",
  carousel_content_mix:         "Content mix",
  carousel_best_goal:           "Best carousel goal",
  carousel_text_overlay_density:"Text density",
  carousel_vs_reel_preference:     "Carousel vs Reel",
  style_volatility_preference:     "Style balance",
  best_post_goal:                  "Best post goal",
  best_content_duration_seconds:   "Best content length",
  best_cta_style:                  "Best CTA style",
}

const SIGNAL_LABELS: Record<string, string> = {
  analytics:   "Analytics",
  feedback:    "Your feedback",
  calibration: "Calibration",
  inspiration: "Inspiration",
  manual:      "Manual",
  reject:      "Rejected",
}

const SIGNAL_COLORS: Record<string, string> = {
  analytics:   "bg-blue-500",
  feedback:    "bg-green-500",
  calibration: "bg-indigo-500",
  inspiration: "bg-purple-500",
  manual:      "bg-amber-500",
  reject:      "bg-red-400",
}

const SIGNAL_ICON: Record<string, React.ElementType> = {
  analytics:   BarChart2,
  feedback:    MessageSquare,
  calibration: Star,
  inspiration: Zap,
  manual:      CheckCircle2,
  reject:      AlertTriangle,
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceLabel(c: number): string {
  if (c >= 0.80) return "High"
  if (c >= 0.55) return "Medium"
  if (c >= 0.30) return "Low"
  return "Default"
}

function confidenceColor(c: number): string {
  if (c >= 0.80) return "text-green-600 dark:text-green-400"
  if (c >= 0.55) return "text-amber-600 dark:text-amber-400"
  if (c >= 0.30) return "text-orange-500 dark:text-orange-400"
  return "text-zinc-400"
}

function confidenceBarColor(c: number): string {
  if (c >= 0.80) return "bg-green-500"
  if (c >= 0.55) return "bg-amber-400"
  if (c >= 0.30) return "bg-orange-400"
  return "bg-zinc-200 dark:bg-zinc-700"
}

function formatValue(value: string | number | string[]): string {
  if (Array.isArray(value)) return value.slice(0, 3).join(", ") + (value.length > 3 ? "…" : "")
  return String(value)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 2)   return "just now"
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BrandIntelligencePage() {
  const supabase = await createClient()
  const brand    = await getBrand()

  if (!brand) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <Brain className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Create your brand to start building intelligence.</p>
        <Link href="/brand" className="text-sm text-indigo-500 hover:underline">Set up brand →</Link>
      </div>
    )
  }

  // ── Load data ────────────────────────────────────────────────────────────────
  const [
    { data: rawEvents },
    { data: rawProcessed },
  ] = await Promise.all([
    // Last 100 token events — enough for source breakdown + activity feed
    supabase
      .from("brand_token_events")
      .select("id, token_key, old_value, new_value, old_confidence, new_confidence, signal_type, signal_source_id, signal_detail, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(100),

    supabase
      .from("analytics_processed")
      .select("brand_id, post_id, platform, signals_applied, processed_at")
      .eq("brand_id", brand.id)
      .order("processed_at", { ascending: false })
      .limit(50),
  ])

  const events    = (rawEvents ?? []) as TokenEventRow[]
  const processed = (rawProcessed ?? []) as AnalyticsProcessedRow[]

  // ── Parse intelligence tokens ─────────────────────────────────────────────
  const rawTokens = (brand.intelligence_tokens ?? {}) as unknown as Record<string, TokenEntry>
  const tokenEntries = Object.entries(rawTokens)
    .filter(([, t]) => t && typeof t.confidence === "number")
    .sort((a, b) => b[1].confidence - a[1].confidence)

  // ── Signal source breakdown ───────────────────────────────────────────────
  const sourceCounts: Record<string, number> = {}
  for (const e of events) {
    sourceCounts[e.signal_type] = (sourceCounts[e.signal_type] ?? 0) + 1
  }
  const totalSignals    = Object.values(sourceCounts).reduce((a, b) => a + b, 0)
  const sourceBreakdown = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])

  // ── Stuck tokens — confidence still at default (< 0.25) for 30+ days ─────
  const recentTokenActivity = new Map<string, Date>()
  for (const e of events) {
    if (!recentTokenActivity.has(e.token_key)) {
      recentTokenActivity.set(e.token_key, new Date(e.created_at))
    }
  }

  const stuckTokens = tokenEntries.filter(([key, t]) => {
    if (t.confidence >= 0.25) return false  // not stuck if confidence is growing
    const lastActivity = recentTokenActivity.get(key)
    if (!lastActivity) return true  // never had any signal → stuck
    return Date.now() - lastActivity.getTime() > THIRTY_DAYS_MS
  })

  // ── Recent activity feed (last 20 events) ─────────────────────────────────
  const recentActivity = events.slice(0, 20)

  // ── Totals for summary row ────────────────────────────────────────────────
  const totalPosts         = new Set(processed.map(p => p.post_id)).size
  const totalSignalsApplied = processed.reduce((sum, p) => sum + (p.signals_applied ?? 0), 0)
  const highConfidenceCount = tokenEntries.filter(([, t]) => t.confidence >= 0.70).length
  const hasTokens           = tokenEntries.length > 0

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 text-indigo-500" />
          Brand Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How PostFlow is learning your brand's style from real performance data
        </p>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!hasTokens && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Brain className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-medium text-muted-foreground">No intelligence tokens yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Complete brand calibration to seed your first tokens.
              </p>
            </div>
            <Link href="/onboarding" className="text-sm text-indigo-500 hover:underline">
              Complete calibration →
            </Link>
          </CardContent>
        </Card>
      )}

      {hasTokens && (
        <>
          {/* ── Summary KPIs ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<Brain className="h-4 w-4" />}
              label="Active Tokens"
              value={String(tokenEntries.length)}
              sub={`${highConfidenceCount} high confidence`}
              highlight={highConfidenceCount > 0}
            />
            <SummaryCard
              icon={<Activity className="h-4 w-4" />}
              label="Signals Applied"
              value={String(totalSignals + totalSignalsApplied)}
              sub="total learning events"
            />
            <SummaryCard
              icon={<BarChart2 className="h-4 w-4" />}
              label="Posts Analysed"
              value={String(totalPosts)}
              sub="analytics processed"
            />
            <SummaryCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Sources"
              value={String(sourceBreakdown.length)}
              sub="active signal types"
            />
          </div>

          {/* ── Stuck tokens alert ────────────────────────────────────────── */}
          {stuckTokens.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {stuckTokens.length} token{stuckTokens.length !== 1 ? "s" : ""} stuck at default confidence
                </p>
                <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                  These haven't received any signals in 30+ days:{" "}
                  {stuckTokens.slice(0, 4).map(([key]) => TOKEN_LABELS[key] ?? key).join(", ")}
                  {stuckTokens.length > 4 && ` + ${stuckTokens.length - 4} more`}.
                  Schedule and publish posts to generate analytics signals.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Token confidence chart ────────────────────────────────── */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  Token Confidence
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How certain PostFlow is about each aspect of your brand style
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {tokenEntries.map(([key, token]) => {
                  const label      = TOKEN_LABELS[key] ?? key
                  const pct        = Math.round(token.confidence * 100)
                  const locked     = token.calibration_locked === true
                  const confLabel  = confidenceLabel(token.confidence)
                  const confColor  = confidenceColor(token.confidence)
                  const barColor   = confidenceBarColor(token.confidence)
                  return (
                    <div key={key} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium truncate">{label}</span>
                          {locked && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4 shrink-0">
                              calibrated
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs text-muted-foreground font-mono tabular-nums">
                            {formatValue(token.value)}
                          </span>
                          <span className={cn("text-xs font-semibold tabular-nums", confColor)}>
                            {pct}% · {confLabel}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", barColor)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}

                {/* Legend */}
                <div className="flex items-center gap-4 pt-2 border-t">
                  {[
                    { label: "Default", color: "bg-zinc-200 dark:bg-zinc-700" },
                    { label: "Low",     color: "bg-orange-400" },
                    { label: "Medium",  color: "bg-amber-400" },
                    { label: "High",    color: "bg-green-500" },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={cn("h-2 w-2 rounded-full", color)} />
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Confidence grows from analytics, feedback &amp; calibration
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Signal source breakdown ───────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Signal Sources</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Where learning signals come from
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {totalSignals === 0 && totalSignalsApplied === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No signals yet. Start posting to build intelligence.
                  </p>
                ) : (
                  sourceBreakdown.map(([source, count]) => {
                    const Icon  = SIGNAL_ICON[source] ?? Activity
                    const label = SIGNAL_LABELS[source] ?? source
                    const color = SIGNAL_COLORS[source] ?? "bg-zinc-400"
                    const pct   = totalSignals > 0 ? Math.round((count / totalSignals) * 100) : 0
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{count}</span>
                            <span className="text-xs text-muted-foreground/60">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}

                {/* Analytics processed summary */}
                {processed.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                      Analytics learning
                    </p>
                    <div className="space-y-1">
                      {["instagram", "linkedin", "tiktok"].map(platform => {
                        const rows = processed.filter(p => p.platform === platform)
                        if (!rows.length) return null
                        const total = rows.reduce((s, r) => s + (r.signals_applied ?? 0), 0)
                        return (
                          <div key={platform} className="flex justify-between text-xs">
                            <span className="capitalize text-foreground/70">{platform}</span>
                            <span className="font-mono text-muted-foreground">{total} signals · {rows.length} posts</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* ── Recent token activity feed ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Token Activity
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last 20 learning events — every time PostFlow updated a brand token
              </p>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No token updates yet.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Activity appears after your first post is published and analytics are synced.
                  </p>
                </div>
              ) : (
                <div className="space-y-0 divide-y">
                  {recentActivity.map((event) => {
                    const tokenLabel  = TOKEN_LABELS[event.token_key] ?? event.token_key
                    const signalLabel = SIGNAL_LABELS[event.signal_type] ?? event.signal_type
                    const Icon        = SIGNAL_ICON[event.signal_type] ?? Activity
                    const oldConf     = event.old_confidence ?? 0
                    const newConf     = event.new_confidence ?? 0
                    const confDelta   = newConf - oldConf
                    const deltaStr    = confDelta > 0
                      ? `+${(confDelta * 100).toFixed(0)}%`
                      : `${(confDelta * 100).toFixed(0)}%`
                    const deltaColor  = confDelta > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"

                    // Extract useful context from signal_detail
                    const detail = event.signal_detail as {
                      platform?: string
                      format?: string
                      metrics?: { engagement_rate?: number }
                    } | null
                    const platform = detail?.platform
                    const format   = detail?.format

                    return (
                      <div key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5",
                          "bg-zinc-100 dark:bg-zinc-800"
                        )}>
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm">
                              <span className="font-medium">{tokenLabel}</span>
                              {" "}
                              <span className="text-muted-foreground">
                                updated via {signalLabel.toLowerCase()}
                                {platform && ` · ${platform}`}
                                {format && format !== "unknown" && ` (${format})`}
                              </span>
                            </p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {timeAgo(event.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {event.old_value && event.new_value && event.old_value !== event.new_value && (
                              <span>
                                <span className="line-through opacity-50">{event.old_value.slice(0, 20)}</span>
                                {" → "}
                                <span className="text-foreground/80">{event.new_value.slice(0, 20)}</span>
                              </span>
                            )}
                            <span className={cn("font-mono font-semibold tabular-nums", deltaColor)}>
                              {deltaStr} confidence
                            </span>
                            <span className="font-mono tabular-nums opacity-60">
                              {(newConf * 100).toFixed(0)}% now
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({
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
