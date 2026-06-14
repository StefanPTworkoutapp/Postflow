import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateAccount } from "@/lib/server/accounts/getOrCreateAccount"
import { getBrands } from "@/lib/server/brand/getBrands"
import { getActiveBrand } from "@/lib/server/brand/getActiveBrand"
import { getLimits } from "@/lib/server/billing/plans"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OnboardingTour } from "@/components/onboarding/OnboardingTour"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Ensure account row exists; capture tier for storage check
  const account = await getOrCreateAccount()
  const tier     = (account as { subscription_tier?: string })?.subscription_tier ?? "free"

  // Determine current path to avoid redirect loops on /onboarding itself
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") ?? ""
  const isOnboarding = pathname.startsWith("/onboarding")

  // Resolve brands + active brand. Onboarding has no brands yet — skip the
  // redirect there and skip the brand sidebar UI.
  let sidebarBrands: { id: string; name: string; logo_url: string | null }[] = []
  let activeBrandId: string | undefined
  let storagePercent = 0
  let storageLimitGb = getLimits(tier).storageGb

  if (!isOnboarding) {
    const [brands, activeBrand] = await Promise.all([
      getBrands(),
      getActiveBrand(),
    ])

    if (brands.length === 0 || !activeBrand) redirect("/onboarding")

    sidebarBrands = brands.map((b) => ({ id: b.id, name: b.name, logo_url: b.logo_url }))
    activeBrandId = activeBrand.id

    // Storage usage for bell notification — lightweight aggregate
    const brandIds = brands.map(b => b.id)
    if (brandIds.length > 0) {
      const { data: uploads } = await supabase
        .from("media_uploads")
        .select("file_size_mb")
        .in("brand_id", brandIds)
      const usedMb      = (uploads ?? []).reduce((s, r) => s + (typeof r.file_size_mb === "number" ? r.file_size_mb : 0), 0)
      const limitMb     = storageLimitGb * 1024
      storagePercent    = limitMb > 0 ? Math.min(100, Math.round((usedMb / limitMb) * 100)) : 0
    }
  }

  const userName = user.user_metadata?.full_name as string | undefined
  const userEmail = user.email

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
        <Sidebar
          userEmail={userEmail}
          brands={sidebarBrands}
          activeBrandId={activeBrandId}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            userEmail={userEmail}
            userName={userName}
            storagePercent={storagePercent}
            storageLimitGb={storageLimitGb}
            tier={tier}
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      <OnboardingTour />
    </TooltipProvider>
  )
}
