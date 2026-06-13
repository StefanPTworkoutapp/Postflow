/**
 * /brand — Brand settings + Intelligence tabs
 *
 * Tab navigation via URL param: ?tab=brand (default) | intelligence
 * Server component: auth guard + brand check.
 */

import type { Metadata }              from "next"
import { Suspense }                   from "react"
import { redirect }                   from "next/navigation"
import { getActiveBrand }             from "@/lib/server/brand/getActiveBrand"
import { BrandEditor }                from "./BrandEditor"
import { BrandTabBar }                from "./BrandTabBar"
import { BrandIntelligenceContent }   from "../brand-intelligence/BrandIntelligenceContent"
import { PageSkeleton }               from "@/components/ui/PageSkeleton"

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
        <Suspense fallback={<PageSkeleton rows={6} />}>
          <BrandIntelligenceContent
            brandId={brand.id}
            brandIntelligenceTokens={brand.intelligence_tokens}
          />
        </Suspense>
      )}
    </div>
  )
}
