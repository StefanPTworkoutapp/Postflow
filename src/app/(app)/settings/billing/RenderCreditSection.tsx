"use client"

/**
 * RenderCreditSection — shown on the billing page.
 *
 * Displays current render credit balance and allows purchasing packs
 * via Stripe Checkout (one-time payment).
 *
 * Credit packs:
 *   10 renders — €9
 *   50 renders — €39
 *   100 renders — €69
 */

import { useState } from "react"
import { Video, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CREDIT_PACKS } from "@/lib/server/billing/renderCredits"

interface Props {
  balance: number
}

export function RenderCreditSection({ balance }: Props) {
  const [selected, setSelected]  = useState<number | null>(null)
  const [buying, setBuying]      = useState(false)
  const [buyError, setBuyError]  = useState<string | null>(null)

  async function handleBuy() {
    if (selected === null) return
    const pack = CREDIT_PACKS[selected]
    setBuying(true)
    setBuyError(null)
    try {
      const res = await fetch("/api/billing/addon/render-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBuyError(json.error ?? "Purchase failed. Please try again.")
      } else if (json.url) {
        window.location.href = json.url
      }
    } catch {
      setBuyError("Network error. Please try again.")
    } finally {
      setBuying(false)
    }
  }

  return (
    <Card id="render-credits">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          Render Credits
          <span className={cn(
            "ml-auto text-xs font-medium rounded-full px-2 py-0.5",
            balance > 0
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
              : "bg-muted text-muted-foreground"
          )}>
            {balance} credit{balance !== 1 ? "s" : ""} remaining
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Each clip-forge video render uses 1 credit. Credits never expire.
          Purchase additional packs anytime — no subscription required.
        </p>

        {balance === 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            You have no render credits. Purchase a pack to generate videos.
          </div>
        )}

        {/* Credit packs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREDIT_PACKS.map((pack, i) => {
            const perRender = (pack.priceEur / pack.credits).toFixed(2)
            return (
              <button
                key={pack.id}
                onClick={() => setSelected(selected === i ? null : i)}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                  selected === i
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
                )}
              >
                <p className="text-sm font-semibold">{pack.credits} renders</p>
                <p className="text-2xl font-bold mt-1">{pack.priceLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  €{perRender} per render
                </p>
                {i === 1 && (
                  <span className="mt-2 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                    Best value
                  </span>
                )}
                {selected === i && (
                  <span className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Selected
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {buyError && (
          <p className="text-xs text-red-600 dark:text-red-400">{buyError}</p>
        )}

        <Button
          onClick={handleBuy}
          disabled={selected === null || buying}
          className="gap-1.5"
        >
          {buying
            ? "Redirecting to checkout…"
            : selected !== null
            ? `Buy ${CREDIT_PACKS[selected].credits} renders for ${CREDIT_PACKS[selected].priceLabel}`
            : "Select a pack above"}
        </Button>
        <p className="text-xs text-muted-foreground">
          One-time payment via Stripe. Credits are added within seconds of purchase.
        </p>
      </CardContent>
    </Card>
  )
}
