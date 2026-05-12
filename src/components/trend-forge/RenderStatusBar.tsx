/**
 * RenderStatusBar — shows parallel A/B render progress.
 *
 * Displays two progress bars side by side (Version A and Version B)
 * while both Shotstack renders are running.
 */

"use client"

import { Loader2, CheckCircle2 } from "lucide-react"
import { cn }                    from "@/lib/utils"

interface RenderStatusBarProps {
  progressA:  number   // 0–100
  progressB:  number   // 0–100
  doneA?:     boolean
  doneB?:     boolean
  className?: string
}

export function RenderStatusBar({
  progressA,
  progressB,
  doneA  = false,
  doneB  = false,
  className,
}: RenderStatusBarProps) {
  const avg = Math.round((progressA + progressB) / 2)

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Rendering both versions…</span>
        <span className="text-muted-foreground tabular-nums">{avg}%</span>
      </div>

      {/* Version A */}
      <VersionBar label="A — Trend-first" progress={progressA} done={doneA} color="indigo" />

      {/* Version B */}
      <VersionBar label="B — Brand-first" progress={progressB} done={doneB} color="emerald" />
    </div>
  )
}

function VersionBar({
  label,
  progress,
  done,
  color,
}: {
  label:    string
  progress: number
  done:     boolean
  color:    "indigo" | "emerald"
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        {done
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          : <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        }
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            color === "indigo"  ? "bg-indigo-500"  : "bg-emerald-500",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
