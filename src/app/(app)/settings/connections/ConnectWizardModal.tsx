"use client"

/**
 * ConnectWizardModal — the guided "connect all platforms" popup.
 *
 * A single linear step-by-step overlay that walks a pro through every
 * platform in order. One-click OAuth platforms (Instagram, Facebook,
 * LinkedIn, TikTok, Threads) get a short 3-step flow (explain → connect →
 * confirm). Buffer gets the full walkthrough broken into concrete sub-steps,
 * since it requires creating an account, copying a token, pasting it back
 * into PostFlow, and then connecting X (or any other Buffer-routed channel)
 * *inside Buffer itself* — each of those gets its own step with the exact
 * button to click.
 *
 * Progress (which platform + which sub-step) is persisted server-side per
 * brand+platform (postflow.connection_wizard_progress via
 * /api/settings/connection-wizard) so closing the overlay mid-flow and
 * reopening later — even from a different device — offers "Continue at
 * step N or start over?" instead of losing progress.
 *
 * Built as a plain overlay (fixed inset-0 + backdrop), matching this
 * project's existing modal pattern (UpgradeBrandModal) — there is no shadcn
 * Dialog primitive here to extend, and adding a parallel Dialog component
 * for a single consumer would violate the "no parallel primitive" rule more
 * than reusing the established overlay shape does.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2, X, ExternalLink, ArrowRight, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlatformBadge, PLATFORM_META } from "@/components/shared/PlatformBadge"
import type { SocialAccount } from "./ConnectionsClient"

// ── Flow definition ───────────────────────────────────────────────────────────

const PLATFORM_ORDER = ["buffer", "instagram", "facebook", "linkedin", "tiktok", "threads"] as const
type WizardPlatform = typeof PLATFORM_ORDER[number]

/** Number of sub-steps in each platform's own micro-flow. */
const STEP_COUNTS: Record<WizardPlatform, number> = {
  buffer:    5,
  instagram: 3,
  facebook:  3,
  linkedin:  3,
  tiktok:    3,
  threads:   3,
}

const TOTAL_STEPS = Object.values(STEP_COUNTS).reduce((a, b) => a + b, 0)

/** Short "what you need" blurb for the explain step of each direct-OAuth platform. */
const EXPLAIN_TEXT: Record<string, string> = {
  instagram: "You'll need a Facebook account with your Instagram set to Professional (Creator or Business). PostFlow connects through Facebook Business.",
  facebook:  "You'll need admin access to the Facebook Page you want PostFlow to post to.",
  linkedin:  "You'll need a LinkedIn account — personal profile or a Company Page you manage.",
  tiktok:    "You'll need a TikTok account. Analytics sync now; direct publishing rolls out once TikTok approves it.",
  threads:   "You'll need a Threads account (this uses the same login as Instagram).",
}

interface WizardProgressRow {
  platform:     string
  current_step: number
  completed:    boolean
}

interface Props {
  open:                boolean
  onClose:             () => void
  brandId:             string | null
  accounts:            SocialAccount[]
  /** Opens the OAuth popup for a direct-connect platform — reuses the parent's existing flow. */
  onConnectPlatform:   (platform: string) => void
  /** Re-fetches social_accounts from the server (parent's handleRefresh). */
  onRefresh:           () => Promise<void>
  /** Platform currently mid-OAuth-popup in the parent (for spinner state), or null. */
  connectingPlatform:  string | null
}

export function ConnectWizardModal({
  open,
  onClose,
  accounts,
  onConnectPlatform,
  onRefresh,
  connectingPlatform,
}: Props) {
  const router = useRouter()

  const [platform,  setPlatform]  = useState<WizardPlatform>("buffer")
  const [subStep,   setSubStep]   = useState(0)
  const [resumePrompt, setResumePrompt] = useState<{ platform: WizardPlatform; step: number } | null>(null)
  const [initialised, setInitialised] = useState(false)

  // Buffer inline sub-flow state
  const [bufferToken,  setBufferToken]  = useState("")
  const [showToken,    setShowToken]    = useState(false)
  const [bufferSaving, setBufferSaving] = useState(false)
  const [bufferError,  setBufferError]  = useState<string | null>(null)
  const [checkingConnection, setCheckingConnection] = useState(false)

  const connectedPlatforms = new Set(accounts.map(a => a.platform))
  const hasBuffer = accounts.some(a => a.buffer_profile_id)

  function isConnected(p: WizardPlatform): boolean {
    return p === "buffer" ? hasBuffer : connectedPlatforms.has(p)
  }

  function firstUnconnectedPlatform(): WizardPlatform | null {
    return PLATFORM_ORDER.find(p => !isConnected(p)) ?? null
  }

  // ── Load saved progress + resolve starting point when the modal opens ──────
  useEffect(() => {
    if (!open) { setInitialised(false); return }

    let cancelled = false
    ;(async () => {
      let progressMap: Record<string, WizardProgressRow> = {}
      try {
        const res  = await fetch("/api/settings/connection-wizard")
        const data = await res.json() as { progress?: WizardProgressRow[] }
        progressMap = Object.fromEntries((data.progress ?? []).map(r => [r.platform, r]))
      } catch {
        // No saved progress available — start fresh
      }
      if (cancelled) return

      const start = firstUnconnectedPlatform()
      if (!start) { setInitialised(true); return } // everything already connected

      // `start` is the first NOT-yet-connected platform, so any saved step > 0
      // means the user was genuinely mid-flow here and we should offer to
      // resume. Deliberately NOT gated on `saved.completed`: that flag is a
      // sticky artifact of a prior Skip/finish and would wrongly suppress the
      // resume prompt on a later real close-and-reopen. Skip now resets
      // current_step to 0 (see skipPlatform), so step > 0 reliably means
      // in-progress, not skipped.
      const saved = progressMap[start]
      if (saved && saved.current_step > 0) {
        setResumePrompt({ platform: start, step: saved.current_step })
      } else {
        setPlatform(start)
        setSubStep(0)
      }
      setInitialised(true)
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Persist progress whenever the step changes ──────────────────────────────
  useEffect(() => {
    if (!open || !initialised || resumePrompt) return
    void fetch("/api/settings/connection-wizard", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ platform, current_step: subStep }),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, subStep, open, initialised])

  // ── Auto-advance from "connect" → "confirm" once the OAuth popup reports success ──
  useEffect(() => {
    if (!initialised || resumePrompt) return
    if (platform === "buffer") return
    if (subStep === 1 && isConnected(platform)) {
      setSubStep(2)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, platform, subStep, initialised, resumePrompt])

  if (!open) return null

  function advanceAfter(
    fromPlatform: WizardPlatform,
    opts: { completed: boolean; resetStep: boolean },
  ) {
    void fetch("/api/settings/connection-wizard", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        platform:     fromPlatform,
        current_step: opts.resetStep ? 0 : STEP_COUNTS[fromPlatform] - 1,
        completed:    opts.completed,
      }),
    })
    const idx  = PLATFORM_ORDER.indexOf(fromPlatform)
    const next = PLATFORM_ORDER.slice(idx + 1).find(p => !isConnected(p))
    if (next) {
      setPlatform(next)
      setSubStep(0)
    } else {
      onClose()
    }
  }

  // Genuine completion (platform connected): mark completed.
  function goToNextPlatform(fromPlatform: WizardPlatform) {
    advanceAfter(fromPlatform, { completed: true, resetStep: false })
  }

  // Skip = "not now": reset saved step to 0 so it doesn't leave a phantom
  // mid-flow position that would trigger a false resume prompt next time, and
  // don't mark completed (the platform is still unconnected and should reopen
  // cleanly at step 1, not be treated as done).
  function skipPlatform(fromPlatform: WizardPlatform) {
    advanceAfter(fromPlatform, { completed: false, resetStep: true })
  }

  async function handleCheckConnection() {
    setCheckingConnection(true)
    try {
      await onRefresh()
      router.refresh()
    } finally {
      setCheckingConnection(false)
    }
  }

  async function handleBufferTokenSave() {
    if (!bufferToken.trim()) return
    setBufferSaving(true)
    setBufferError(null)
    try {
      const res  = await fetch("/api/settings/buffer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ access_token: bufferToken.trim() }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setBufferError(data.error ?? "Failed to save token")
        return
      }
      await onRefresh()
      setSubStep(3)
    } catch {
      setBufferError("Network error — please try again")
    } finally {
      setBufferSaving(false)
    }
  }

  /** Re-syncs Buffer channels using the already-saved token — picks up any
   *  channel (e.g. X) the pro just connected inside Buffer's own UI. */
  async function handleCheckBufferChannels() {
    setCheckingConnection(true)
    setBufferError(null)
    try {
      if (bufferToken.trim()) {
        const res  = await fetch("/api/settings/buffer", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ access_token: bufferToken.trim() }),
        })
        const data = await res.json() as { error?: string }
        if (!res.ok) setBufferError(data.error ?? "Could not check Buffer channels yet")
      }
      await onRefresh()
      if (hasBuffer) setSubStep(4)
    } finally {
      setCheckingConnection(false)
    }
  }

  // Global position for the "Step X of Y" counter + progress bar
  const completedBefore = PLATFORM_ORDER
    .slice(0, PLATFORM_ORDER.indexOf(platform))
    .reduce((sum, p) => sum + STEP_COUNTS[p], 0)
  const globalStep = completedBefore + subStep + 1
  const progressPct = Math.round((globalStep / TOTAL_STEPS) * 100)

  const platformLabel = PLATFORM_META[platform]?.label ?? platform
  const allConnected = !firstUnconnectedPlatform()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-wizard-title"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center justify-between">
            <h2 id="connect-wizard-title" className="text-base font-semibold tracking-tight">
              Connect your platforms
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!allConnected && !resumePrompt && (
            <>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Step {globalStep} of {TOTAL_STEPS}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <div
                  className="h-full bg-[var(--pf-color-brand-primary)] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5 overflow-y-auto space-y-4">
          {/* All done */}
          {allConnected && (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400 mx-auto" />
              <p className="font-semibold text-sm">Every platform is connected 🎉</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">You&apos;re ready to schedule posts.</p>
              <Button onClick={onClose} className="mt-2">Done</Button>
            </div>
          )}

          {/* Resume prompt */}
          {!allConnected && resumePrompt && (
            <div className="space-y-4 text-center py-4">
              <p className="text-sm">
                You were partway through connecting <strong>{PLATFORM_META[resumePrompt.platform]?.label ?? resumePrompt.platform}</strong>{" "}
                (step {resumePrompt.step + 1}).
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setPlatform(resumePrompt.platform); setSubStep(0); setResumePrompt(null) }}
                >
                  Start over
                </Button>
                <Button
                  onClick={() => { setPlatform(resumePrompt.platform); setSubStep(resumePrompt.step); setResumePrompt(null) }}
                  className="bg-[var(--pf-color-brand-primary)] hover:bg-[#0B9090] text-white"
                >
                  Continue at step {resumePrompt.step + 1}
                </Button>
              </div>
            </div>
          )}

          {/* Active flow */}
          {!allConnected && !resumePrompt && initialised && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <PlatformBadge platform={platform} variant="icon" connected={isConnected(platform)} />
                <p className="font-semibold text-sm">{platformLabel}</p>
              </div>

              {platform === "buffer" ? (
                <BufferSubStep
                  subStep={subStep}
                  bufferToken={bufferToken}
                  setBufferToken={setBufferToken}
                  showToken={showToken}
                  setShowToken={setShowToken}
                  saving={bufferSaving}
                  error={bufferError}
                  checking={checkingConnection}
                  hasBuffer={hasBuffer}
                  onContinueExplain={() => setSubStep(s => s + 1)}
                  onSaveToken={() => void handleBufferTokenSave()}
                  onCheckChannels={() => void handleCheckBufferChannels()}
                  onFinish={() => goToNextPlatform("buffer")}
                />
              ) : (
                <DirectPlatformSubStep
                  platform={platform}
                  subStep={subStep}
                  connecting={connectingPlatform === platform}
                  checking={checkingConnection}
                  isConnected={isConnected(platform)}
                  onNext={() => setSubStep(s => s + 1)}
                  onConnect={() => onConnectPlatform(platform)}
                  onCheck={() => void handleCheckConnection()}
                  onFinish={() => goToNextPlatform(platform)}
                />
              )}

              <button
                type="button"
                onClick={() => skipPlatform(platform)}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
              >
                Skip {platformLabel} →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-step renderers ────────────────────────────────────────────────────────

interface DirectProps {
  platform:     string
  subStep:      number
  connecting:   boolean
  checking:     boolean
  isConnected:  boolean
  onNext:       () => void
  onConnect:    () => void
  onCheck:      () => void
  onFinish:     () => void
}

function DirectPlatformSubStep({ platform, subStep, connecting, checking, isConnected, onNext, onConnect, onCheck, onFinish }: DirectProps) {
  const label = PLATFORM_META[platform]?.label ?? platform

  if (subStep === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {EXPLAIN_TEXT[platform] ?? `You'll need a ${label} account.`}
        </p>
        <ExplainContinue onContinue={onNext} />
      </div>
    )
  }

  if (subStep === 1) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Click Connect below and follow {label}&apos;s login + permission prompts. A popup window will open.
        </p>
        <Button
          onClick={onConnect}
          disabled={connecting}
          className="w-full bg-[var(--pf-color-brand-primary)] hover:bg-[#0B9090] text-white"
        >
          {connecting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : `Connect ${label} →`}
        </Button>
      </div>
    )
  }

  // subStep === 2 — confirm
  return (
    <div className="space-y-3">
      {isConnected ? (
        <>
          <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {label} connected!
          </p>
          <Button onClick={onFinish} className="w-full">
            Continue <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Not connected yet. If you just approved the popup, check again below.
          </p>
          <Button variant="outline" onClick={onCheck} disabled={checking} className="w-full">
            {checking ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking…</> : "Check connection"}
          </Button>
        </>
      )}
    </div>
  )
}

function ExplainContinue({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex justify-end">
      <Button onClick={onContinue}>
        Continue <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  )
}

interface BufferProps {
  subStep:          number
  bufferToken:      string
  setBufferToken:   (v: string) => void
  showToken:        boolean
  setShowToken:     (v: boolean) => void
  saving:           boolean
  error:            string | null
  checking:         boolean
  hasBuffer:        boolean
  onContinueExplain: () => void
  onSaveToken:      () => void
  onCheckChannels:  () => void
  onFinish:         () => void
}

function BufferSubStep({
  subStep, bufferToken, setBufferToken, showToken, setShowToken,
  saving, error, checking, hasBuffer,
  onContinueExplain, onSaveToken, onCheckChannels, onFinish,
}: BufferProps) {
  // Step 0: create/log in to Buffer
  if (subStep === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Buffer schedules and publishes your posts (including X). You&apos;ll need a free Buffer account.
        </p>
        <a
          href="https://buffer.com/signup"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-[var(--pf-teal)] hover:underline"
        >
          Open buffer.com to sign up / log in <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <div className="flex justify-end">
          <Button onClick={onContinueExplain}>
            I&apos;ve done this <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 1: get access token
  if (subStep === 1) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Get your Buffer access token so PostFlow can talk to your Buffer account.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
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
          </li>
          <li>Scroll to <strong>Access Token</strong> and click Copy</li>
        </ol>
        <div className="flex justify-end">
          <Button onClick={onContinueExplain}>
            I&apos;ve copied it <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 2: paste token
  if (subStep === 2) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Paste the token you just copied.</p>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={bufferToken}
            onChange={e => setBufferToken(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSaveToken() }}
            placeholder="Paste your Buffer access token…"
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-foreground"
            tabIndex={-1}
            aria-label={showToken ? "Hide token" : "Show token"}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
        <Button
          onClick={onSaveToken}
          disabled={!bufferToken.trim() || saving}
          className="w-full bg-[var(--pf-teal)] hover:bg-[#0B9090] text-white"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : "Connect Buffer"}
        </Button>
      </div>
    )
  }

  // Step 3: connect X (and any other Buffer-routed channel) inside Buffer
  if (subStep === 3) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Buffer is linked to PostFlow. Now connect X (and any other channel you post through Buffer) — this happens inside Buffer itself.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
          <li>
            Open{" "}
            <a href="https://buffer.com/app" target="_blank" rel="noreferrer" className="text-[var(--pf-teal)] hover:underline font-medium">
              buffer.com/app ↗
            </a>
          </li>
          <li>Click <strong>Connect a channel</strong></li>
          <li>Choose <strong>X</strong> (or the other platform you want), log in, and approve</li>
        </ol>
        {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
        <Button variant="outline" onClick={onCheckChannels} disabled={checking} className="w-full">
          {checking ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking…</> : "I&apos;ve connected it — check now"}
        </Button>
      </div>
    )
  }

  // Step 4: confirm
  return (
    <div className="space-y-3">
      {hasBuffer ? (
        <>
          <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Buffer connected!
          </p>
          <Button onClick={onFinish} className="w-full">
            Continue <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Buffer isn&apos;t showing as connected yet — go back and make sure the token was saved and at least one channel is connected in Buffer.
          </p>
          <Button variant="outline" onClick={onCheckChannels} disabled={checking} className="w-full">
            {checking ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking…</> : "Check again"}
          </Button>
        </>
      )}
    </div>
  )
}
