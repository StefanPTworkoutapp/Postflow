"use client"

import { useState } from "react"
import { Loader2, Unlink, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlatformBadge, PLATFORM_META } from "@/components/shared/PlatformBadge"
import { cn } from "@/lib/utils"

interface SocialAccount {
  id:                string
  platform:          string
  account_handle:    string | null
  account_url:       string | null
  buffer_profile_id: string | null
  is_active:         boolean
  token_expires_at:  string | null
  created_at:        string
}

interface Props {
  initialAccounts: SocialAccount[]
  brandId:         string | null
}

const BUFFER_CONNECTED_PLATFORMS = ["instagram", "linkedin", "facebook", "tiktok", "x", "threads"]

export function ConnectionsClient({ initialAccounts, brandId }: Props) {
  const [accounts,      setAccounts]      = useState<SocialAccount[]>(initialAccounts)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  const hasBuffer = accounts.some(a => a.buffer_profile_id)
  const connectedPlatforms = new Set(accounts.map(a => a.platform))

  async function handleDisconnect(account: SocialAccount) {
    if (!confirm(`Disconnect ${PLATFORM_META[account.platform]?.label ?? account.platform}? This will remove it from your Buffer scheduling queue.`)) return
    setDisconnecting(account.id)
    setError(null)
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
    try {
      const res  = await fetch("/api/settings/social")
      const data = await res.json()
      if (data.connections) setAccounts(data.connections)
    } catch {
      setError("Failed to refresh connections")
    }
  }

  return (
    <div className="space-y-6">
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

      {/* Direct platform connections */}
      <div className="rounded-xl border p-5 space-y-4">
        <div>
          <p className="font-medium">Direct connections</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Connect platforms directly for analytics and performance tracking.
            Scheduling still goes through Buffer.
          </p>
        </div>

        <div className="space-y-2">
          {BUFFER_CONNECTED_PLATFORMS.map(platform => {
            const connected = connectedPlatforms.has(platform)
            const account   = accounts.find(a => a.platform === platform && !a.buffer_profile_id)
            return (
              <div
                key={platform}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <PlatformBadge platform={platform} connected={connected} />
                {account ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-32">
                      @{account.account_handle ?? "connected"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(account)}
                      disabled={disconnecting === account.id}
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors disabled:opacity-50"
                      title="Disconnect"
                    >
                      {disconnecting === account.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Unlink className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto italic">
                    Coming soon
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Refresh */}
      <button
        type="button"
        onClick={handleRefresh}
        className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh connections
      </button>
    </div>
  )
}

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
            <p className="text-xs text-amber-600 dark:text-amber-400">Token expired — reconnect in Buffer</p>
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
