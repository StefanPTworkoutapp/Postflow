"use client"

import { cn } from "@/lib/utils"
import { GOALS } from "@/lib/shared/onboarding/types"

interface Props {
  selected: string[]        // ordered — index 0 = primary
  onChange: (ordered: string[]) => void
}

/**
 * Ranked goal picker. First click = primary (rank 1), next = secondary, etc.
 * Clicking a selected goal removes it and closes the gap.
 */
export function RankedGoalPicker({ selected, onChange }: Props) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const RANK_LABELS = ["Primary", "Secondary", "3rd", "4th", "5th"]

  return (
    <div className="space-y-2">
      {GOALS.map(({ value, label }) => {
        const rank = selected.indexOf(value)
        const isSelected = rank !== -1
        const isPrimary = rank === 0

        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={cn(
              "w-full text-left rounded-lg border-2 px-4 py-3 transition-colors flex items-center gap-3",
              isPrimary
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                : isSelected
                  ? "border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20"
                  : "border-[hsl(var(--border))] hover:border-indigo-200"
            )}
          >
            {/* Rank badge */}
            <span className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
              isPrimary
                ? "bg-indigo-500 text-white"
                : isSelected
                  ? "bg-indigo-200 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-300"
                  : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
            )}>
              {isSelected ? rank + 1 : ""}
            </span>

            {/* Label + rank text */}
            <span className="flex-1 min-w-0">
              <span className={cn(
                "text-sm font-medium block",
                isPrimary && "text-indigo-700 dark:text-indigo-300",
                isSelected && !isPrimary && "text-indigo-600 dark:text-indigo-400",
              )}>
                {label}
              </span>
              {isSelected && (
                <span className={cn(
                  "text-xs",
                  isPrimary
                    ? "text-indigo-500 font-medium"
                    : "text-[hsl(var(--muted-foreground))]"
                )}>
                  {RANK_LABELS[rank]}
                </span>
              )}
            </span>

            {/* Primary star */}
            {isPrimary && (
              <span className="text-indigo-400 text-xs font-semibold shrink-0">★ Primary</span>
            )}
          </button>
        )
      })}

      {selected.length > 0 && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] pt-1">
          Click a selected goal again to remove it. Order matters — AI uses it to prioritise your content.
        </p>
      )}
    </div>
  )
}
