"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle2, ExternalLink, Unlink, Loader2, Eye, EyeOff } from "lucide-react"
import { BufferSetupGuide } from "./BufferSetupGuide"

const PLATFORMS = [
  { id: "instagram", label: "Instagram",  emoji: "📸", color: "bg-pink-50 border-pink-200 dark:bg-pink-950/20" },
  { id: "linkedin",  label: "LinkedIn",   emoji: "💼", color: "bg-blue-50 border-blue-200 dark:bg-blue-950/20" },
  { id: "facebook",  label: "Facebook",   emoji: "👥", color: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20" },
  { id: "tiktok",    label: "TikTok",     emoji: "🎵", color: "bg-zinc-50 border-zinc-200 dark:bg-zinc-950/20" },
  { id: "x",         label: "X / Twitter",emoji: "✖", color: "bg-zinc-50 border-zinc-200 dark:bg-zinc-950/20" },
  { id: "threads",   label: "Threads",    emoji: "🧵", color: "bg-zinc-50 border-zinc-200 dark:bg-zinc-950/20" },
]

const TIER_LABELS: Record<string, { label: string; className: string }> = {
  free:     { label: "Free",     className: "bg-zinc-100 text-zinc-600" },
  starter:  { label: "Starter",  className: "bg-blue-100 text-blue-700" },
  pro:      { label: "Pro",      className: "bg-indigo-100 text-indigo-700" },
  business: { label: "Business", className: "bg-purple-100 text-purple-700" },
}

interface SocialAccount {
  id:               string
  platform:         string
  account_handle:   string | null
  account_url:      string | null
  buffer_profile_id:string | null
  is_active:        boolean
}

interface Props {
  user:           { id: string; email: string; name: string | null }
  account:        { subscription_tier: string; subscription_status: string; trial_ends_at: string | null } | null
  socialAccounts: SocialAccount[]
  brandId:        string | null
}

export function SettingsClient({ user, account, socialAccounts: initial, brandId }: Props) {
  const [name,           setName]           = useState(user.name ?? "")
  const [nameSaving,     setNameSaving]     = useState(false)
  const [nameSaved,      setNameSaved]      = useState(false)
  const [nameError,      setNameError]      = useState<string | null>(null)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>(initial)
  const [disconnecting,    setDisconnecting]    = useState<string | null>(null)
  const [bufferBanner,     setBufferBanner]     = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [bufferToken,      setBufferToken]      = useState("")
  const [showToken,        setShowToken]        = useState(false)
  const [bufferSaving,     setBufferSaving]     = useState(false)
  const [bufferDisconnecting, setBufferDisconnecting] = useState(false)

  const searchParams = useSearchParams()

  // Suppress any stale OAuth redirect params (OAuth no longer used)
  useEffect(() => {
    const connected = searchParams.get("buffer_connected")
    const error     = searchParams.get("buffer_error")
    if (connected || error) {
      window.history.replaceState({}, "", "/settings")
    }
  }, [searchParams])

  const isBufferConnected = socialAccounts.some(s => s.buffer_profile_id)

  async function saveBufferToken() {
    if (!bufferToken.trim()) return
    setBufferSaving(true)
    setBufferBanner(null)
    try {
      const res  = await fetch("/api/settings/buffer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ access_token: bufferToken.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBufferBanner({ type: "error", message: json.error ?? "Failed to connect Buffer" })
        return
      }
      // Update local state immediately — no reload needed
      if (json.socialAccounts?.length) {
        setSocialAccounts(json.socialAccounts as SocialAccount[])
      }
      const names = (json.channels as { platform: string; name: string }[])
        .map(c => c.name).join(", ")
      setBufferBanner({ type: "success", message: `✅ Connected! Synced: ${names}` })
      setBufferToken("")
    } finally {
      setBufferSaving(false)
    }
  }

  async function disconnectBuffer() {
    if (!confirm("Disconnect Buffer? All platform connections will be removed.")) return
    setBufferDisconnecting(true)
    try {
      const res = await fetch("/api/settings/buffer", { method: "DELETE" })
      if (res.ok) {
        setSocialAccounts([])
        setBufferBanner({ type: "success", message: "Buffer disconnected." })
      } else {
        const json = await res.json()
        setBufferBanner({ type: "error", message: json.error ?? "Disconnect failed" })
      }
    } finally {
      setBufferDisconnecting(false)
    }
  }

  const tier = account?.subscription_tier ?? "free"
  const tierCfg = TIER_LABELS[tier] ?? TIER_LABELS.free

  async function saveName() {
    setNameSaving(true)
    setNameError(null)
    setNameSaved(false)
    try {
      const res  = await fetch("/api/settings/account", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) { setNameError(json.error ?? "Failed to save"); return }
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2500)
    } finally {
      setNameSaving(false)
    }
  }

  async function disconnect(socialId: string) {
    if (!confirm("Disconnect this platform? You can reconnect at any time.")) return
    setDisconnecting(socialId)
    try {
      const res = await fetch(`/api/settings/social/${socialId}`, { method: "DELETE" })
      if (res.ok) setSocialAccounts(prev => prev.filter(s => s.id !== socialId))
    } finally {
      setDisconnecting(null)
    }
  }

  const connectedIds = new Set(socialAccounts.map(s => s.platform))

  return (
    <div className="space-y-6">

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your profile and subscription details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
              {(name || user.email)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge className={cn("text-xs border-0", tierCfg.className)}>
                  {tierCfg.label} plan
                </Badge>
                {/* Trial render counter — hardcoded at 3 until usage tracking is wired */}
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  Trial · 3 renders remaining
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Display name</Label>
            <div className="flex gap-2 max-w-sm">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <Button size="sm" onClick={saveName} disabled={nameSaving}>
                {nameSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : nameSaved ? "Saved ✓" : "Save"}
              </Button>
            </div>
            {nameError && <p className="text-xs text-[hsl(var(--destructive))]">{nameError}</p>}
          </div>

          {/* Subscription */}
          <div className="rounded-lg border bg-[hsl(var(--muted))]/30 p-4 space-y-1">
            <p className="text-sm font-medium">Subscription</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {tier === "free"
                ? "You're on the Free plan. Upgrade to unlock unlimited posts, Buffer scheduling, and analytics."
                : `${tierCfg.label} plan · ${account?.subscription_status ?? "active"}`}
            </p>
            {account?.trial_ends_at && new Date(account.trial_ends_at) > new Date() && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Trial ends {new Date(account.trial_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link href="/settings/billing">Manage billing →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Connected platforms ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected platforms</CardTitle>
          <CardDescription>
            Connect your social accounts via Buffer. PostFlow will schedule posts automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Buffer OAuth result banner */}
          {bufferBanner && (
            <div className={cn(
              "rounded-lg border px-4 py-3 text-sm font-medium",
              bufferBanner.type === "success"
                ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400"
                : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400"
            )}>
              {bufferBanner.message}
            </div>
          )}

          {/* Buffer connect */}
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 px-4 py-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">⚡</span>
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Buffer</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Paste your Buffer API token to auto-publish scheduled posts.{" "}
                    <a
                      href="https://publish.buffer.com/profile/settings/api"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-500 hover:underline inline-flex items-center gap-0.5"
                    >
                      Get token <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
                {isBufferConnected && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                      {socialAccounts.filter(s => s.buffer_profile_id).length} channel{socialAccounts.filter(s => s.buffer_profile_id).length !== 1 ? "s" : ""} synced
                    </span>
                  </div>
                )}
              </div>

              {/* Token input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={bufferToken}
                    onChange={(e) => setBufferToken(e.target.value)}
                    placeholder={isBufferConnected ? "Paste new token to update…" : "Paste your Buffer API token…"}
                    className="pr-9 font-mono text-xs"
                    onKeyDown={(e) => e.key === "Enter" && saveBufferToken()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={saveBufferToken}
                  disabled={bufferSaving || !bufferToken.trim()}
                >
                  {bufferSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isBufferConnected ? "Update" : "Connect"}
                </Button>
                {isBufferConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={disconnectBuffer}
                    disabled={bufferDisconnecting}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                  >
                    {bufferDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Buffer setup guide */}
          <BufferSetupGuide isConnected={isBufferConnected} />

          {/* Channel list label */}
          {isBufferConnected && connectedIds.size > 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] px-1">
              ↻ Channel list updates automatically each time you open this page.
            </p>
          )}

          {/* Connected platform list — only show platforms that are actually connected */}
          {connectedIds.size === 0 ? (
            <div className="rounded-lg border border-dashed border-[hsl(var(--border))] px-4 py-6 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No channels synced yet.</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Connect Buffer above and your channels will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLATFORMS.filter(p => connectedIds.has(p.id)).map(p => {
                const account = socialAccounts.find(s => s.platform === p.id)
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2.5",
                      p.color
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{p.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.label}</p>
                        {account?.account_handle && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">@{account.account_handle}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <button
                        onClick={() => disconnect(account!.id)}
                        disabled={disconnecting === account!.id}
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
                        title="Disconnect"
                      >
                        {disconnecting === account!.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Unlink className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Danger zone ───────────────────────────────────────────────────── */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-base text-[hsl(var(--destructive))]">Danger zone</CardTitle>
          <CardDescription>Irreversible actions. Be careful.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Delete all posts</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Permanently deletes all posts and calendar entries for this brand.</p>
            </div>
            <Button variant="destructive" size="sm" disabled>
              Delete (coming soon)
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Permanently deletes your account and all associated data.</p>
            </div>
            <Button variant="destructive" size="sm" disabled>
              Delete (coming soon)
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
