/**
 * SelectCard — a selectable option card for the clip-forge wizard.
 *
 * Used for:
 *   - Goal selection (e.g. "Grow followers", "Educate")
 *   - Platform selection
 *   - Any future single-choice step
 *
 * Renders a bordered card with icon, label, optional description.
 * Selected state uses the brand accent color ring.
 */

"use client"

import { cn } from "@/lib/utils"

export interface SelectCardOption<T extends string> {
  value:       T
  label:       string
  description?: string
  icon?:        React.ReactNode
  emoji?:       string
}

interface SelectCardProps<T extends string> {
  options:    SelectCardOption<T>[]
  value:      T | null
  onChange:   (value: T) => void
  className?: string
  columns?:   2 | 3 | 4
}

export function SelectCard<T extends string>({
  options,
  value,
  onChange,
  className,
  columns = 3,
}: SelectCardProps<T>) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  }[columns]

  return (
    <div className={cn("grid gap-3", gridCols, className)}>
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
              "hover:border-indigo-400/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20",
              selected
                ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-400/40 dark:bg-indigo-950/30 dark:border-indigo-400"
                : "border-border bg-card",
            )}
          >
            {/* Icon / emoji */}
            {(opt.emoji || opt.icon) && (
              <span className="text-xl leading-none">
                {opt.emoji ?? opt.icon}
              </span>
            )}

            {/* Label */}
            <span className={cn(
              "font-medium text-sm",
              selected ? "text-indigo-700 dark:text-indigo-300" : "text-foreground",
            )}>
              {opt.label}
            </span>

            {/* Description */}
            {opt.description && (
              <span className="text-xs text-muted-foreground leading-snug">
                {opt.description}
              </span>
            )}

            {/* Selected indicator */}
            {selected && (
              <span className="ml-auto mt-auto h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
            )}
          </button>
        )
      })}
    </div>
  )
}
