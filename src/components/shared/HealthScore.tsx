"use client"

/**
 * HealthScore
 *
 * Compact badge / pill showing a numeric health score with colour tier.
 * Use for at-a-glance scores where a full bar doesn't fit (table cells,
 * card corners, inline list items).
 *
 * Usage:
 *   <HealthScore score={82} />
 *   <HealthScore score={42} variant="pill" size="lg" />
 *   <HealthScore score={null} />   ← renders "–"
 */

import { cn } from "@/lib/utils"

interface HealthScoreProps {
  score:    number | null
  /** "badge" = rounded square (default), "pill" = fully rounded */
  variant?: "badge" | "pill"
  size?:    "sm" | "md" | "lg"
  className?: string
}

type Tier = "high" | "medium" | "low"

function getTier(score: number): Tier {
  if (score >= 75) return "high"
  if (score >= 45) return "medium"
  return "low"
}

const TIER_STYLES: Record<Tier, string> = {
  high:   "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  low:    "bg-red-50   text-red-700   dark:bg-red-950/30   dark:text-red-400",
}

const NULL_STYLE = "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"

const SIZE_STYLES: Record<NonNullable<HealthScoreProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2   py-0.5 text-xs font-semibold",
  lg: "px-2.5 py-1   text-sm font-semibold",
}

export function HealthScore({ score, variant = "badge", size = "md", className }: HealthScoreProps) {
  const tierStyle  = score != null ? TIER_STYLES[getTier(score)] : NULL_STYLE
  const sizeStyle  = SIZE_STYLES[size]
  const radiusStyle = variant === "pill" ? "rounded-full" : "rounded"

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center tabular-nums",
        tierStyle,
        sizeStyle,
        radiusStyle,
        className,
      )}
    >
      {score != null ? score : "–"}
    </span>
  )
}
