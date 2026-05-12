"use client"

/**
 * HealthBar
 *
 * Reusable horizontal progress bar for displaying template / content health
 * scores (0–100). Colour tier is derived from the score.
 *
 * Usage:
 *   <HealthBar score={82} />
 *   <HealthBar score={42} size="sm" showLabel />
 *   <HealthBar score={null} />   ← renders nothing
 */

import { cn } from "@/lib/utils"

interface HealthBarProps {
  score:      number | null
  showLabel?: boolean
  size?:      "sm" | "md" | "lg"
  className?: string
}

type Tier = "high" | "medium" | "low"

function getTier(score: number): Tier {
  if (score >= 75) return "high"
  if (score >= 45) return "medium"
  return "low"
}

const BAR_COLORS: Record<Tier, string> = {
  high:   "bg-green-500",
  medium: "bg-amber-400",
  low:    "bg-red-500",
}

const LABEL_COLORS: Record<Tier, string> = {
  high:   "text-green-600 dark:text-green-400",
  medium: "text-amber-600 dark:text-amber-400",
  low:    "text-red-600   dark:text-red-400",
}

const BAR_HEIGHTS: Record<NonNullable<HealthBarProps["size"]>, string> = {
  sm: "h-0.5",
  md: "h-1",
  lg: "h-1.5",
}

const LABEL_SIZES: Record<NonNullable<HealthBarProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm font-medium",
}

export function HealthBar({ score, showLabel = false, size = "md", className }: HealthBarProps) {
  if (score == null) return null

  const tier      = getTier(score)
  const barColor  = BAR_COLORS[tier]
  const barHeight = BAR_HEIGHTS[size]

  return (
    <div className={cn("space-y-0.5", className)}>
      {/* Bar track */}
      <div className={cn("w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden", barHeight)}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      {/* Optional numeric label */}
      {showLabel && (
        <p className={cn("tabular-nums", LABEL_SIZES[size], LABEL_COLORS[tier])}>
          {score}
        </p>
      )}
    </div>
  )
}
