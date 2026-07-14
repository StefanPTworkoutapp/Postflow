"use client"

/**
 * TemplateSuggestionCard
 *
 * Shows a template improvement suggestion with approve/dismiss actions.
 * One-tap approve: replaces the current_slug with suggested_slug in the
 * brand's active template configuration via /api/templates/suggestions/[id].
 *
 * Usage:
 *   <TemplateSuggestionCard suggestion={suggestion} onRespond={refresh} />
 */

import { useState } from "react"
import { CheckCircle2, X, ArrowRight, TrendingDown, TrendingUp } from "lucide-react"
import { PlatformBadge } from "@/components/shared/PlatformBadge"
import { HealthBar }     from "@/components/shared/HealthBar"
import { HealthScore }   from "@/components/shared/HealthScore"
import { cn } from "@/lib/utils"

export interface TemplateSuggestion {
  id:                string
  brand_id:          string
  current_slug:      string
  suggested_slug:    string
  platform:          string
  reason:            string
  current_score:     number | null
  suggested_score:   number | null
  preview_render_url?: string | null
  status:            string
  created_at:        string
}

interface Props {
  suggestion: TemplateSuggestion
  onRespond?: (id: string, action: "approved" | "dismissed") => void
  className?: string
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score == null) return null
  return (
    <div className="text-center">
      <HealthScore score={score} variant="pill" size="md" />
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
    </div>
  )
}

export function TemplateSuggestionCard({ suggestion, onRespond, className }: Props) {
  const [responding, setResponding] = useState<"approved" | "dismissed" | null>(null)
  const [done, setDone] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const templateLabel = (slug: string) =>
    slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())

  async function handleAction(action: "approved" | "dismissed") {
    setResponding(action)
    try {
      const res = await fetch(`/api/templates/suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))

      if (action === "approved") {
        // Tell the pro plainly whether the swap actually happened — approving
        // no longer just flips a status flag, it mutates the brand's live
        // template rotation (or explains why it couldn't).
        setResultMessage(
          data.applied
            ? `Done — ${templateLabel(suggestion.current_slug)} replaced with ${templateLabel(suggestion.suggested_slug)} for ${suggestion.platform}.`
            : `Approved, but not applied: ${data.reason ?? "no matching slot to swap."}`
        )
        setDone(true)
      } else {
        setDone(true)
        onRespond?.(suggestion.id, action)
      }
    } catch {
      console.error("Failed to respond to suggestion")
    } finally {
      setResponding(null)
    }
  }

  if (done && resultMessage) {
    return (
      <div className={cn(
        "rounded-xl border bg-[hsl(var(--card))] p-4 text-xs text-[hsl(var(--muted-foreground))] flex items-start justify-between gap-3",
        className
      )}>
        <span>{resultMessage}</span>
        <button
          type="button"
          onClick={() => onRespond?.(suggestion.id, "approved")}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (done) return null

  const improvementPts = (suggestion.suggested_score ?? 0) - (suggestion.current_score ?? 0)

  return (
    <div className={cn(
      "rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3 transition-all",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={suggestion.platform} variant="icon" />
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Template suggestion</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Based on {suggestion.platform} performance data
            </p>
          </div>
        </div>
        {improvementPts > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
            <TrendingUp className="h-3.5 w-3.5" />
            +{improvementPts}pts
          </span>
        )}
      </div>

      {/* Template comparison */}
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg bg-[hsl(var(--muted))]/50 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium truncate">{templateLabel(suggestion.current_slug)}</p>
            <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0 ml-1" />
          </div>
          <HealthBar score={suggestion.current_score} />
          <ScoreBadge score={suggestion.current_score} label="current" />
        </div>

        <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />

        <div className="flex-1 rounded-lg border border-[var(--pf-color-brand-primary)]/30 bg-[#CCFBF1]/20 dark:bg-[#0F766E]/10 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--pf-color-brand-primary)] truncate">
              {templateLabel(suggestion.suggested_slug)}
            </p>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0 ml-1" />
          </div>
          <HealthBar score={suggestion.suggested_score} />
          <ScoreBadge score={suggestion.suggested_score} label="suggested" />
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
        {suggestion.reason}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => handleAction("approved")}
          disabled={responding !== null}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--pf-color-brand-primary)] text-white text-xs font-medium py-2 hover:bg-[#0B9090] transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {responding === "approved" ? "Applying…" : "Switch template"}
        </button>
        <button
          type="button"
          onClick={() => handleAction("dismissed")}
          disabled={responding !== null}
          className="flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50 transition-colors disabled:opacity-50"
          title="Dismiss suggestion"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  )
}
