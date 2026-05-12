"use client"

/**
 * RenderStatusBar
 *
 * Compact progress bar shown while a Puppeteer / Shotstack render is in flight.
 * Displays a spinner + status message + optional progress percentage.
 * Designed to slot into any panel footer or drawer header.
 *
 * States:
 *   idle       — nothing shown (returns null)
 *   rendering  — animated bar + message
 *   done       — green check + "Ready" for a moment before parent hides it
 *   error      — red indicator + truncated error message
 *
 * Usage:
 *   <RenderStatusBar status="rendering" message="Rendering slide 3 of 5…" progress={60} />
 *   <RenderStatusBar status="done" />
 *   <RenderStatusBar status="error" message="Render failed: timeout" />
 */

import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type RenderStatus = "idle" | "rendering" | "done" | "error"

interface RenderStatusBarProps {
  status:    RenderStatus
  message?:  string
  /** 0–100, shown as a fill bar when rendering */
  progress?: number
  className?: string
}

export function RenderStatusBar({ status, message, progress, className }: RenderStatusBarProps) {
  if (status === "idle") return null

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all",
        status === "rendering" && "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300",
        status === "done"      && "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300",
        status === "error"     && "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400",
        className
      )}
    >
      {/* Icon */}
      {status === "rendering" && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
      {status === "done"      && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
      {status === "error"     && <XCircle className="h-3.5 w-3.5 shrink-0" />}

      {/* Message */}
      <span className="flex-1 truncate">
        {status === "rendering" && (message ?? "Rendering…")}
        {status === "done"      && (message ?? "Done")}
        {status === "error"     && (message ?? "Render failed")}
      </span>

      {/* Progress percentage */}
      {status === "rendering" && progress !== undefined && (
        <span className="shrink-0 tabular-nums">{Math.round(progress)}%</span>
      )}

      {/* Progress fill bar (rendering only) */}
      {status === "rendering" && progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-100 dark:bg-indigo-900 rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
