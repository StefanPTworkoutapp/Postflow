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
    <div className="space-y-3">
      {GOALS.map(({ value, label, icon, description }) => {
        const rank = selected.indexOf(value)
        const isSelected = rank !== -1
        const isPrimary = rank === 0

        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={cn(
              "w-full text-left rounded-xl border-2 px-5 py-4 transition-all flex items-center gap-4",
              isPrimary
                ? "border-[var(--pf-teal)] bg-[var(--pf-teal)]/10"
                : isSelected
                  ? "border-[var(--pf-teal)]/40 bg-[var(--pf-teal)]/5"
                  : "border-[hsl(var(--border))] hover:border-[var(--pf-teal)]/30 hover:bg-[hsl(var(--muted))]/40"
            )}
          >
            {/* Icon circle */}
            <span className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl",
              isPrimary
                ? "bg-[var(--pf-teal)]/20"
                : isSelected
                  ? "bg-[var(--pf-teal)]/10"
                  : "bg-[hsl(var(--muted))]"
            )}>
              {icon}
            </span>

            {/* Label + description */}
            <span className="flex-1 min-w-0">
              <span className={cn(
                "text-sm font-semibold block",
                isPrimary && "text-[var(--pf-teal)]",
                isSelected && !isPrimary && "text-[hsl(var(--foreground))]",
              )}>
                {label}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 block">
                {isSelected
                  ? <span className={cn("font-medium", isPrimary ? "text-[var(--pf-teal)]" : "text-[hsl(var(--muted-foreground))]")}>{RANK_LABELS[rank]}</span>
                  : description}
              </span>
            </span>

            {/* Rank badge */}
            <span className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
              isPrimary
                ? "bg-[var(--pf-teal)] text-white"
                : isSelected
                  ? "bg-[var(--pf-teal)]/20 text-[var(--pf-teal)]"
                  : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
            )}>
              {isSelected ? rank + 1 : ""}
            </span>
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
