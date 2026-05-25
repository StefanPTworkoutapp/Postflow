/**
 * GET /api/admin/diagnostics
 *
 * Returns a structured JSON health report for the entire PostFlow analytics
 * and brand intelligence pipeline. Admin-only (Stefan's email).
 *
 * Designed to be pasted into a Claude conversation for self-diagnosis.
 * The AdminDashboard "Copy for Claude" button calls this endpoint and
 * formats the result as a readable text block.
 *
 * Sections returned:
 *   - generated_at          ISO timestamp
 *   - brands                List with calibration state + token confidence stats
 *   - platform_connections  Active social accounts per brand/platform
 *   - analytics_sync        Latest sync run per platform (success/error counts)
 *   - analytics_processed   7-day pipeline stats (total, with signals, zero signals)
 *   - token_events_7d       Event counts by signal_type + top token keys
 *   - stuck_brands          Brands ≥14d old with no token events
 *   - recalibration_due     Brands with calibration_status = 'due'
 *   - posts_coverage        Total posts / with actual_performance / with approval status
 *   - portal_invites        Active invite count + recent approval activity
 *   - issues                Array of plain-English warnings surfaced by the report
 */

import { NextResponse }          from "next/server"
import { createClient }          from "@/lib/supabase/server"
import { createServiceClient }   from "@/lib/supabase/service"

/** Stefan's admin email — gate for this endpoint */
const ADMIN_EMAIL = "info@mindyourbodypt.nl"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (c: ReturnType<typeof createServiceClient>) => c as any

export async function GET() {
  // ── Auth gate ────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const service = createServiceClient()
  const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // ── Parallel data fetch ───────────────────────────────────────────────────────
  const [
    { data: brands },
    { data: socialAccounts },
    { data: syncRuns },
    { data: analyticsProcessed },
    { data: tokenEvents },
    { data: postsRaw },
    { data: portalInvites },
    { data: portalApprovals },
  ] = await Promise.all([
    service.from("brands").select(
      "id, name, niche, industry, calibration_status, calibration_done_at, created_at, intelligence_tokens"
    ),
    service.from("social_accounts").select(
      "brand_id, platform, account_handle, is_active, platform_access_token"
    ),
    nt(service)
      .from("sync_runs")
      .select("platform, started_at, ended_at, success_count, error_count, status")
      .order("started_at", { ascending: false })
      .limit(40),
    nt(service)
      .from("analytics_processed")
      .select("brand_id, post_id, platform, signals_applied, processed_at")
      .gte("processed_at", sevenDaysAgo)
      .order("processed_at", { ascending: false }),
    service
      .from("brand_token_events")
      .select("brand_id, token_key, signal_type, new_value, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
    service.from("posts")
      .select("id, brand_id, platform, status, actual_performance, predicted_performance")
      .order("created_at", { ascending: false })
      .limit(1000),
    nt(service)
      .from("portal_invites")
      .select("id, brand_id, email, created_at, last_viewed_at, expires_at")
      .order("created_at", { ascending: false })
      .limit(50),
    nt(service)
      .from("posts")
      .select("id, brand_id, client_approval_status, client_reviewed_at")
      .not("client_approval_status", "is", null)
      .order("client_reviewed_at", { ascending: false })
      .limit(50),
  ])

  const brandList   = brands   ?? []
  const accounts    = socialAccounts ?? []
  const runs        = syncRuns ?? []
  const processed   = analyticsProcessed ?? []
  const events      = tokenEvents ?? []
  const posts       = postsRaw ?? []
  const invites     = portalInvites ?? []
  const approvals   = portalApprovals ?? []

  // ── Section: brands ───────────────────────────────────────────────────────────
  const brandsSection = brandList.map(b => {
    const tokens = (b.intelligence_tokens ?? {}) as Record<string, { value: unknown; confidence: number }>
    const tokenEntries = Object.entries(tokens)
    const avgConfidence = tokenEntries.length
      ? tokenEntries.reduce((sum, [, v]) => sum + (v?.confidence ?? 0), 0) / tokenEntries.length
      : null
    const lowConfTokens = tokenEntries
      .filter(([, v]) => (v?.confidence ?? 1) < 0.3)
      .map(([k]) => k)
    const calibrationAge = b.calibration_done_at
      ? Math.floor((Date.now() - new Date(b.calibration_done_at).getTime()) / 86_400_000)
      : null

    return {
      id:                   b.id,
      name:                 b.name,
      niche:                b.niche ?? b.industry ?? null,
      calibration_status:   b.calibration_status,
      calibration_age_days: calibrationAge,
      token_count:          tokenEntries.length,
      avg_token_confidence: avgConfidence !== null ? +avgConfidence.toFixed(3) : null,
      low_confidence_tokens: lowConfTokens,
    }
  })

  // ── Section: platform_connections ─────────────────────────────────────────────
  const connectionsByBrand: Record<string, string[]> = {}
  for (const a of accounts) {
    if (!a.is_active) continue
    if (!connectionsByBrand[a.brand_id]) connectionsByBrand[a.brand_id] = []
    const label = a.platform_access_token
      ? `${a.platform}(direct)`
      : `${a.platform}(buffer)`
    connectionsByBrand[a.brand_id].push(label)
  }

  // ── Section: analytics_sync ───────────────────────────────────────────────────
  const latestSyncByPlatform: Record<string, {
    started_at: string; status: string; success_count: number; error_count: number
  }> = {}
  for (const r of runs) {
    if (!latestSyncByPlatform[r.platform]) {
      latestSyncByPlatform[r.platform] = {
        started_at:    r.started_at,
        status:        r.status,
        success_count: r.success_count ?? 0,
        error_count:   r.error_count   ?? 0,
      }
    }
  }

  // ── Section: analytics_processed ─────────────────────────────────────────────
  const processedTotal   = processed.length
  const processedNudged  = processed.filter((r: { signals_applied: number }) => r.signals_applied > 0).length
  const processedZero    = processedTotal - processedNudged
  const platformBreakdown: Record<string, number> = {}
  for (const r of processed) {
    platformBreakdown[r.platform] = (platformBreakdown[r.platform] ?? 0) + 1
  }

  // ── Section: token_events_7d ──────────────────────────────────────────────────
  const signalTypeCounts: Record<string, number> = {}
  const tokenKeyCounts:   Record<string, number> = {}
  const activeBrandIds = new Set<string>()
  for (const e of events) {
    signalTypeCounts[e.signal_type] = (signalTypeCounts[e.signal_type] ?? 0) + 1
    tokenKeyCounts[e.token_key]     = (tokenKeyCounts[e.token_key]     ?? 0) + 1
    activeBrandIds.add(e.brand_id)
  }
  const topTokenKeys = Object.entries(tokenKeyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }))

  // ── Section: stuck_brands ─────────────────────────────────────────────────────
  const stuckBrands = brandList
    .filter(b =>
      new Date(b.created_at).getTime() < new Date(fourteenDaysAgo).getTime() &&
      !activeBrandIds.has(b.id)
    )
    .map(b => b.name)

  // ── Section: recalibration_due ────────────────────────────────────────────────
  const recalibrationDue = brandList
    .filter(b => b.calibration_status === "due")
    .map(b => b.name)

  // ── Section: posts_coverage ───────────────────────────────────────────────────
  const totalPosts       = posts.length
  const withActual       = posts.filter((p: { actual_performance: unknown }) => p.actual_performance !== null).length
  const withPredicted    = posts.filter((p: { predicted_performance: unknown }) => p.predicted_performance !== null).length
  const approvedCount    = approvals.filter((p: { client_approval_status: string }) => p.client_approval_status === "approved").length
  const flaggedCount     = approvals.filter((p: { client_approval_status: string }) => p.client_approval_status === "flagged").length
  const pendingCount     = approvals.filter((p: { client_approval_status: string }) => p.client_approval_status === "pending").length

  // ── Section: portal_invites ───────────────────────────────────────────────────
  const activeInvites    = invites.filter((i: { expires_at: string | null }) =>
    !i.expires_at || new Date(i.expires_at) > new Date()
  ).length
  const viewedInvites    = invites.filter((i: { last_viewed_at: string | null }) => i.last_viewed_at !== null).length

  // ── Issues: surfaced warnings ─────────────────────────────────────────────────
  const issues: string[] = []

  if (processedZero > 0 && processedTotal > 0 && processedZero === processedTotal) {
    issues.push("🚨 ALL analytics_processed posts returned 0 signals — tokens are not learning from analytics")
  } else if (processedZero > processedNudged && processedTotal > 0) {
    issues.push(`⚠️ More zero-signal posts (${processedZero}) than signal-bearing posts (${processedNudged}) in 7d window`)
  }

  if (stuckBrands.length > 0) {
    issues.push(`⚠️ Stuck brands (no token events in 14d): ${stuckBrands.join(", ")}`)
  }

  if (recalibrationDue.length > 0) {
    issues.push(`⚠️ Recalibration due: ${recalibrationDue.join(", ")}`)
  }

  for (const [platform, info] of Object.entries(latestSyncByPlatform)) {
    if (info.status === "failed") {
      issues.push(`🚨 Analytics sync FAILED for ${platform} — last run ${info.started_at}`)
    }
    const staleHours = (Date.now() - new Date(info.started_at).getTime()) / 3_600_000
    if (staleHours > 30) {
      issues.push(`⚠️ ${platform} analytics sync is stale — last run ${Math.floor(staleHours)}h ago`)
    }
  }

  for (const b of brandsSection) {
    if (b.avg_token_confidence !== null && b.avg_token_confidence < 0.3) {
      issues.push(`⚠️ Brand "${b.name}" has very low avg token confidence (${b.avg_token_confidence}) — may need calibration`)
    }
    if (b.calibration_age_days !== null && b.calibration_age_days > 90) {
      issues.push(`⚠️ Brand "${b.name}" calibration is ${b.calibration_age_days}d old — should re-calibrate`)
    }
  }

  if (totalPosts > 20 && withActual === 0) {
    issues.push(`⚠️ ${totalPosts} posts exist but 0 have actual_performance — analytics fetch may not be running`)
  }

  if (issues.length === 0) {
    issues.push("✅ No issues detected — all pipelines appear healthy")
  }

  // ── Response ──────────────────────────────────────────────────────────────────
  return NextResponse.json({
    generated_at: new Date().toISOString(),
    brands: brandsSection,
    platform_connections: Object.entries(connectionsByBrand).map(([brandId, platforms]) => ({
      brand_id: brandId,
      brand_name: brandList.find(b => b.id === brandId)?.name ?? brandId.slice(0, 8),
      platforms,
    })),
    analytics_sync: latestSyncByPlatform,
    analytics_processed: {
      window: "7d",
      total:          processedTotal,
      with_signals:   processedNudged,
      zero_signals:   processedZero,
      by_platform:    platformBreakdown,
    },
    token_events_7d: {
      total:             events.length,
      active_brands:     activeBrandIds.size,
      by_signal_type:    signalTypeCounts,
      top_token_keys:    topTokenKeys,
    },
    stuck_brands:        stuckBrands,
    recalibration_due:   recalibrationDue,
    posts_coverage: {
      total:              totalPosts,
      with_actual_perf:   withActual,
      with_predicted_perf: withPredicted,
      client_approved:    approvedCount,
      client_flagged:     flaggedCount,
      client_pending:     pendingCount,
    },
    portal_invites: {
      total:    invites.length,
      active:   activeInvites,
      viewed:   viewedInvites,
    },
    issues,
  })
}
