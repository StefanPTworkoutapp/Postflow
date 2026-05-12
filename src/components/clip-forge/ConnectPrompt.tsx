/**
 * ConnectPrompt — shown when the user tries to schedule a clip-forge video
 * but hasn't connected a social account for the selected platform.
 *
 * Directs them to /settings/connections to link their account.
 */

"use client"

import Link      from "next/link"
import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn }    from "@/lib/utils"

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok:    "TikTok",
  linkedin:  "LinkedIn",
  facebook:  "Facebook",
  youtube:   "YouTube",
}

interface ConnectPromptProps {
  platform:  string
  className?: string
  /** Called when the user wants to skip scheduling and just save the video */
  onSkip?:   () => void
}

export function ConnectPrompt({ platform, className, onSkip }: ConnectPromptProps) {
  const label = PLATFORM_LABELS[platform] ?? platform

  return (
    <div className={cn(
      "flex flex-col items-center gap-5 rounded-xl border border-amber-200 bg-amber-50/60 p-8 text-center dark:border-amber-800/40 dark:bg-amber-950/20",
      className,
    )}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
        <Link2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold">Connect your {label} account</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          To schedule this video on {label}, you need to connect your account first.
          It only takes a minute.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Button asChild>
          <Link href="/settings/connections">
            Connect {label}
          </Link>
        </Button>

        {onSkip && (
          <Button variant="ghost" onClick={onSkip}>
            Save without scheduling
          </Button>
        )}
      </div>
    </div>
  )
}
