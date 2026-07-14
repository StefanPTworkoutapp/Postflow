import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { AdminDashboard } from "./AdminDashboard"

/**
 * Type-bypass helper for tables not yet in the generated database.types.ts.
 * Remove once migration 20260511000001 runs and types are regenerated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createServiceClient>) => client as any

/** Stefan's account only. Any other user is redirected. */
const ADMIN_EMAIL = "info@mindyourbodypt.nl"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard")

  const service = createServiceClient()

  // ── Analytics sync health ─────────────────────────────────────────────────
  const { data: syncRuns } = await nt(service)
    .from("sync_runs")
    .select("platform, started_at, ended_at, success_count, error_count, status")
    .order("started_at", { ascending: false })
    .limit(20)

  // ── Niche research health ─────────────────────────────────────────────────
  const { data: researchRuns } = await nt(service)
    .from("research_runs")
    .select("niche, platform, signals_found, ran_at")
    .order("ran_at", { ascending: false })
    .limit(30)

  // ── Brand token activity (last 7 days) ────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: tokenEvents } = await service
    .from("brand_token_events")
    .select("brand_id, token_key, signal_type, created_at")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(200)

  // ── Trend signal freshness ────────────────────────────────────────────────
  const { data: nicheTrends } = await service
    .from("niche_trends")
    .select("brand_id, source, topic, relevance_score, week_of")
    .order("week_of", { ascending: false })
    .limit(50)

  // ── Analytics processed (last 7 days) ────────────────────────────────────
  const { data: analyticsProcessed } = await nt(service)
    .from("analytics_processed")
    .select("brand_id, post_id, platform, signals_applied, processed_at")
    .gte("processed_at", sevenDaysAgo)
    .order("processed_at", { ascending: false })
    .limit(50)

  // ── Imported feed health (P3, 2026-07-14) ───────────────────────────────────
  // Invisible-code guard for feedImportOnConnect/feedImportNightly: accounts
  // connected on a supported platform vs accounts that actually have imported
  // rows, plus last-import age — same "expected to run but didn't" shape as
  // the Analytics Sync section above.
  const IMPORT_PLATFORMS = ["instagram", "facebook", "linkedin"] as const
  const { data: importAccounts } = await service
    .from("social_accounts")
    .select("brand_id, platform")
    .in("platform", IMPORT_PLATFORMS as unknown as string[])
    .eq("is_active", true)

  const { data: importedPosts } = await nt(service)
    .from("imported_posts")
    .select("brand_id, platform, imported_at")
    .order("imported_at", { ascending: false })
    .limit(1000)

  const importedFeedHealth = IMPORT_PLATFORMS.map(platform => {
    const connected = (importAccounts ?? []).filter(a => a.platform === platform)
    const platformImports = (importedPosts ?? []).filter((p: { platform: string }) => p.platform === platform)
    const accountsWithImports = new Set(platformImports.map((p: { brand_id: string }) => p.brand_id)).size
    const lastImportAt = platformImports[0]?.imported_at ?? null   // list is ordered desc overall, so first match per platform is the latest
    return {
      platform,
      accountsConnected:   connected.length,
      accountsWithImports,
      lastImportAt,
    }
  })

  // ── Brand list (for name lookups) ─────────────────────────────────────────
  const { data: brands } = await service
    .from("brands")
    .select("id, name, niche, industry, created_at")

  // ── AI usage logs (current + previous month) ──────────────────────────────
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevMonthStart    = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const { data: aiLogs } = await service
    .from("ai_usage_logs")
    .select("brand_id, model, feature, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, created_at")
    .gte("created_at", prevMonthStart)
    .order("created_at", { ascending: false })
    .limit(5000)

  // Aggregate AI usage into per-brand, per-model, and per-feature summaries
  interface RawLog {
    brand_id:           string | null
    model:              string
    feature:            string
    input_tokens:       number
    output_tokens:      number
    cache_read_tokens:  number
    cache_write_tokens: number
    cost_usd:           number
    created_at:         string
  }

  const logs = (aiLogs ?? []) as RawLog[]
  const currentLogs = logs.filter(l => l.created_at >= currentMonthStart)
  const prevLogs    = logs.filter(l => l.created_at >= prevMonthStart && l.created_at < currentMonthStart)

  function aggregateByField<T extends string>(
    rows: RawLog[],
    keyFn: (r: RawLog) => T,
  ): Array<{ key: T; calls: number; tokens: number; cost: number }> {
    const map = new Map<T, { calls: number; tokens: number; cost: number }>()
    for (const r of rows) {
      const k = keyFn(r)
      const prev = map.get(k) ?? { calls: 0, tokens: 0, cost: 0 }
      map.set(k, {
        calls:  prev.calls + 1,
        tokens: prev.tokens + r.input_tokens + r.output_tokens,
        cost:   prev.cost + Number(r.cost_usd),
      })
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.cost - a.cost)
  }

  const aiUsageBrands  = aggregateByField(currentLogs, r => r.brand_id ?? "(unattributed)")
  const aiUsageModels  = aggregateByField(currentLogs, r => r.model)
  const aiUsageFeatures = aggregateByField(currentLogs, r => r.feature)

  const aiTotals = {
    calls:    currentLogs.length,
    tokens:   currentLogs.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0),
    cost:     currentLogs.reduce((s, r) => s + Number(r.cost_usd), 0),
    prevCost: prevLogs.reduce((s, r) => s + Number(r.cost_usd), 0),
    month:    now.toLocaleString("en-GB", { month: "long", year: "numeric" }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cast = <T,>(v: any): T[] => (v as T[] | null) ?? []

  const brandNameMap = new Map((brands ?? []).map(b => [b.id, b.name as string]))

  // ── Feedback learning loop health (P1, 2026-07-14) — Invisible Code Guard ──
  // Orphan detection: these loops are expected to clear their unprocessed
  // queues on a weekly (clip-forge) or immediate (tone/trend) cadence. Rows
  // still sitting unprocessed well past that cadence mean the job silently
  // stopped running (or, for tone/trend, the fire-and-forget nudge failed).
  // Wrapped defensively — the columns these rely on ship in a migration that
  // needs Stefan's approval; until applied, these queries degrade to 0/0
  // rather than breaking the page.
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo   = new Date(Date.now() - 1  * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: clipForgeUnprocessed },
    { count: clipForgeStale },
    { count: toneImmediateFailures },
    { count: trendUnprocessed },
  ] = await Promise.all([
    nt(service).from("clip_forge_feedback").select("id", { count: "exact", head: true }).eq("processed", false),
    nt(service).from("clip_forge_feedback").select("id", { count: "exact", head: true }).eq("processed", false).lt("created_at", tenDaysAgo),
    nt(service).from("tone_feedback").select("id", { count: "exact", head: true }).eq("immediate_nudge_applied", false).lt("created_at", oneDayAgo).not("feedback_type", "is", null),
    nt(service).from("trend_feedback").select("id", { count: "exact", head: true }).eq("processed", false).lt("created_at", oneDayAgo),
  ]).catch(() => [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }])

  const feedbackLoopHealth = {
    clipForgeUnprocessed:   clipForgeUnprocessed ?? 0,
    clipForgeStale:         clipForgeStale ?? 0,
    toneImmediateFailures:  toneImmediateFailures ?? 0,
    trendUnprocessed:       trendUnprocessed ?? 0,
  }

  return (
    <AdminDashboard
      syncRuns={cast(syncRuns)}
      researchRuns={cast(researchRuns)}
      tokenEvents={cast(tokenEvents)}
      nicheTrends={(nicheTrends ?? []).map(t => ({
        ...t,
        relevance_score: t.relevance_score ?? 0,
      }))}
      analyticsProcessed={cast(analyticsProcessed)}
      brands={brands ?? []}
      aiTotals={aiTotals}
      aiUsageBrands={aiUsageBrands.map(r => ({ ...r, brandName: brandNameMap.get(r.key) ?? r.key }))}
      aiUsageModels={aiUsageModels}
      aiUsageFeatures={aiUsageFeatures}
      feedbackLoopHealth={feedbackLoopHealth}
      importedFeedHealth={importedFeedHealth}
    />
  )
}
