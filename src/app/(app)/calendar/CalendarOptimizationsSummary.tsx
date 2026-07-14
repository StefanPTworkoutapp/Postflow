"use client"

/**
 * Collapsed, attention-first summary of what weeklyCalendarReoptimize.ts
 * (P3, 2026-07-14) changed this week — one line ("Calendar optimized — N
 * changes this week") with a chevron to expand the actual list. Nothing here
 * is a silent background mutation: every row comes straight from
 * `calendar_optimizations`, which the Inngest job writes on every change.
 */

import { useState } from "react"
import { ChevronDown, ChevronRight, Clock, LayoutTemplate } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CalendarOptimization {
  id:          string
  entry_id:    string
  change_type: "timing" | "template"
  from_value:  string | null
  to_value:    string | null
  reason:      string | null
  created_at:  string
}

export function CalendarOptimizationsSummary({ optimizations }: { optimizations: CalendarOptimization[] }) {
  const [open, setOpen] = useState(false)

  if (!optimizations.length) return null

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm"
      >
        <span className="flex items-center gap-2 font-medium text-[hsl(var(--foreground))]">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Calendar optimized — {optimizations.length} change{optimizations.length === 1 ? "" : "s"} this week
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {optimizations.filter(o => o.change_type === "timing").length} timing · {optimizations.filter(o => o.change_type === "template").length} template
        </span>
      </button>

      {open && (
        <div className="border-t border-[hsl(var(--border))] px-4 py-3 space-y-2">
          {optimizations.map(o => (
            <div key={o.id} className="flex items-start gap-2 text-xs">
              {o.change_type === "timing"
                ? <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
                : <LayoutTemplate className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />}
              <div>
                <span className="font-medium capitalize">{o.change_type}</span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {" "}moved <span className={cn("font-mono")}>{o.from_value}</span> → <span className="font-mono">{o.to_value}</span>
                </span>
                {o.reason && <div className="text-[hsl(var(--muted-foreground))] mt-0.5">{o.reason}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
