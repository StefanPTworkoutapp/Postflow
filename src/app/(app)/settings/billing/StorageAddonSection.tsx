"use client"

/**
 * StorageAddonSection — shown on the billing page for Starter+ users.
 *
 * Allows purchasing extra storage add-ons (€5/15/30 per month) without
 * requiring a full plan upgrade. Add-ons are Stripe subscription items
 * added via POST /api/billing/addon/storage.
 *
 * After purchase, the customer.subscription.updated webhook fires and updates
 * subscriptions.storage_addon_gb automatically.
 */

import { useState } from "react"
import { HardDrive, Plus, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AddonOption {
  label:          string
  priceMonthly:   string   // display
  priceAnnual:    string   // display
  gb:             number
  envMonthly:     string   // env var name for monthly price ID
  envAnnual:      string   // env var name for annual price ID
}

const ADDON_OPTIONS: AddonOption[] = [
  {
    label:        "+50 GB",
    priceMonthly: "€5",
    priceAnnual:  "€48/yr",
    gb:           50,
    envMonthly:   "STRIPE_ADDON_STORAGE_50_MONTHLY",
    envAnnual:    "STRIPE_ADDON_STORAGE_50_ANNUAL",
  },
  {
    label:        "+200 GB",
    priceMonthly: "€15",
    priceAnnual:  "€144/yr",
    gb:           200,
    envMonthly:   "STRIPE_ADDON_STORAGE_200_MONTHLY",
    envAnnual:    "STRIPE_ADDON_STORAGE_200_ANNUAL",
  },
  {
    label:        "+500 GB",
    priceMonthly: "€30",
    priceAnnual:  "€288/yr",
    gb:           500,
    envMonthly:   "STRIPE_ADDON_STORAGE_500_MONTHLY",
    envAnnual:    "STRIPE_ADDON_STORAGE_500_ANNUAL",
  },
]

interface Props {
  tier:           string
  hasStripe:      boolean
  currentAddonGb: number
}

export function StorageAddonSection({ tier, hasStripe, currentAddonGb }: Props) {
  const [selected, setSelected]   = useState<number | null>(null)
  const [interval, setInterval]   = useState<"monthly" | "annual">("monthly")
  const [buying, setBuying]       = useState(false)
  const [success, setSuccess]     = useState(false)
  const [buyError, setBuyError]   = useState<string | null>(null)

  if (!hasStripe) {
    // No Stripe subscription — add-on requires an active Stripe subscription
    return null
  }

  async function handleBuy() {
    if (selected === null) return
    const option = ADDON_OPTIONS[selected]
    const envKey = interval === "annual" ? option.envAnnual : option.envMonthly

    // Price IDs are resolved server-side; we pass the env key name and let the
    // server look it up. This avoids leaking price IDs to the client.
    // Actually, we need the actual price ID. Use a server action or pass IDs from props.
    // Since this is a client component, we fetch from a dedicated endpoint that
    // accepts the addon size + interval and returns the price ID, OR we use the
    // /api/billing/addon/storage route that maps addon → priceId server-side.

    setBuying(true)
    setBuyError(null)
    try {
      const res = await fetch("/api/billing/addon/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addonGb:  option.gb,
          interval: interval,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBuyError(json.error ?? "Purchase failed. Please try again.")
      } else {
        setSuccess(true)
        // Page will update on next load when webhook fires
      }
    } catch {
      setBuyError("Network error. Please try again.")
    } finally {
      setBuying(false)
    }
  }

  return (
    <Card id="storage-addon">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          Storage Add-on
          {currentAddonGb > 0 && (
            <span className="ml-auto text-xs font-normal text-indigo-500">
              +{currentAddonGb} GB active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add extra storage without changing your plan. Billed as a separate item on your subscription.
          Cancel anytime — Stripe prorates unused time.
        </p>

        {success ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            Storage add-on added! Your limit will update within a few seconds.
          </div>
        ) : (
          <>
            {/* Billing interval toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              {(["monthly", "annual"] as const).map(iv => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    interval === iv
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {iv === "monthly" ? "Monthly" : "Annual (20% off)"}
                </button>
              ))}
            </div>

            {/* Add-on options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ADDON_OPTIONS.map((opt, i) => (
                <button
                  key={opt.gb}
                  onClick={() => setSelected(selected === i ? null : i)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                    selected === i
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
                  )}
                >
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xl font-bold mt-1">
                    {interval === "annual" ? opt.priceAnnual : `${opt.priceMonthly}/mo`}
                  </p>
                  {selected === i && (
                    <span className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      Selected ✓
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Error */}
            {buyError && (
              <p className="text-xs text-red-600 dark:text-red-400">{buyError}</p>
            )}

            {/* CTA */}
            <Button
              onClick={handleBuy}
              disabled={selected === null || buying}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {buying ? "Processing…" : selected !== null ? `Add ${ADDON_OPTIONS[selected].label} for ${interval === "annual" ? ADDON_OPTIONS[selected].priceAnnual : ADDON_OPTIONS[selected].priceMonthly + "/mo"}` : "Select an option above"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Add-ons are added to your existing subscription and prorated immediately.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
