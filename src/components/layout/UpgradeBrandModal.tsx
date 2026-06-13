"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { getPlan } from "@/lib/server/billing/plans"

interface Props {
  open:        boolean
  onClose:     () => void
  currentPlan: string
  /** -1 means unlimited (shouldn't be shown in that case, but we handle it). */
  limit:       number
  upgradeTo:   string | null
}

/**
 * Lightweight modal shown when a user hits their brand limit. Built as a
 * plain overlay because the project doesn't ship a shadcn Dialog primitive.
 */
export function UpgradeBrandModal({
  open,
  onClose,
  currentPlan,
  limit,
  upgradeTo,
}: Props) {
  const router = useRouter()

  // ESC closes
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const currentPlanName = getPlan(currentPlan).name
  const upgradePlan     = upgradeTo ? getPlan(upgradeTo) : null
  const upgradeLimit    = upgradePlan?.limits.brands ?? 0
  const upgradeLimitLabel = upgradeLimit === -1 ? "unlimited brands" : `${upgradeLimit} brands`

  function handleUpgrade() {
    router.push("/settings/billing")
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-brand-title"
      >
        <h2 id="upgrade-brand-title" className="text-lg font-semibold tracking-tight">
          You&apos;ve reached your brand limit
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Your <span className="font-medium text-[hsl(var(--foreground))]">{currentPlanName}</span> plan
          allows {limit} {limit === 1 ? "brand" : "brands"}.
          {upgradePlan && (
            <> Upgrade to <span className="font-medium text-[hsl(var(--foreground))]">{upgradePlan.name}</span> to get {upgradeLimitLabel}.</>
          )}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {upgradePlan && (
            <Button onClick={handleUpgrade}>
              Upgrade to {upgradePlan.name} →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
