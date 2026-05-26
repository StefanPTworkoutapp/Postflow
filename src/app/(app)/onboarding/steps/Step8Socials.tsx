"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell } from "./StepShell"

const PLATFORMS = [
  {
    id:      "instagram",
    label:   "Instagram",
    note:    "Manual posting — we'll send reminders",
    authUrl: "/api/auth/instagram",
  },
  {
    id:      "linkedin",
    label:   "LinkedIn",
    note:    "Auto-post via Buffer",
    authUrl: "/api/auth/linkedin",
  },
  {
    id:      "facebook",
    label:   "Facebook",
    note:    "Auto-post via Buffer",
    authUrl: "/api/auth/facebook",
  },
  {
    id:      "tiktok",
    label:   "TikTok",
    note:    "Manual posting — we'll send reminders",
    authUrl: "/api/auth/tiktok",
  },
]

interface Props {
  draft:  OnboardingDraft
  next:   () => void
  back:   () => void
}

export function Step8Socials({ next, back }: Props) {
  const [connected,  setConnected]  = useState<Set<string>>(new Set())
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetch("/api/connections/list")
      .then(r => r.json() as Promise<{ platforms: string[] }>)
      .then(({ platforms }) => setConnected(new Set(platforms)))
      .catch(() => { /* show connect buttons regardless */ })
      .finally(() => setLoading(false))
  }, [])

  // Re-check connections when the tab regains focus (user returned from OAuth)
  useEffect(() => {
    function onFocus() {
      fetch("/api/connections/list")
        .then(r => r.json() as Promise<{ platforms: string[] }>)
        .then(({ platforms }) => setConnected(new Set(platforms)))
        .catch(() => {})
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  return (
    <StepShell
      title="Connect your social accounts"
      description="Connect platforms for analytics and auto-posting. You can skip this and connect later in Settings."
      onBack={back}
    >
      <div className="space-y-3">
        {PLATFORMS.map(({ id, label, note, authUrl }) => {
          const isConnected = connected.has(id)
          return (
            <div
              key={id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-4 transition-colors",
                isConnected && "border-green-500/40 bg-green-50/50 dark:bg-green-950/20"
              )}
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{note}</p>
              </div>

              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
              ) : isConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Connected
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = `${authUrl}?return_to=/onboarding`
                  }}
                >
                  Connect
                </Button>
              )}
            </div>
          )
        })}

        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          You can also manage connections in Settings → Connections.
        </p>
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={back}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={next}>Skip for now</Button>
          <Button onClick={next}>Continue</Button>
        </div>
      </div>
    </StepShell>
  )
}
