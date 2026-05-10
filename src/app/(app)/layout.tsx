import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateAccount } from "@/lib/server/accounts/getOrCreateAccount"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OnboardingTour } from "@/components/onboarding/OnboardingTour"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Ensure account row exists (idempotent — safe for every request)
  await getOrCreateAccount()

  // Determine current path to avoid redirect loops on /onboarding itself
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") ?? ""
  const isOnboarding = pathname.startsWith("/onboarding")

  // New users have no brand yet → send them to the onboarding wizard
  if (!isOnboarding) {
    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .limit(1)
      .maybeSingle()

    if (!brand) redirect("/onboarding")
  }

  const userName = user.user_metadata?.full_name as string | undefined
  const userEmail = user.email

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar userEmail={userEmail} userName={userName} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      <OnboardingTour />
    </TooltipProvider>
  )
}
