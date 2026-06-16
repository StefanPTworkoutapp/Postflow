"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter }                    from "next/navigation"
import {
  Loader2, Unlink, ExternalLink, CheckCircle2,
  AlertCircle, RefreshCw, Link2, ChevronDown, ChevronUp,
  Eye, EyeOff,
} from "lucide-react"
import { Button }        from "@/components/ui/button"
import { PlatformBadge, PLATFORM_META } from "@/components/shared/PlatformBadge"
import { cn }            from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

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
  /** OAuth callback params forwarded from the Server Component page */
  oauthConnected?: string | null
  oauthError?:     string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** All platforms the wizard guides through (in order) */
const WIZARD_STEPS: Array<{
  key:         string
  description: string
  time:        string
  isBuffer?:   boolean
}> = [
  {
    key:         "buffer",
    description: "Schedule posts automatically",
    time:        "~30 sec",
    isBuffer:    true,
  },
  {
    key:         "instagram",
    description: "Publish and pull analytics",
    time:        "~30 sec",
  },
  {
    key:         "facebook",
    description: "Post to your Facebook Page",
    time:        "~30 sec",
  },
  {
    key:         "linkedin",
    description: "Reach your professional network",
    time:        "~30 sec",
  },
  {
    key:         "tiktok",
    description: "Connect for analytics — publishing coming soon",
    time:        "~30 sec",
  },
]

/** Platforms supported for direct OAuth */
const DIRECT_CONNECT_SUPPORTED = new Set(["instagram", "tiktok", "linkedin", "facebook"])

/**
 * Platforms connected via OAuth but with publishing temporarily disabled
 * (awaiting app approval). They appear as "Analytics only" in the UI.
 */
const PUBLISHING_PENDING_PLATFORMS = new Set(["tiktok"])

/** All platforms shown in connected state grid */
const ALL_PLATFORMS = ["instagram", "linkedin", "facebook", "tiktok", "x", "threads"]

// ── Help content per platform ─────────────────────────────────────────────────

const HELP_CONTENT: Record<string, React.ReactNode> = {
  buffer: (
    <ol className="list-decimal list-inside space-y-1.5">
      <li>Visit <a href="https://buffer.com/app/account/api" target="_blank" rel="noreferrer" className="text-[var(--pf-teal)] hover:underline">buffer.com/app/account/api ↗</a></li>
      <li>Copy your <strong>Access Token</strong></li>
      <li>Paste it in the field below and click Connect Buffer</li>
    </ol>
  ),
  instagram: (
    <>
      <p className="mb-2 text-[hsl(var(--muted-foreground))]">
        <strong>Before clicking Connect:</strong> make sure you&rsquo;re already logged in to Facebook as your business account in this browser. Instagram connects through Facebook Business. You&rsquo;ll need: a Facebook account
        + Instagram set to <strong>Professional</strong> (Creator or Business).
      </p>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Click Connect Instagram above</li>
        <li>Log in with Facebook</li>
        <li>Select your Instagram account</li>
        <li>Approve the permissions</li>
      </ol>
      <div className="flex gap-4 mt-3">
        <a
          href="https://help.instagram.com/502981923235522"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--pf-color-brand-primary)] hover:underline text-xs"
        >
          Not set to Professional? →
        </a>
        <a href="#video-instagram" className="text-[var(--pf-color-brand-primary)] hover:underline text-xs">
          Watch walkthrough →
        </a>
      </div>
    </>
  ),
  facebook: (
    <>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Click Connect below</li>
        <li>Log in to Facebook</li>
        <li>Select the Facebook Page you want to post to</li>
        <li>Approve the permissions</li>
      </ol>
      <div className="mt-3">
        <a href="#video-facebook" className="text-[var(--pf-color-brand-primary)] hover:underline text-xs">
          Watch walkthrough →
        </a>
      </div>
    </>
  ),
  linkedin: (
    <>
      <p className="mb-2 text-[hsl(var(--muted-foreground))]">
        PostFlow can post to your personal profile or a Company Page.
      </p>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Click Connect below</li>
        <li>Log in to LinkedIn</li>
        <li>Choose: Personal profile or Company Page</li>
        <li>Approve access</li>
      </ol>
      <div className="mt-3">
        <a href="#video-linkedin" className="text-[var(--pf-color-brand-primary)] hover:underline text-xs">
          Watch walkthrough →
        </a>
      </div>
    </>
  ),
}

// ── URL parser ────────────────────────────────────────────────────────────────

interface ParsedUrl {
  platform: string
  handle:   string
}

function parseProfileUrl(raw: string): ParsedUrl | null {
  try {
    const url      = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`)
    const hostname = url.hostname.replace(/^www\./, "")
    const parts    = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/")

    if (hostname === "instagram.com" && parts[0]) {
      return { platform: "instagram", handle: parts[0] }
    }
    if (hostname === "facebook.com" && parts[0] && parts[0] !== "pages") {
      return { platform: "facebook", handle: parts[0] }
    }
    if (hostname === "facebook.com" && parts[0] === "pages" && parts[1]) {
      return { platform: "facebook", handle: parts[1] }
    }
    if (hostname === "linkedin.com") {
      if (parts[0] === "in" && parts[1]) return { platform: "linkedin", handle: parts[1] }
      if (parts[0] === "company" && parts[1]) return { platform: "linkedin", handle: parts[1] }
    }
  } catch {
    // invalid URL
  }
  return null
}

// ── Token health helpers ──────────────────────────────────────────────────────

function tokenStatus(account: SocialAccount): "ok" | "expiring" | "expired" {
  if (!account.token_expires_at) return "ok"
  const exp  = new Date(account.token_expires_at)
  const now  = new Date()
  const diff = exp.getTime() - now.getTime()
  if (diff <= 0) return "expired"
  if (diff < 7 * 24 * 60 * 60 * 1000) return "expiring"
  return "ok"
}

function formatExpiry(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h    = Math.floor(diff / 3_600_000)
  if (h < 1)  return "just now"
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? "" : "s"} ago`
}

// ── WizardStep ────────────────────────────────────────────────────────────────

interface WizardStepProps {
  stepNumber:       number
  platform:         string
  description:      string
  timeEstimate:     string
  isBuffer?:        boolean
  isConnected:      boolean
  isConnecting:     boolean
  isHighlighted:    boolean
  onConnect:        () => void
}

function WizardStep({
  stepNumber,
  platform,
  description,
  timeEstimate,
  isConnected,
  isConnecting,
  isHighlighted,
  onConnect,
}: WizardStepProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpContent = HELP_CONTENT[platform]

  return (
    <div className={cn(
      "border-b last:border-0 transition-colors",
      isHighlighted && !isConnected && "bg-[hsl(var(--muted))/0.3]"
    )}>
      <div className="flex items-center gap-4 py-3.5 px-1">
        {/* Step indicator */}
        <div className="shrink-0 w-6 h-6 flex items-center justify-center">
          {isConnected ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <span className="h-5 w-5 rounded-full border-2 border-[hsl(var(--border))] flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
              {stepNumber}
            </span>
          )}
        </div>

        {/* Platform icon */}
        <PlatformBadge platform={platform} variant="icon" connected={isConnected} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-semibold leading-tight",
            isConnected && "text-green-600 dark:text-green-400"
          )}>
            {PLATFORM_META[platform]?.label ?? platform}
            {isConnected && (
              <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">Connected</span>
            )}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>
        </div>

        {/* Time chip */}
        <span className="hidden sm:inline-flex shrink-0 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded-full px-2 py-0.5">
          {timeEstimate}
        </span>

        {/* Help toggle */}
        {helpContent && !isConnected && (
          <button
            type="button"
            onClick={() => setHelpOpen(v => !v)}
            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
            title={helpOpen ? "Hide help" : "How to connect"}
            aria-expanded={helpOpen}
          >
            {helpOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}

        {/* Connect button */}
        {!isConnected && (
          <Button
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
            className="shrink-0 bg-[var(--pf-color-brand-primary)] hover:bg-[#0B9090] text-white h-8 px-3 text-xs"
          >
            {isConnecting ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" />Connecting…</>
            ) : (
              <>Connect →</>
            )}
          </Button>
        )}
      </div>

      {/* Collapsible help */}
      {helpContent && helpOpen && !isConnected && (
        <div className="mx-1 mb-3 bg-[hsl(var(--muted)/0.5)] rounded-lg p-4 text-sm">
          {helpContent}
        </div>
      )}
    </div>
  )
}

// ── ConnectedGrid ─────────────────────────────────────────────────────────────

interface ConnectedGridProps {
  accounts:      SocialAccount[]
  onDisconnect:  (a: SocialAccount) => void
  onReconnect:   (platform: string) => void
  disconnecting: string | null
  connecting:    string | null
}

function ConnectedGrid({ accounts, onDisconnect, onReconnect, disconnecting, connecting }: ConnectedGridProps) {
  const accountMap = new Map(accounts.map(a => [a.platform, a]))

  return (
    <div className="rounded-xl border p-5 space-y-1">
      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
        Connected platforms
      </p>
      {ALL_PLATFORMS.map(platform => {
        const acct      = accountMap.get(platform)
        const status    = acct ? tokenStatus(acct) : null
        const isConn    = !!acct
        const isExpired = status === "expired"
        const isExpiring = status === "expiring"
        const isReconn  = connecting === platform
        const isDisconn = disconnecting === acct?.id

        return (
          <div
            key={platform}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5",
              isExpired  && "border-red-200   bg-red-50/40   dark:border-red-800   dark:bg-red-950/10",
              isExpiring && "border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/10",
            )}
          >
            <PlatformBadge platform={platform} variant="icon" connected={isConn && !isExpired} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {PLATFORM_META[platform]?.label ?? platform}
              </p>
              {isConn && acct ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {acct.account_handle && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">@{acct.account_handle}</span>
                  )}
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Last synced {timeAgo(acct.created_at)}
                  </span>
                  {PUBLISHING_PENDING_PLATFORMS.has(platform) && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Analytics only · Publishing pending TikTok approval
                    </span>
                  )}
                  {isExpired && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Token expired — reconnect now
                    </span>
                  )}
                  {isExpiring && acct.token_expires_at && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Reconnect before {formatExpiry(acct.token_expires_at)} to avoid interruptions
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Not connected</p>
              )}
            </div>

            {/* Actions */}
            {isConn && acct ? (
              <div className="flex items-center gap-2 shrink-0">
                {(isExpired || isExpiring) && (
                  <Button
                    size="sm"
                    onClick={() => onReconnect(platform)}
                    disabled={isReconn}
                    className={cn(
                      "h-7 px-2.5 text-xs",
                      isExpired
                        ? "bg-red-600   hover:bg-red-700   text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white"
                    )}
                  >
                    {isReconn ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reconnect"}
                  </Button>
                )}
                {acct.account_url && (
                  <a
                    href={acct.account_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
                    title="View profile"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onDisconnect(acct)}
                  disabled={isDisconn}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors disabled:opacity-50"
                  title="Disconnect"
                >
                  {isDisconn
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Unlink className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            ) : DIRECT_CONNECT_SUPPORTED.has(platform) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReconnect(platform)}
                disabled={isReconn}
                className="shrink-0 h-7 text-xs px-3"
              >
                {isReconn
                  ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Connecting…</>
                  : <><Link2 className="h-3 w-3 mr-1" />Connect</>
                }
              </Button>
            ) : (
              <span className="text-xs text-[hsl(var(--muted-foreground))] italic shrink-0">Coming soon</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── UrlConnector ──────────────────────────────────────────────────────────────

interface UrlConnectorProps {
  onConnectPlatform: (platform: string) => void
}

function UrlConnector({ onConnectPlatform }: UrlConnectorProps) {
  const [url,       setUrl]       = useState("")
  const [parsed,    setParsed]    = useState<ParsedUrl | null>(null)
  const [parseErr,  setParseErr]  = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleIdentify() {
    setSubmitted(true)
    const result = parseProfileUrl(url)
    if (result) {
      setParsed(result)
      setParseErr(false)
    } else {
      setParsed(null)
      setParseErr(true)
    }
  }

  function handleConnect() {
    if (parsed) onConnectPlatform(parsed.platform)
  }

  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
        <span className="text-xs text-[hsl(var(--muted-foreground))] px-2">or</span>
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
      </div>

      <div>
        <p className="font-medium text-sm flex items-center gap-1.5">
          🔗 Connect by pasting your profile URL
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          Paste your Instagram, LinkedIn, or Facebook page URL and PostFlow will identify your account.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={e => {
            setUrl(e.target.value)
            setSubmitted(false)
            setParsed(null)
            setParseErr(false)
          }}
          onKeyDown={e => { if (e.key === "Enter") handleIdentify() }}
          placeholder="https://www.instagram.com/yourhandle"
          className="flex-1 h-9 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[var(--pf-color-brand-primary)]"
        />
        <Button
          size="sm"
          onClick={handleIdentify}
          disabled={!url.trim()}
          className="bg-[var(--pf-color-brand-primary)] hover:bg-[#0B9090] text-white h-9 px-4 text-sm"
        >
          Identify →
        </Button>
      </div>

      {/* Feedback */}
      {submitted && parsed && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <span>
              Found <strong>{PLATFORM_META[parsed.platform]?.label ?? parsed.platform}</strong> account{" "}
              <span className="font-mono">@{parsed.handle}</span>. Connect it now:
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleConnect}
            className="shrink-0 bg-[var(--pf-color-brand-primary)] hover:bg-[#0B9090] text-white h-8 px-3 text-xs"
          >
            Connect →
          </Button>
        </div>
      )}

      {submitted && parseErr && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          We couldn&rsquo;t identify that URL. Try the buttons above.
        </div>
      )}
    </div>
  )
}

// ── ConnectionsInner (main logic) ─────────────────────────────────────────────
// No useSearchParams() here — params are forwarded from the Server Component as
// props so we never need a Suspense boundary, and the component renders instantly.

function ConnectionsInner({ initialAccounts, brandId, oauthConnected, oauthError }: Props) {
  const router        = useRouter()
  const [accounts,      setAccounts]      = useState<SocialAccount[]>(initialAccounts)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [success,       setSuccess]       = useState<string | null>(null)
  const [connecting,    setConnecting]    = useState<string | null>(null)

  // ── Handle OAuth callback params (passed from server page) ─────────────────
  useEffect(() => {
    if (oauthConnected) {
      const label = PLATFORM_META[oauthConnected]?.label ?? oauthConnected
      setSuccess(`${label} connected successfully`)
      router.replace("/settings/connections", { scroll: false })
      void fetch("/api/settings/social")
        .then(r => r.json())
        .then(d => { if (d.connections) setAccounts(d.connections) })
    } else if (oauthError) {
      const isFbError = oauthError.startsWith("fb_")
      setError(isFbError
        ? `Facebook error — ${oauthError}`
        : `Connection failed: ${oauthError.replace(/_/g, " ")}`
      )
      router.replace("/settings/connections", { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount — params are static snapshot from SSR

  const hasBuffer         = accounts.some(a => a.buffer_profile_id)
  const connectedPlatforms = new Set(accounts.map(a => a.platform))
  const hasAnyConnection   = hasBuffer || accounts.length > 0

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDisconnect(account: SocialAccount) {
    const label      = PLATFORM_META[account.platform]?.label ?? account.platform
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
        throw new Error((json as { error?: string }).error ?? "Failed to disconnect")
      }
      setAccounts(prev => prev.filter(a => a.id !== account.id))
      setSuccess(`${label} disconnected`)
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
      const data = await res.json() as { connections?: SocialAccount[] }
      if (data.connections) setAccounts(data.connections)
    } catch {
      setError("Failed to refresh connections")
    }
  }

  // Open OAuth in a small popup so the user never leaves this page.
  // The callback HTML sends a postMessage on success/error and closes itself.
  function handleConnect(platform: string) {
    if (platform === "buffer") {
      // Buffer uses PAT — scroll to buffer section / handled inline
      document.getElementById("buffer-token-section")?.scrollIntoView({ behavior: "smooth" })
      return
    }
    if (!DIRECT_CONNECT_SUPPORTED.has(platform)) return

    const width  = 560
    const height = 660
    const left   = Math.max(0, (window.screen.width  - width)  / 2)
    const top    = Math.max(0, (window.screen.height - height) / 2)
    const popup  = window.open(
      `/api/auth/${platform}`,
      `pf-oauth-${platform}`,
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    )

    if (!popup) {
      // Popup blocked — fall back to full navigation
      setConnecting(platform)
      window.location.href = `/api/auth/${platform}`
      return
    }

    setConnecting(platform)

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; platform?: string; handle?: string; error?: string }
      if (data?.type === "pf_oauth_success" && data.platform === platform) {
        window.removeEventListener("message", onMessage)
        clearInterval(closedCheck)
        popup?.close()
        setConnecting(null)
        setSuccess(`${PLATFORM_META[platform]?.label ?? platform} connected${data.handle ? ` as ${data.handle}` : ""}!`)
        void handleRefresh()
      } else if (data?.type === "pf_oauth_error" && data.platform === platform) {
        window.removeEventListener("message", onMessage)
        clearInterval(closedCheck)
        popup?.close()
        setConnecting(null)
        setError(`Failed to connect ${PLATFORM_META[platform]?.label ?? platform}: ${data.error ?? "unknown error"}`)
      }
    }

    // Fallback: detect if the user just closed the popup without completing OAuth
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedCheck)
        window.removeEventListener("message", onMessage)
        setConnecting(null)
      }
    }, 500)

    window.addEventListener("message", onMessage)
  }

  // ── Determine which step gets the subtle highlight (next unconnected) ──────

  function getHighlightedStep(): string | null {
    for (const step of WIZARD_STEPS) {
      const isConn = step.isBuffer
        ? hasBuffer
        : connectedPlatforms.has(step.key)
      if (!isConn) return step.key
    }
    return null
  }

  const highlightedStep = getHighlightedStep()

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Banners */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── STATE A: Nothing connected — show wizard ── */}
      {!hasAnyConnection && (
        <div className="rounded-xl border p-5 space-y-1">
          <div className="mb-4">
            <p className="font-semibold text-base">Set up your posting pipeline</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Takes about 3 minutes.</p>
          </div>

          {WIZARD_STEPS.map((step, i) => (
            <WizardStep
              key={step.key}
              stepNumber={i + 1}
              platform={step.key}
              description={step.description}
              timeEstimate={step.time}
              isBuffer={step.isBuffer}
              isConnected={step.isBuffer ? hasBuffer : connectedPlatforms.has(step.key)}
              isConnecting={connecting === step.key}
              isHighlighted={highlightedStep === step.key}
              onConnect={() => handleConnect(step.key)}
            />
          ))}

          <p className="pt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Skip any platform you don&rsquo;t use.
          </p>
        </div>
      )}

      {/* ── STATE B: At least one connection — show status grid + continue wizard ── */}
      {hasAnyConnection && (
        <>
          {/* Connected platforms grid */}
          <ConnectedGrid
            accounts={accounts}
            onDisconnect={handleDisconnect}
            onReconnect={handleConnect}
            disconnecting={disconnecting}
            connecting={connecting}
          />

          {/* Buffer inline PAT section */}
          <BufferTokenSection onConnected={handleRefresh} />

          {/* Wizard for any remaining unconnected wizard platforms */}
          {WIZARD_STEPS.some(s => s.isBuffer ? !hasBuffer : !connectedPlatforms.has(s.key)) && (
            <div className="rounded-xl border p-5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                Still to connect
              </p>
              {WIZARD_STEPS.filter(s => s.isBuffer ? !hasBuffer : !connectedPlatforms.has(s.key)).map((step, i) => (
                <WizardStep
                  key={step.key}
                  stepNumber={i + 1}
                  platform={step.key}
                  description={step.description}
                  timeEstimate={step.time}
                  isBuffer={step.isBuffer}
                  isConnected={false}
                  isConnecting={connecting === step.key}
                  isHighlighted={highlightedStep === step.key}
                  onConnect={() => handleConnect(step.key)}
                />
              ))}
              <p className="pt-2 text-xs text-[hsl(var(--muted-foreground))]">
                Skip any platform you don&rsquo;t use.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── URL connector (always shown) ── */}
      <UrlConnector onConnectPlatform={handleConnect} />

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

// ── BufferTokenSection ────────────────────────────────────────────────────────
// Inline Buffer PAT form — no redirect to /settings needed.

function BufferTokenSection({ onConnected }: { onConnected: () => void }) {
  const [token,   setToken]   = useState("")
  const [show,    setShow]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function save() {
    if (!token.trim()) return
    setSaving(true)
    setErr(null)
    try {
      const res  = await fetch("/api/settings/buffer", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ access_token: token.trim() }),
      })
      const data = await res.json() as { error?: string; channels?: unknown[] }
      if (!res.ok) {
        setErr(data.error ?? "Failed to save token")
      } else {
        setSuccess(true)
        setToken("")
        onConnected()
      }
    } catch {
      setErr("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id="buffer-token-section" className="rounded-xl border p-5 space-y-4">
      <div className="flex items-start gap-3">
        <PlatformBadge platform="buffer" variant="icon" connected={success} />
        <div>
          <p className="font-medium text-sm">Buffer</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Buffer schedules and publishes your posts. Connect it with your API token.
          </p>
        </div>
      </div>

      {success ? (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Buffer connected! Your social accounts are now synced.
        </div>
      ) : (
        <>
          {/* Step-by-step guide */}
          <div className="rounded-lg bg-[hsl(var(--muted))]/50 p-4 text-sm space-y-2">
            <p className="font-medium text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">How to get your token</p>
            <ol className="list-decimal list-inside space-y-1.5 text-[hsl(var(--muted-foreground))]">
              <li>
                Go to{" "}
                <a
                  href="https://buffer.com/app/account/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--pf-teal)] hover:underline font-medium"
                >
                  buffer.com/app/account/api ↗
                </a>
                {" "}(opens in a new tab)
              </li>
              <li>Make sure you&apos;re logged in to Buffer</li>
              <li>Scroll to <strong>Access Token</strong> and copy it</li>
              <li>Paste it below</li>
            </ol>
          </div>

          {/* Token input */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={token}
                onChange={e => { setToken(e.target.value); setErr(null) }}
                onKeyDown={e => { if (e.key === "Enter") void save() }}
                placeholder="Paste your Buffer access token here…"
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 pr-10 text-sm shadow-sm transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={show ? "Hide token" : "Show token"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {err && (
              <p className="text-xs text-[hsl(var(--destructive))] flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {err}
              </p>
            )}

            <Button
              onClick={() => void save()}
              disabled={!token.trim() || saving}
              className="w-full bg-[var(--pf-teal)] hover:bg-[#0B9090] text-white"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : "Connect Buffer"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Exported component ────────────────────────────────────────────────────────
// No Suspense needed — useSearchParams() is not used; params come from the server.

export function ConnectionsClient(props: Props) {
  return <ConnectionsInner {...props} />
}
