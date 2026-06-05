"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"

/**
 * Shows a dismissible banner when the user skipped onboarding.
 * Reads the `postflow_onboarding_skipped` sessionStorage flag set by OnboardingWizard.
 */
export function OnboardingSkippedBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem("postflow_onboarding_skipped") === "1") {
        setVisible(true)
      }
    } catch { /* sessionStorage unavailable */ }
  }, [])

  function dismiss() {
    setVisible(false)
    try { sessionStorage.removeItem("postflow_onboarding_skipped") } catch { /* ignore */ }
  }

  if (!visible) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border-l-4 border-[var(--pf-teal)] bg-[var(--pf-teal)]/8 px-4 py-3 text-sm">
      <span className="mt-0.5 shrink-0 text-base">✨</span>
      <div className="flex-1 min-w-0">
        <span className="text-[hsl(var(--foreground))]">
          Your brand is partially set up. Complete it to make every post sound exactly like you.{" "}
        </span>
        <Link
          href="/onboarding"
          className="font-medium text-[var(--pf-teal)] hover:underline"
          onClick={dismiss}
        >
          Complete setup →
        </Link>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mt-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
