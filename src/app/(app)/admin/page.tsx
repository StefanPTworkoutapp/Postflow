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

  // ── Brand list (for name lookups) ─────────────────────────────────────────
  const { data: brands } = await service
    .from("brands")
    .select("id, name, niche, industry, created_at")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cast = <T,>(v: any): T[] => (v as T[] | null) ?? []

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
    />
  )
}
