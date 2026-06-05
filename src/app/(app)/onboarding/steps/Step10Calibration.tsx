"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, AlertCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { GOALS } from "@/lib/shared/onboarding/types"
import { StepShell } from "./StepShell"
import type { CalibrationPost } from "@/app/api/onboarding/calibrate/route"
import type { PostReview } from "@/app/api/onboarding/calibrate/confirm/route"

// ── Types ────────────────────────────────────────────────────────────────────

type AdjustmentOption = "tone" | "length" | "style" | "hook"

interface PostState {
  post:            CalibrationPost
  approved:        boolean | null       // null = not yet reviewed
  adjustment?:     AdjustmentOption
  refineCount:     number               // max 2 refinements
  refining:        boolean
}

interface Props {
  draft: OnboardingDraft
  brandId: string | null
  back: () => void
  onComplete: () => Promise<void>
}

const ADJUSTMENT_OPTIONS: { value: AdjustmentOption; label: string }[] = [
  { value: "tone",   label: "Tone is off" },
  { value: "length", label: "Too long / short" },
  { value: "style",  label: "Wrong style" },
  { value: "hook",   label: "Hook needs work" },
]

const POST_TYPE_COLORS: Record<string, string> = {
  A: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  B: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800",
  C: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
}

const POST_LABEL_COLORS: Record<string, string> = {
  A: "text-blue-600 dark:text-blue-400",
  B: "text-purple-600 dark:text-purple-400",
  C: "text-amber-600 dark:text-amber-400",
}

// ── Completion Screen ────────────────────────────────────────────────────────

interface CompletionScreenProps {
  draft: OnboardingDraft
  onComplete: () => Promise<void>
}

function CompletionScreen({ draft, onComplete }: CompletionScreenProps) {
  const primaryGoal  = GOALS.find(g => g.value === (draft.goals?.[0] ?? ""))
  const brandName    = draft.name ?? "Your brand"
  const hasRedirected = useRef(false)

  // Auto-redirect after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasRedirected.current) {
        hasRedirected.current = true
        onComplete().catch(console.error)
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [onComplete])

  function handleCTA(path: string) {
    if (hasRedirected.current) return
    hasRedirected.current = true
    // Navigate to the target path after completing
    onComplete()
      .then(() => { window.location.href = path })
      .catch(console.error)
  }

  // Brand initials avatar
  const initials = brandName
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex flex-col items-center text-center space-y-8 py-8">
      {/* Brand avatar */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--pf-teal)]/15 border-2 border-[var(--pf-teal)]/30 text-2xl font-bold text-[var(--pf-teal)]">
        {initials}
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <div className="text-4xl">🎉</div>
        <h2 className="text-2xl font-semibold tracking-tight">You&apos;re ready to post.</h2>
        <p className="text-[hsl(var(--muted-foreground))]">
          <strong className="text-[hsl(var(--foreground))]">{brandName}</strong> is all set.
          {primaryGoal && (
            <> Primary goal: <span className="font-medium text-[var(--pf-teal)]">{primaryGoal.label}</span>.</>
          )}
        </p>
      </div>

      {/* Next steps */}
      <div className="w-full space-y-3">
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          Your next steps
        </p>

        {/* Primary CTA */}
        <Button
          className="w-full h-12 text-base bg-[var(--pf-teal)] hover:bg-[var(--pf-teal)]/90 text-white"
          onClick={() => handleCTA("/create")}
        >
          🎬 Create your first post →
        </Button>

        {/* Secondary CTAs */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => handleCTA("/settings/connections")}
          >
            🔗 Connect platforms
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => handleCTA("/schedule")}
          >
            📅 View schedule
          </Button>
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Redirecting to dashboard in a moment…
      </p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function Step10Calibration({ draft, brandId, back, onComplete }: Props) {
  const [postStates, setPostStates]   = useState<PostState[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [completing, setCompleting]   = useState(false)
  const [showNeedsAdjust, setShowNeedsAdjust] = useState<string | null>(null) // post id
  const [calibrationDone, setCalibrationDone] = useState(false)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadCalibrationPosts()
  }, [])

  async function loadCalibrationPosts() {
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch("/api/onboarding/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass brandId so the route doesn't have to rediscover it — avoids
        // "Brand not found" if getBrand() loses context between requests.
        body: JSON.stringify({ brand_id: brandId }),
      })
      const json = await res.json() as { posts?: CalibrationPost[]; error?: string }

      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to generate sample posts")
        return
      }

      setPostStates(
        (json.posts ?? []).map(post => ({
          post,
          approved:    null,
          refineCount: 0,
          refining:    false,
        }))
      )
    } catch {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  function approvePost(postId: string) {
    setPostStates(prev =>
      prev.map(ps =>
        ps.post.id === postId
          ? { ...ps, approved: true, adjustment: undefined }
          : ps
      )
    )
    setShowNeedsAdjust(null)
  }

  // ── Refine ────────────────────────────────────────────────────────────────
  async function refinePost(postId: string, adjustment: AdjustmentOption) {
    setPostStates(prev =>
      prev.map(ps =>
        ps.post.id === postId
          ? { ...ps, refining: true, adjustment }
          : ps
      )
    )
    setShowNeedsAdjust(null)

    try {
      const res  = await fetch("/api/onboarding/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, refine: { postId, adjustment } }),
      })
      const json = await res.json() as { posts?: CalibrationPost[]; error?: string }

      if (!res.ok || json.error || !json.posts?.[0]) {
        setPostStates(prev =>
          prev.map(ps =>
            ps.post.id === postId ? { ...ps, refining: false } : ps
          )
        )
        return
      }

      const refined = json.posts[0]
      setPostStates(prev =>
        prev.map(ps =>
          ps.post.id === postId
            ? {
                ...ps,
                post:        refined,
                approved:    null,
                adjustment,
                refineCount: ps.refineCount + 1,
                refining:    false,
              }
            : ps
        )
      )
    } catch {
      setPostStates(prev =>
        prev.map(ps =>
          ps.post.id === postId ? { ...ps, refining: false } : ps
        )
      )
    }
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  async function handleComplete() {
    if (!allReviewed) return

    setCompleting(true)

    const reviews: PostReview[] = postStates.map(ps => ({
      post:       ps.post,
      approved:   ps.approved ?? false,
      adjustment: ps.adjustment,
    }))

    try {
      await fetch("/api/onboarding/calibrate/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews }),
      })
      // Show completion screen instead of immediately redirecting
      setCalibrationDone(true)
    } catch {
      setCompleting(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const allReviewed    = postStates.length > 0 && postStates.every(ps => ps.approved !== null)
  const approvedCount  = postStates.filter(ps => ps.approved === true).length

  // ── Completion screen ─────────────────────────────────────────────────────
  if (calibrationDone) {
    return <CompletionScreen draft={draft} onComplete={onComplete} />
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <StepShell
      title="Let's calibrate your brand voice"
      description="We've generated 3 sample posts in your voice. Review each one so PostFlow learns exactly how you communicate."
      onBack={back}
    >
      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center py-14 gap-4">
          <Loader2 className="h-9 w-9 animate-spin text-[var(--pf-teal)]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Generating your calibration posts…
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-[hsl(var(--destructive))] mt-0.5 shrink-0" />
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={loadCalibrationPosts}>
            Try again
          </Button>
          {/* If brand truly can't be found (stale session / bad state), let the user restart cleanly */}
          {error.toLowerCase().includes("brand") && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-[hsl(var(--muted-foreground))]"
              onClick={() => {
                try { localStorage.removeItem("postflow_onboarding_v1") } catch { /* ignore */ }
                window.location.href = "/onboarding"
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart onboarding
            </Button>
          )}
        </div>
      )}

      {/* Posts */}
      {!loading && !error && (
        <div className="space-y-6">
          {postStates.map((ps) => (
            <PostCard
              key={ps.post.id}
              ps={ps}
              showAdjust={showNeedsAdjust === ps.post.id}
              onApprove={() => approvePost(ps.post.id)}
              onNeedsAdjust={() =>
                setShowNeedsAdjust(v => v === ps.post.id ? null : ps.post.id)
              }
              onRefine={(adj) => refinePost(ps.post.id, adj)}
            />
          ))}

          {/* Progress summary */}
          {postStates.length > 0 && (
            <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {allReviewed
                ? `All 3 reviewed — ${approvedCount} approved, ${3 - approvedCount} adjusted.`
                : `${postStates.filter(ps => ps.approved !== null).length} of 3 reviewed`}
            </div>
          )}

          {/* Finish button */}
          {allReviewed && (
            <Button
              className="w-full"
              onClick={handleComplete}
              disabled={completing || !brandId}
            >
              {completing
                ? "Saving your brand preferences…"
                : "Finish calibration"}
            </Button>
          )}
        </div>
      )}
    </StepShell>
  )
}

// ── PostCard sub-component ───────────────────────────────────────────────────

interface PostCardProps {
  ps:             PostState
  showAdjust:     boolean
  onApprove:      () => void
  onNeedsAdjust:  () => void
  onRefine:       (adj: AdjustmentOption) => void
}

function PostCard({ ps, showAdjust, onApprove, onNeedsAdjust, onRefine }: PostCardProps) {
  const [selectedAdj, setSelectedAdj] = useState<AdjustmentOption | null>(null)

  const maxRefinesReached = ps.refineCount >= 2
  const canRefine         = !maxRefinesReached && !ps.refining

  function handleRefineClick() {
    if (!selectedAdj) return
    onRefine(selectedAdj)
    setSelectedAdj(null)
  }

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-5 space-y-4 transition-all",
        ps.approved === true  && "border-green-400 dark:border-green-600",
        ps.approved === false && "border-[hsl(var(--border))]",
        ps.approved === null  && POST_TYPE_COLORS[ps.post.id],
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              POST_LABEL_COLORS[ps.post.id]
            )}
          >
            Post {ps.post.id}
          </span>
          <h3 className="text-sm font-semibold mt-0.5">{ps.post.typeLabel}</h3>
        </div>
        {ps.approved === true && (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
        )}
      </div>

      {/* Refining overlay */}
      {ps.refining && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--pf-teal)]" />
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Regenerating…</span>
        </div>
      )}

      {!ps.refining && (
        <>
          {/* Caption */}
          <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-2 shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{ps.post.caption}</p>
            <p className="text-xs text-[var(--pf-teal)] mt-1">
              {ps.post.hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" ")}
            </p>
          </div>

          {/* Explanation */}
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed italic">
            {ps.post.explanation}
          </p>

          {/* Actions */}
          {ps.approved === null && !showAdjust && (
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={onApprove}>
                Looks great
              </Button>
              <Button variant="outline" size="sm" onClick={onNeedsAdjust}>
                Needs adjusting
              </Button>
            </div>
          )}

          {/* Already approved — allow re-opening */}
          {ps.approved === true && (
            <div className="flex gap-2">
              <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1 flex-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approved
              </span>
              <Button variant="ghost" size="sm" onClick={onNeedsAdjust} disabled={!canRefine}>
                Change
              </Button>
            </div>
          )}

          {/* Adjustment panel */}
          {showAdjust && (
            <div className="rounded-lg border p-4 space-y-3 bg-[hsl(var(--muted))]/40">
              <p className="text-sm font-medium">What needs to change?</p>

              <div className="flex flex-wrap gap-2">
                {ADJUSTMENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedAdj(v => v === opt.value ? null : opt.value)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs border transition-colors",
                      selectedAdj === opt.value
                        ? "bg-[var(--pf-teal)] text-white border-[var(--pf-teal)]"
                        : "border-[hsl(var(--border))] hover:border-[var(--pf-teal)]/30"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {maxRefinesReached && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Maximum refinements reached. You can still approve this version.
                </p>
              )}

              <div className="flex gap-2">
                {canRefine && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!selectedAdj}
                    onClick={handleRefineClick}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                )}
                <Button size="sm" onClick={onApprove}>
                  Approve as-is
                </Button>
                <Button variant="ghost" size="sm" onClick={onNeedsAdjust}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
