"use client"

/**
 * ActionableError — the ONE way user-facing errors are shown in PostFlow.
 *
 * Every error must give the user a next step, never just a message:
 *   - Missing/expired platform connection → "Connect {platform}" button,
 *     deep-linking to /settings/connections?platform={platform}.
 *   - Anything else → "Report to support" button, opening a prefilled
 *     mailto: draft to support so it becomes an actionable bug report
 *     instead of a dead end.
 *
 * See CLAUDE.md → "UNIVERSAL ACTIONABLE ERRORS RULE" for the project rule
 * this component exists to satisfy.
 */

import Link from "next/link"
import { AlertTriangle, Link2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SUPPORT_EMAIL = "support@mindyourbodypt.app"

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok:    "TikTok",
  linkedin:  "LinkedIn",
  facebook:  "Facebook",
  youtube:   "YouTube",
  threads:   "Threads",
  x:         "X",
}

export interface ActionableErrorProps {
  /** The raw error message to show the user */
  message: string
  /**
   * Set when the error is caused by a missing/expired connection for this
   * platform slug — renders a "Connect {platform}" button instead of the
   * generic support fallback.
   */
  platform?: string | null
  /**
   * Short label for what the user was doing when this failed, e.g.
   * "Scheduling a post" or "Uploading media" — used in the support email
   * subject/body so the report is useful without back-and-forth.
   */
  context?: string
  /** Visual weight — "error" (red) or "warn" (amber). Default "error". */
  tone?: "error" | "warn"
  className?: string
}

function buildSupportMailto(message: string, context?: string): string {
  const subject = `PostFlow — ${context ?? "Error report"}`
  const body = [
    context ? `What I was doing: ${context}` : null,
    `Error message: ${message}`,
    `Page: ${typeof window !== "undefined" ? window.location.href : ""}`,
    `Time: ${typeof window !== "undefined" ? new Date().toString() : ""}`,
  ].filter(Boolean).join("\n")

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function ActionableError({ message, platform, context, tone = "error", className }: ActionableErrorProps) {
  const platformLabel = platform ? (PLATFORM_LABELS[platform] ?? platform) : null

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="flex-1">{message}</p>
      </div>

      <div className="flex flex-wrap gap-2 pl-6">
        {platformLabel ? (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs bg-white/60 dark:bg-black/20">
            <Link href={`/settings/connections?platform=${encodeURIComponent(platform!)}`}>
              <Link2 className="h-3 w-3 mr-1" /> Connect {platformLabel}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs bg-white/60 dark:bg-black/20">
            <a href={buildSupportMailto(message, context)}>
              <Mail className="h-3 w-3 mr-1" /> Report to support
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Given a schedule/publish API error response, determine whether it's a
 * missing-connection problem (→ show a Connect button) or a genuine failure
 * (→ show a support-report button). Shared by every surface that schedules
 * posts so the classification logic lives in exactly one place.
 */
export function classifyScheduleError(json: { error?: string; needsBuffer?: boolean }, platform?: string | null): {
  message: string
  connectionPlatform: string | null
} {
  const message = json.error ?? "Something went wrong while scheduling."
  const looksLikeConnectionIssue =
    json.needsBuffer === true ||
    /not connected|no buffer account|connect (your|it in)|does not support direct publishing/i.test(message)

  return {
    message,
    connectionPlatform: looksLikeConnectionIssue ? (platform ?? null) : null,
  }
}
