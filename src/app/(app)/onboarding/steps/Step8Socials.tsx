"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell } from "./StepShell"

/**
 * How posting works in PostFlow:
 *
 * AUTO-POSTING via Buffer  — All scheduled posts go through Buffer's GraphQL API.
 *   Buffer uses a personal access token (not OAuth). Instagram with media needs a
 *   tap in the Buffer mobile app (Meta API limitation) but scheduling is via Buffer.
 *
 * ANALYTICS via direct OAuth — Instagram / LinkedIn / Facebook / TikTok store tokens
 *   for reading insights. Posting still goes through Buffer.
 *
 * Recommended: paste your Buffer API token first, then connect platforms for analytics.
 */

// Direct-OAuth platforms (analytics only)
const PLATFORMS = [
  { id: "instagram", label: "Instagram", note: "Analytics & insights", authUrl: "/api/auth/instagram" },
  { id: "linkedin",  label: "LinkedIn",  note: "Analytics & insights", authUrl: "/api/auth/linkedin"  },
  { id: "facebook",  label: "Facebook",  note: "Analytics & insights", authUrl: "/api/auth/facebook"  },
  { id: "tiktok",    label: "TikTok",    note: "Analytics & insights", authUrl: "/api/auth/tiktok"    },
]

interface Props {
  draft: OnboardingDraft
  next:  () => void
  back:  () => void
}

export function Step8Socials({ next, back }: Props) {
  const [connected,      setConnected]      = useState<Set<string>>(new Set())
  const [loading,        setLoading]        = useState(true)

  // Buffer token state
  const [bufferToken,    setBufferToken]    = useState("")
  const [showToken,      setShowToken]      = useState(false)
  const [savingBuffer,   setSavingBuffer]   = useState(false)
  const [bufferError,    setBufferError]    = useState<string | null>(null)
  const tokenRef = useRef<HTMLInputElement>(null)

  // Fetch connected platforms
  function refreshConnections() {
    fetch("/api/connections/list")
      .then(r => r.json() as Promise<{ platforms: string[] }>)
      .then(({ platforms }) => setConnected(new Set(platforms)))
      .catch(() => {})
  }

  useEffect(() => {
    refreshConnections()
    setLoading(false)
  }, [])

  // Re-check on tab focus (user returned from OAuth flow)
  useEffect(() => {
    function onFocus() { refreshConnections() }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  async function handleSaveBuffer() {
    if (!bufferToken.trim()) return
    setSavingBuffer(true)
    setBufferError(null)
    try {
      const res  = await fetch("/api/settings/buffer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ access_token: bufferToken.trim() }),
      })
      const json = await res.json() as { success?: boolean; channels?: { platform: string; name: string }[]; error?: string }
      if (!res.ok || json.error) {
        setBufferError(json.error ?? "Failed to connect Buffer")
      } else {
        setBufferToken("")
        refreshConnections()
      }
    } catch {
      setBufferError("Network error — please try again")
    } finally {
      setSavingBuffer(false)
    }
  }

  const bufferConnected = connected.has("buffer")

  return (
    <StepShell
      title="Connect your accounts"
      description="Connect Buffer to enable auto-posting, then connect platforms for analytics."
      onBack={back}
    >
      {/* ── Buffer (token-based, required for posting) ───────────────── */}
      <div
        className={cn(
          "rounded-lg border p-4 space-y-3 transition-colors",
          bufferConnected
            ? "border-green-500/40 bg-green-50/50 dark:bg-green-950/20"
            : "border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Buffer</p>
              {!bufferConnected && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                  Start here
                </span>
              )}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {bufferConnected
                ? "Auto-posting enabled for all connected Buffer channels"
                : "Required for scheduled posting to Instagram, LinkedIn, Facebook & more"}
            </p>
          </div>
          {bufferConnected && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap shrink-0">
              <CheckCircle2 className="h-4 w-4" />
              Connected
            </span>
          )}
        </div>

        {!bufferConnected && (
          <div className="space-y-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Paste your Buffer API token from{" "}
              <a
                href="https://publish.buffer.com/profile/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[hsl(var(--foreground))]"
              >
                Buffer → Settings → API
              </a>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={tokenRef}
                  type={showToken ? "text" : "password"}
                  placeholder="buf_…"
                  value={bufferToken}
                  onChange={e => setBufferToken(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void handleSaveBuffer() }}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSaveBuffer}
                disabled={savingBuffer || !bufferToken.trim()}
              >
                {savingBuffer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
            {bufferError && (
              <p className="text-xs text-[hsl(var(--destructive))]">{bufferError}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Direct platform connections (analytics only) ─────────────── */}
      <div className="space-y-2 mt-3">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
          Direct connections — for analytics
        </p>
        {PLATFORMS.map(({ id, label, note, authUrl }) => {
          const isConnected = connected.has(id)
          return (
            <div
              key={id}
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                isConnected && "border-green-500/40 bg-green-50/50 dark:bg-green-950/20",
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
                  onClick={() => { window.location.href = `${authUrl}?return_to=/onboarding` }}
                >
                  Connect
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {!bufferConnected && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center pt-1">
          Without Buffer, posts will be drafted but you&apos;ll need to post them manually.
        </p>
      )}

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
