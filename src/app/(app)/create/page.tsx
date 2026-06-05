/**
 * /create — Smart Video Builder, Stories & Reels, and Templates
 *
 * Tab navigation via URL param: ?tab=video (default) | stories | templates
 * Server component: auth guard + brand check.
 */

import type { Metadata }    from "next"
import { redirect }         from "next/navigation"
import { getBrand }         from "@/lib/server/brand/getBrand"
import { createClient }     from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { CreateClient }     from "./CreateClient"
import { CreateTabBar }     from "./CreateTabBar"
import { StoriesClient }    from "../stories/StoriesClient"
import { TemplatesClient }  from "../templates/TemplatesClient"

export const metadata: Metadata = { title: "PostFlow · Create" }

type Tab = "video" | "stories" | "templates"

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params    = await searchParams
  const activeTab = (params.tab as Tab | undefined) ?? "video"

  const brand = await getBrand()
  if (!brand) redirect("/onboarding")

  // Templates data (needed for templates tab)
  let templateHealth: unknown[] = []
  let suggestions:    unknown[] = []

  if (activeTab === "templates") {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createServiceClient() as any

      const [{ data: th }, { data: sg }] = await Promise.all([
        service
          .from("template_health")
          .select("id, platform, template_slug, health_score, posts_count, trend, last_checked_at, locked_by_user, mode")
          .eq("brand_id", brand.id)
          .order("health_score", { ascending: true }),

        service
          .from("template_suggestions")
          .select("id, brand_id, current_slug, suggested_slug, platform, reason, current_score, suggested_score, preview_render_url, status, created_at")
          .eq("brand_id", brand.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ])

      templateHealth = th ?? []
      suggestions    = sg ?? []
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Build videos, stories, reels, and manage your templates.
        </p>
      </div>

      {/* Tab bar */}
      <CreateTabBar activeTab={activeTab} />

      {/* Tab content */}
      {activeTab === "video"     && <CreateClient />}
      {activeTab === "stories"   && <StoriesClient />}
      {activeTab === "templates" && (
        <TemplatesClient
          brandId={brand.id}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          templateHealth={templateHealth as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          suggestions={suggestions as any}
        />
      )}
    </div>
  )
}
