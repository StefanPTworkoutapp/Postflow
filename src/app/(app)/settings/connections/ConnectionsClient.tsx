"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter }     from "next/navigation"
import {
  Loader2, Unlink, ExternalLink, CheckCircle2,
  AlertCircle, RefreshCw, Link2,
} from "lucide-react"
import { Button }        from "@/components/ui/button"
import { PlatformBadge, PLATFORM_META } from "@/components/shared/PlatformBadge"
import { cn }            from "@/lib/utils"

interface SocialAccount {
  id:                    string
  platform:              string
  account_handle:        string | null
  account_url:           string | null
  buffer_profile_id:     string | null
  is_active:             boolean
  token_expires_at:      string | null
  created_at:            string
}

interface Props {
  initialAccounts: SocialAccount[]
  brandId:         string | null
}

const BUFFER_CONNECTED_PLATFORMS = ["instagram", "linkedin", "facebook", "tiktok", "x", "threads"]

// Platforms with direct OAuth built — others show "Coming soon"
// V2B: added tiktok, linkedin, facebook
const DIRECT_CONNECT_SUPPORTED = new Set(["instagram", "tiktok", "linkedin", "facebook"])

// ── Inner component (uses useSearchParams — needs Suspense wrapper) ──────────

function ConnectionsInner({ initialAccounts, brandId }: Props) {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const [accounts,      setAccounts]      = useState<SocialAccount[]>(initialAccounts)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [success,       setSuccess]       = useState<string | null>(null)
  const [connecting,    setConnecting]    = useState<string | null>(null)

  // ── Handle OAuth callback params ───────────────────────────────────────────
  useEffect(() => {
    const connected = searchParams.get("connected")
    const errParam  = searchParams.get("error")

    if (connected) {
      const label = PLATFORM_META[connected]?.label ?? connected
      setSuccess(`${label} connected successfully`)
      // Clean up URL without reload
      router.replace("/settings/connections", { scroll: false })
      // Refresh account list
      void fetch("/api/settings/social")
        .then(r => r.json())
        .then(d => { if (d.connections) setAccounts(d.connections) })
    } else if (errParam) {
      // errParam may be a short code (e.g. "server_misconfigured") or a full Facebook error
      // (e.g. "fb_191: Given URL is not allowed by the Application configuration.")
      const isFbError = errParam.startsWith("fb_")
      setError(isFbError ? `Facebook error — ${errParam}` : `Connection failed: ${errParam.replace(/_/g, " ")}`)
      router.replace("/settings/connections", { scroll: false })
    }
  }, [searchParams, router])

  const hasBuffer = accounts.some(a => a.buffer_profile_id)
  const connectedPlatforms = new Set(accounts.map(a => a.platform))

  // For direct connections: a platform is directly connected if it has
  // platform_access_token (not just buffer_profile_id).
  // We approximate this by checking for accounts without buffer_profile_id,
  // OR accounts that we know have a direct token (platform_access_token not null
  // — but that column isn't fetched for display; we track it via separate row logic).
  const directlyConnected = new Set(
    accounts.filter(a => !a.buffer_profile_id).map(a => a.platform)
  )

  async function handleDisconnect(account: SocialAccount) {
    const label = PLATFORM_META[account.platform]?.label ?? account.platform
    const isDirectOnly = !account.buffer_profile_id
    const msg = isDirectOnly
      ? `Disconnect ${label} direct access? Analytics will stop.`
      : `Disconnect ${label}? This will remove it from your Buffer scheduling queue.`
    if (!confirm(msg)) return

    setDisconnecting(account.id)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/settings/social/${account.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "Failed to disconnect")
      }
      setAccounts(prev => prev.filter(a => a.id !== account.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect")
    } finally {
      setDisconnecting(null)
    }
  }

  async function handleRefresh() {
    setError(null)
    setSuccess(null)
    try {
      const res  = await fetch("/api/settings/social")
      const data = await res.json()
      if (data.connections) setAccounts(data.connections)
    } catch {
      setError("Failed to refresh connections")
    }
  }

  function handleConnectDirect(platform: string) {
    setConnecting(platform)
    // Hard navigation — this redirects to Meta OAuth, then returns here via callback
    window.location.href = `/api/auth/${platform}`
  }

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Buffer connection section */}
      <div className="rounded-xl border p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium flex items-center gap-2">
              <PlatformBadge platform="buffer" variant="icon" />
              Buffer
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Buffer connects all your social platforms in one place. Connect Buffer first,
              then your channels appear automatically.
            </p>
          </div>
          {hasBuffer ? (
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          ) : (
            <Button
              size="sm"
              asChild
              className="bg-[var(--pf-color-brand-primary)] hover:bg-[#0B9090] text-white shrink-0"
            >
              <a href="/settings">Connect Buffer →</a>
            </Button>
          )}
        </div>

        {hasBuffer && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Channels via Buffer
            </p>
            {accounts.filter(a => a.buffer_profile_id).map(account => (
              <AccountRow
                key={account.id}
                account={account}
                onDisconnect={handleDisconnect}
                disconnecting={disconnecting === account.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Direct platform connections (for analytics) */}
      <div className="rounded-xl border p-5 space-y-4">
        <div>
          <p className="font-medium">Direct connections</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Connect directly for analytics and performance insights.
            Scheduling still goes through Buffer.
          </p>
        </div>

        <div className="space-y-2">
          {BUFFER_CONNECTED_PLATFORMS.map(platform => {
            const isDirect    = directlyConnected.has(platform)
            const directAcct  = accounts.find(a => a.platform === platform && !a.buffer_profile_id)
            const isSupported = DIRECT_CONNECT_SUPPORTED.has(platform)
            const isConnecting = connecting === platform

            return (
              <div
                key={platform}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <PlatformBadge platform={platform} connected={isDirect} />

                {isDirect && directAcct ? (
                  // Connected directly
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-32">
                      @{directAcct.account_handle ?? "connected"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(directAcct)}
                      disabled={disconnecting === directAcct.id}
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors disabled:opacity-50"
                      title="Disconnect"
                    >
                      {disconnecting === directAcct.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Unlink className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                ) : isSupported ? (
                  // Not connected but supported — show Connect button
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 text-xs px-3"
                    onClick={() => handleConnectDirect(platform)}
                    disabled={isConnecting}
                  >
                    {isConnecting
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Connecting…</>
                      : <><Link2 className="h-3 w-3 mr-1" />Connect</>

                    }
                  </Button>
                ) : (
                  // Not yet supported
                  <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto italic">
                    Coming soon
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Refresh */}
      <button
        type="button"
        onClick={handleRefresh}
        className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh connections
      </button>

      {/* Unused brandId — satisfies prop contract for future use */}
      <input type="hidden" value={brandId ?? ""} aria-hidden />
    </div>
  )
}

// ── Exported wrapper with Suspense (required by useSearchParams) ─────────────

export function ConnectionsClient(props: Props) {
  return (
    <Suspense fallback={<div className="h-48 flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading connections…</div>}>
      <ConnectionsInner {...props} />
    </Suspense>
  )
}

// ── AccountRow ────────────────────────────────────────────────────────────────

function AccountRow({
  account,
  onDisconnect,
  disconnecting,
}: {
  account:       SocialAccount
  onDisconnect:  (a: SocialAccount) => void
  disconnecting: boolean
}) {
  const isExpired = account.token_expires_at
    ? new Date(account.token_expires_at) < new Date()
    : false

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
      isExpired && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/10"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <PlatformBadge platform={account.platform} variant="icon" connected={!isExpired} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {account.account_handle ?? account.platform}
          </p>
          {isExpired && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Token expired — reconnect</p>
          )}
          {!isExpired && account.account_url && (
            <a
              href={account.account_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[hsl(var(--muted-foreground))] hover:underline flex items-center gap-0.5"
            >
              View profile <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDisconnect(account)}
        disabled={disconnecting}
        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors disabled:opacity-50 shrink-0"
        title="Disconnect"
      >
        {disconnecting
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Unlink className="h-4 w-4" />
        }
      </button>
    </div>
  )
}
