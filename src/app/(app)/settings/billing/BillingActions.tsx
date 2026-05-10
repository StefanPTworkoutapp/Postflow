"use client"

/**
 * BillingActions — handles checkout redirect and Stripe portal.
 * Client component: makes fetch() calls and redirects.
 *
 * Two modes:
 *   variant="manage"  — "Manage subscription" button (opens Stripe portal)
 *   variant="card"    — Upgrade/downgrade button inside a plan card
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { PlanTier } from "@/lib/server/billing/plans"
import { Loader2 } from "lucide-react"

interface Props {
  hasMollie:    boolean
  targetTier?:  PlanTier
  currentTier?: PlanTier
  isCurrent?:   boolean
  variant?:     "manage" | "card"
}

export function BillingActions({
  hasMollie,
  targetTier,
  currentTier,
  isCurrent = false,
  variant = "manage",
}: Props) {
  const [loading, setLoading] = useState(false)

  // ── Manage subscription (portal) ──────────────────────────────────────────
  if (variant === "manage") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={async () => {
          setLoading(true)
          try {
            const res = await fetch("/api/billing/portal", { method: "POST" })
            const { url } = await res.json()
            if (url) window.location.href = url
          } finally {
            setLoading(false)
          }
        }}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Manage subscription"}
      </Button>
    )
  }

  // ── Upgrade / downgrade button (inside plan card) ─────────────────────────
  if (!targetTier) return null

  const tierOrder: PlanTier[] = ["free", "starter", "pro", "business"]
  const currentIdx = tierOrder.indexOf(currentTier ?? "free")
  const targetIdx  = tierOrder.indexOf(targetTier)
  const isUpgrade  = targetIdx > currentIdx
  const label      = isCurrent
    ? "Current plan"
    : isUpgrade ? "Upgrade" : "Downgrade"

  // Interval toggle state (monthly / annual)
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly")

  return (
    <div className="space-y-2">
      {/* Interval selector */}
      {!isCurrent && (
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setInterval("monthly")}
            className={interval === "monthly"
              ? "font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground"}
          >
            Monthly
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={() => setInterval("annual")}
            className={interval === "annual"
              ? "font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground"}
          >
            Annual
            <span className="ml-1 text-[10px] text-green-600 font-medium">–20%</span>
          </button>
        </div>
      )}

      <Button
        size="sm"
        variant={isCurrent ? "secondary" : isUpgrade ? "default" : "outline"}
        disabled={isCurrent || loading}
        className="w-full"
        onClick={async () => {
          if (isCurrent) return
          setLoading(true)
          try {
            const provider = hasMollie ? "mollie" : "stripe"
            const res = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tier: targetTier, interval, provider }),
            })
            const { url, error } = await res.json()
            if (error) { alert(error); return }
            if (url) window.location.href = url
          } finally {
            setLoading(false)
          }
        }}
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : label}
      </Button>
    </div>
  )
}
