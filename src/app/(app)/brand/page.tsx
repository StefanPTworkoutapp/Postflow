/**
 * /brand — Brand settings + Intelligence tabs
 *
 * Tab navigation via URL param: ?tab=brand (default) | intelligence
 * Server component: auth guard + brand check.
 */

import type { Metadata }              from "next"
import { redirect }                   from "next/navigation"
import { createClient }               from "@/lib/supabase/server"
import { getActiveBrand }             from "@/lib/server/brand/getActiveBrand"
import { BrandEditor }                from "./BrandEditor"
import { BrandTabBar }                from "./BrandTabBar"
import { BrandIntelligenceContent }   from "../brand-intelligence/BrandIntelligenceContent"

export const metadata: Metadata = { title: "PostFlow · Brand" }

type Tab = "brand" | "intelligence"

export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params    = await searchParams
  const activeTab = (params.tab as Tab | undefined) ?? "brand"

  const brand = await getActiveBrand()
  if (!brand) redirect("/onboarding")

  // Fetch intelligence data here (in the page-level server component) rather
  // than inside BrandIntelligenceContent, to avoid the Next.js 16 streaming
  // deadlock caused by cookies() inside a Suspense-wrapped async server component.
  let intelligenceEvents:    import("../brand-intelligence/BrandIntelligenceContent").TokenEventRow[]    = []
  let intelligenceProcessed: import("../brand-intelligence/BrandIntelligenceContent").AnalyticsProcessedRow[] = []

  if (activeTab === "intelligence") {
    const supabase = await createClient()
    const [{ data: evts }, { data: proc }] = await Promise.all([
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
    intelligenceEvents    = (evts ?? []) as typeof intelligenceEvents
    intelligenceProcessed = (proc ?? []) as typeof intelligenceProcessed
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Manage your brand identity and view how PostFlow is learning your style.
        </p>
      </div>

      {/* Tab bar */}
      <BrandTabBar activeTab={activeTab} />

      {/* Tab content */}
      {activeTab === "brand" && <BrandEditor brand={brand} />}
      {activeTab === "intelligence" && (
        <BrandIntelligenceContent
          brandId={brand.id}
          brandIntelligenceTokens={brand.intelligence_tokens}
          events={intelligenceEvents}
          processed={intelligenceProcessed}
        />
      )}
    </div>
  )
}
