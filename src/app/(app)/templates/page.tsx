import { createClient }        from "@/lib/supabase/server"
import { getBrand }             from "@/lib/server/brand/getBrand"
import { createServiceClient }  from "@/lib/supabase/service"
import { TemplatesClient }      from "./TemplatesClient"

/**
 * /templates
 *
 * Shows template health scores and pending improvement suggestions for
 * the current brand. Server-renders the health data; client handles
 * approve/dismiss interactions on suggestions.
 */
export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const brand = await getBrand()

  if (!brand) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Complete onboarding to see template health.
          </p>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any

  // Template health data
  const { data: templateHealth } = await service
    .from("template_health")
    .select("id, platform, template_slug, health_score, posts_count, trend, last_checked_at, locked_by_user, mode")
    .eq("brand_id", brand.id)
    .order("health_score", { ascending: true })

  // Pending suggestions
  const { data: suggestions } = await service
    .from("template_suggestions")
    .select("id, brand_id, current_slug, suggested_slug, platform, reason, current_score, suggested_score, preview_render_url, status, created_at")
    .eq("brand_id", brand.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  return (
    <TemplatesClient
      brandId={brand.id}
      templateHealth={templateHealth ?? []}
      suggestions={suggestions ?? []}
    />
  )
}
