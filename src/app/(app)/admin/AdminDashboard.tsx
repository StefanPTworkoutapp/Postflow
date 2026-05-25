"use client"

import { useMemo, useState, useCallback } from "react"
import { CheckCircle2, AlertTriangle, XCircle, Clock, Activity, Database, Zap, TrendingUp, ClipboardCopy, Loader2, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncRun {
  platform:      string
  started_at:    string
  ended_at:      string | null
  success_count: number
  error_count:   number
  status:        string
}

interface ResearchRun {
  niche:         string
  platform:      string
  signals_found: number
  ran_at:        string
}

interface TokenEvent {
  brand_id:    string
  token_key:   string
  signal_type: string
  created_at:  string
}

interface NicheTrend {
  brand_id:        string
  source:          string
  topic:           string
  relevance_score: number
  week_of:         string
}

interface AnalyticsProcessed {
  brand_id:        string
  post_id:         string
  platform:        string
  signals_applied: number
  processed_at:    string
}

interface Brand {
  id:         string
  name:       string
  niche:      string | null
  industry:   string | null
  created_at: string
}

interface AiUsageRow {
  key:       string
  calls:     number
  tokens:    number
  cost:      number
  brandName?: string
}

interface AiTotals {
  calls:    number
  tokens:   number
  cost:     number
  prevCost: number
  month:    string
}

interface Props {
  syncRuns:           SyncRun[]
  researchRuns:       ResearchRun[]
  tokenEvents:        TokenEvent[]
  nicheTrends:        NicheTrend[]
  analyticsProcessed: AnalyticsProcessed[]
  brands:             Brand[]
  aiTotals:           AiTotals
  aiUsageBrands:      AiUsageRow[]
  aiUsageModels:      AiUsageRow[]
  aiUsageFeatures:    AiUsageRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <   1) return "just now"
  if (mins  <  60) return `${mins}m ago`
  if (hours <  24) return `${hours}h ago`
  return `${days}d ago`
}

function StatusChip({ status }: { status: string }) {
  const config = {
    clean:   { icon: CheckCircle2, color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30"  },
    partial: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30"  },
    failed:  { icon: XCircle,      color: "text-red-600 dark:text-red-400",     bg: "bg-red-50   dark:bg-red-950/30"    },
    running: { icon: Clock,        color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50  dark:bg-blue-950/30"   },
  }[status] ?? { icon: Clock, color: "text-gray-500", bg: "bg-gray-50" }
  const Icon = config.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", config.color, config.bg)}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}

// ── Diagnostics formatter ─────────────────────────────────────────────────────

/**
 * Formats the /api/admin/diagnostics JSON into a concise text block
 * suitable for pasting into a Claude conversation for analysis.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDiagnosticsForClaude(data: Record<string, any>): string {
  const lines: string[] = [
    `## PostFlow Diagnostics Report`,
    `Generated: ${data.generated_at ?? new Date().toISOString()}`,
    ``,
    `### Issues`,
    ...(data.issues as string[] ?? ["(none)"]),
    ``,
    `### Brands (${(data.brands as unknown[])?.length ?? 0})`,
  ]

  for (const b of (data.brands as Array<Record<string, unknown>>) ?? []) {
    const lowConf = (b.low_confidence_tokens as string[])?.length
      ? ` | low-conf tokens: ${(b.low_confidence_tokens as string[]).join(", ")}`
      : ""
    lines.push(
      `  - ${b.name} | niche: ${b.niche ?? "—"} | calibration: ${b.calibration_status} (${b.calibration_age_days ?? "—"}d ago)` +
      ` | tokens: ${b.token_count} (avg conf: ${b.avg_token_confidence ?? "—"})${lowConf}`
    )
  }

  lines.push(``, `### Platform Connections`)
  for (const pc of (data.platform_connections as Array<Record<string, unknown>>) ?? []) {
    lines.push(`  - ${pc.brand_name}: ${(pc.platforms as string[])?.join(", ") || "none"}`)
  }

  const sync = data.analytics_sync as Record<string, Record<string, unknown>> ?? {}
  lines.push(``, `### Analytics Sync (latest per platform)`)
  if (Object.keys(sync).length === 0) {
    lines.push("  (no sync runs yet)")
  } else {
    for (const [platform, info] of Object.entries(sync)) {
      lines.push(
        `  - ${platform}: ${info.status} | ✓${info.success_count} ✗${info.error_count} | last: ${info.started_at}`
      )
    }
  }

  const ap = data.analytics_processed as Record<string, unknown> ?? {}
  lines.push(``, `### Analytics → Token Pipeline (7d)`)
  lines.push(`  Total processed: ${ap.total ?? 0}`)
  lines.push(`  With signals: ${ap.with_signals ?? 0}`)
  lines.push(`  Zero signals: ${ap.zero_signals ?? 0}`)
  const bp = ap.by_platform as Record<string, number> ?? {}
  if (Object.keys(bp).length > 0) {
    lines.push(`  By platform: ${Object.entries(bp).map(([k, v]) => `${k}:${v}`).join(", ")}`)
  }

  const te = data.token_events_7d as Record<string, unknown> ?? {}
  lines.push(``, `### Token Events (7d)`)
  lines.push(`  Total events: ${te.total ?? 0} | Active brands: ${te.active_brands ?? 0}`)
  const bst = te.by_signal_type as Record<string, number> ?? {}
  if (Object.keys(bst).length > 0) {
    lines.push(`  By signal type: ${Object.entries(bst).map(([k, v]) => `${k}:${v}`).join(", ")}`)
  }
  const topKeys = te.top_token_keys as Array<{ key: string; count: number }> ?? []
  if (topKeys.length > 0) {
    lines.push(`  Top token keys: ${topKeys.map(t => `${t.key}(${t.count})`).join(", ")}`)
  }

  const pc2 = data.posts_coverage as Record<string, number> ?? {}
  lines.push(``, `### Posts Coverage`)
  lines.push(`  Total: ${pc2.total ?? 0} | With actual perf: ${pc2.with_actual_perf ?? 0} | With predicted: ${pc2.with_predicted_perf ?? 0}`)
  lines.push(`  Client approvals — approved: ${pc2.client_approved ?? 0}, flagged: ${pc2.client_flagged ?? 0}, pending: ${pc2.client_pending ?? 0}`)

  const pi = data.portal_invites as Record<string, number> ?? {}
  lines.push(``, `### Portal Invites`)
  lines.push(`  Total: ${pi.total ?? 0} | Active: ${pi.active ?? 0} | Viewed: ${pi.viewed ?? 0}`)

  const stuck = data.stuck_brands as string[] ?? []
  if (stuck.length > 0) {
    lines.push(``, `### Stuck Brands (no token events in 14d)`)
    lines.push(`  ${stuck.join(", ")}`)
  }

  const recalib = data.recalibration_due as string[] ?? []
  if (recalib.length > 0) {
    lines.push(``, `### Recalibration Due`)
    lines.push(`  ${recalib.join(", ")}`)
  }

  return lines.join("\n")
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminDashboard({
  syncRuns,
  researchRuns,
  tokenEvents,
  nicheTrends,
  analyticsProcessed,
  brands,
  aiTotals,
  aiUsageBrands,
  aiUsageModels,
  aiUsageFeatures,
}: Props) {
  const brandMap = useMemo(
    () => new Map(brands.map(b => [b.id, b])),
    [brands]
  )

  // ── Copy for Claude ───────────────────────────────────────────────────────────
  const [copyState, setCopyState] = useState<"idle" | "loading" | "copied" | "error">("idle")

  const copyForClaude = useCallback(async () => {
    setCopyState("loading")
    try {
      const res  = await fetch("/api/admin/diagnostics")
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed")

      const text = formatDiagnosticsForClaude(data)
      await navigator.clipboard.writeText(text)
      setCopyState("copied")
      setTimeout(() => setCopyState("idle"), 3000)
    } catch (e) {
      console.error("[AdminDashboard] diagnostics copy error:", e)
      setCopyState("error")
      setTimeout(() => setCopyState("idle"), 3000)
    }
  }, [])

  // Analytics sync stats: latest run per platform
  const latestSync = useMemo(() => {
    const map = new Map<string, SyncRun>()
    for (const r of syncRuns) {
      if (!map.has(r.platform)) map.set(r.platform, r)
    }
    return map
  }, [syncRuns])

  // Token activity: count by brand, by token, by signal type
  const tokenStats = useMemo(() => {
    const brandCounts = new Map<string, number>()
    const tokenCounts = new Map<string, number>()
    const signalCounts = new Map<string, number>()
    for (const e of tokenEvents) {
      brandCounts.set(e.brand_id,   (brandCounts.get(e.brand_id)   ?? 0) + 1)
      tokenCounts.set(e.token_key,  (tokenCounts.get(e.token_key)  ?? 0) + 1)
      signalCounts.set(e.signal_type, (signalCounts.get(e.signal_type) ?? 0) + 1)
    }

    // Brands with NO activity (that are ≥14 days old)
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    const stuckBrands = brands.filter(b =>
      new Date(b.created_at).getTime() < fourteenDaysAgo &&
      !brandCounts.has(b.id)
    )

    const topToken = [...tokenCounts.entries()].sort((a, b) => b[1] - a[1])[0]

    return { brandCounts, tokenCounts, signalCounts, stuckBrands, topToken }
  }, [tokenEvents, brands])

  // Niche trend freshness: latest week_of per niche+platform
  const trendFreshness = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of nicheTrends) {
      const key = `${t.brand_id}::${t.source}`
      if (!map.has(key) || t.week_of > map.get(key)!) map.set(key, t.week_of)
    }
    return map
  }, [nicheTrends])

  // analytics_processed stats
  const processedStats = useMemo(() => {
    const total    = analyticsProcessed.length
    const withNudge = analyticsProcessed.filter(r => r.signals_applied > 0).length
    const zero     = total - withNudge
    return { total, withNudge, zero }
  }, [analyticsProcessed])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-500" />
            PostFlow System Health
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Internal dashboard — Stefan only.
          </p>
        </div>

        {/* Copy for Claude */}
        <button
          onClick={copyForClaude}
          disabled={copyState === "loading"}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
            copyState === "copied"
              ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400"
              : copyState === "error"
              ? "border-red-400 text-red-600 bg-red-50 dark:bg-red-950/20"
              : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
          )}
        >
          {copyState === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : copyState === "copied" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ClipboardCopy className="h-4 w-4" />
          )}
          {copyState === "loading" ? "Fetching…" : copyState === "copied" ? "Copied!" : copyState === "error" ? "Failed" : "Copy diagnostic report for Claude"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Analytics Sync */}
        <section className="rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold text-sm">Analytics Sync</h2>
          </div>
          {["instagram", "linkedin"].map(platform => {
            const run = latestSync.get(platform)
            return (
              <div key={platform} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{platform}</span>
                  {run ? <StatusChip status={run.status} /> : <span className="text-xs text-[hsl(var(--muted-foreground))]">No runs yet</span>}
                </div>
                {run && (
                  <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                    <span>Last run: {relativeTime(run.started_at)}</span>
                    <span className="text-green-600 dark:text-green-400">✓ {run.success_count}</span>
                    {run.error_count > 0 && <span className="text-red-500">✗ {run.error_count}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {/* Niche Research */}
        <section className="rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h2 className="font-semibold text-sm">Niche Research</h2>
          </div>
          {researchRuns.slice(0, 6).length ? (
            researchRuns.slice(0, 6).map((r, i) => {
              const isStale = Date.now() - new Date(r.ran_at).getTime() > 14 * 24 * 60 * 60 * 1000
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-48 font-medium">{r.niche} / {r.platform}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(isStale ? "text-amber-500" : "text-[hsl(var(--muted-foreground))]")}>
                      {relativeTime(r.ran_at)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">{r.signals_found} signals</span>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No research runs yet — first run Monday 06:00 UTC</p>
          )}
        </section>

        {/* Brand Token Activity */}
        <section className="rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-sm">Brand Token Activity (7d)</h2>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className="text-lg font-semibold">{tokenStats.brandCounts.size}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Brands active</p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className="text-lg font-semibold">{tokenEvents.length}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Token nudges</p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className={cn("text-lg font-semibold", tokenStats.stuckBrands.length > 0 ? "text-amber-500" : "")}>
                {tokenStats.stuckBrands.length}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Stuck brands</p>
            </div>
          </div>

          {tokenStats.topToken && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Most updated token: <strong className="text-foreground">{tokenStats.topToken[0]}</strong> ({tokenStats.topToken[1]} events)
            </p>
          )}

          {/* Signal source breakdown */}
          <div className="space-y-1">
            {[...tokenStats.signalCounts.entries()].map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="capitalize text-[hsl(var(--muted-foreground))]">{type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${Math.min(100, (count / tokenEvents.length) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>

          {tokenStats.stuckBrands.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              ⚠ Stuck brands (no token events in 14d): {tokenStats.stuckBrands.map(b => b.name).join(", ")}
            </div>
          )}
        </section>

        {/* Analytics → Token Pipeline */}
        <section className="rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <h2 className="font-semibold text-sm">Analytics → Tokens (7d)</h2>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className="text-lg font-semibold">{processedStats.total}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Posts processed</p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">{processedStats.withNudge}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Got signals</p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
              <p className={cn("text-lg font-semibold", processedStats.zero > 0 ? "text-amber-500" : "text-[hsl(var(--muted-foreground))]")}>
                {processedStats.zero}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Zero signals</p>
            </div>
          </div>

          {processedStats.zero > 0 && processedStats.zero === processedStats.total && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              🚨 All processed posts returned 0 signals — tokens may not be learning. Check processPostAnalytics logs.
            </div>
          )}

          <div className="space-y-1 text-xs">
            {analyticsProcessed.slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">
                <span className="truncate max-w-36">{brandMap.get(r.brand_id)?.name ?? r.brand_id.slice(0, 8)} / {r.platform}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span>{relativeTime(r.processed_at)}</span>
                  <span className={cn("font-medium", r.signals_applied > 0 ? "text-green-600 dark:text-green-400" : "text-amber-500")}>
                    {r.signals_applied} signals
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Trend Signal Freshness table */}
      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Trend Signal Freshness
        </h2>
        {nicheTrends.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No trend signals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[hsl(var(--muted-foreground))] border-b">
                  <th className="text-left py-2 pr-4 font-medium">Brand</th>
                  <th className="text-left py-2 pr-4 font-medium">Source</th>
                  <th className="text-left py-2 pr-4 font-medium">Topic</th>
                  <th className="text-right py-2 pr-4 font-medium">Score</th>
                  <th className="text-right py-2 font-medium">Week of</th>
                </tr>
              </thead>
              <tbody>
                {nicheTrends.slice(0, 20).map((t, i) => {
                  const brand  = brandMap.get(t.brand_id)
                  const isStale = (() => {
                    const d = new Date(t.week_of)
                    d.setDate(d.getDate() + 14)
                    return d < new Date()
                  })()
                  return (
                    <tr key={i} className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/30">
                      <td className="py-2 pr-4 truncate max-w-28">{brand?.name ?? t.brand_id.slice(0, 8)}</td>
                      <td className="py-2 pr-4 text-[hsl(var(--muted-foreground))]">{t.source}</td>
                      <td className="py-2 pr-4 truncate max-w-64">{t.topic}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{t.relevance_score}</td>
                      <td className={cn("py-2 text-right tabular-nums", isStale ? "text-amber-500" : "")}>
                        {t.week_of}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Brands */}
      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm">All Brands ({brands.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {brands.map(b => (
            <div key={b.id} className="rounded-lg bg-[hsl(var(--muted))]/40 px-3 py-2 text-xs">
              <p className="font-medium">{b.name}</p>
              <p className="text-[hsl(var(--muted-foreground))] truncate">{b.niche ?? b.industry ?? "—"}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Usage & Cost ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border p-5 space-y-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-violet-500" />
          <h2 className="font-semibold text-sm">AI Usage — {aiTotals.month}</h2>
        </div>

        {/* Month totals */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
            <p className="text-lg font-semibold">{aiTotals.calls.toLocaleString()}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">AI calls</p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
            <p className="text-lg font-semibold">{(aiTotals.tokens / 1000).toFixed(1)}k</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Tokens</p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2">
            <p className="text-lg font-semibold">${aiTotals.cost.toFixed(4)}</p>
            <p className={cn(
              "text-xs",
              aiTotals.prevCost > 0 && aiTotals.cost > aiTotals.prevCost * 1.2
                ? "text-amber-500"
                : "text-[hsl(var(--muted-foreground))]"
            )}>
              {aiTotals.prevCost > 0
                ? `prev month $${aiTotals.prevCost.toFixed(4)}`
                : "Cost (USD)"}
            </p>
          </div>
        </div>

        {aiTotals.calls === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">
            No AI calls logged yet this month — logs will appear once the migration runs.
          </p>
        )}

        {aiTotals.calls > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Per-brand */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">By Brand</h3>
              {aiUsageBrands.length === 0
                ? <p className="text-xs text-[hsl(var(--muted-foreground))]">—</p>
                : aiUsageBrands.slice(0, 10).map(r => (
                  <div key={r.key} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate font-medium max-w-36">
                      {r.brandName ?? r.key.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 text-[hsl(var(--muted-foreground))]">
                      <span>{r.calls} calls</span>
                      <span className="text-violet-600 dark:text-violet-400 font-medium tabular-nums">
                        ${r.cost.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Per-model */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">By Model</h3>
              {aiUsageModels.length === 0
                ? <p className="text-xs text-[hsl(var(--muted-foreground))]">—</p>
                : aiUsageModels.map(r => (
                  <div key={r.key} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate font-mono text-[hsl(var(--muted-foreground))] max-w-40">{r.key.replace("claude-", "")}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[hsl(var(--muted-foreground))]">{r.calls}×</span>
                      <span className="text-violet-600 dark:text-violet-400 font-medium tabular-nums">
                        ${r.cost.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Per-feature */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">By Feature</h3>
              {aiUsageFeatures.length === 0
                ? <p className="text-xs text-[hsl(var(--muted-foreground))]">—</p>
                : aiUsageFeatures.map(r => (
                  <div key={r.key} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate text-[hsl(var(--muted-foreground))] max-w-36">{r.key}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[hsl(var(--muted-foreground))]">{r.calls}×</span>
                      <span className="text-violet-600 dark:text-violet-400 font-medium tabular-nums">
                        ${r.cost.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
