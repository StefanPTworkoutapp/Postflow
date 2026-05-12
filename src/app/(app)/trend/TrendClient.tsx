/**
 * TrendClient — full Trend Builder wizard.
 *
 * Step 0: Upload clips (ClipDropzone — reused from clip-forge)
 * Step 1: Pick platform
 * Step 2: Concept screen — 3 ConceptCards (AI-generated, ~10–15s)
 * Step 3: Rendering — parallel A/B Shotstack renders + RenderStatusBar
 * Step 4: Preview — swipeable A vs B, pick, optional nudge, approve/reject
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Loader2, ArrowLeft, TrendingUp, CheckCircle2, XCircle, Copy, Check, RefreshCw,
} from "lucide-react"
import { Button }         from "@/components/ui/button"
import { cn }             from "@/lib/utils"
import { ClipDropzone }   from "@/components/clip-forge/ClipDropzone"
import { SelectCard }     from "@/components/clip-forge/SelectCard"
import { ConnectPrompt }  from "@/components/clip-forge/ConnectPrompt"
import { ConceptCard }    from "@/components/trend-forge/ConceptCard"
import { RenderStatusBar } from "@/components/trend-forge/RenderStatusBar"
import type { UploadedClip } from "@/components/clip-forge/ClipDropzone"
import type { TrendConcept } from "@/lib/server/trends/trend-filter"

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4

interface ConceptWithId extends TrendConcept { id: string | null }

interface JobStatus {
  status:         string
  renderProgress: number
  versionAUrl:    string | null
  versionBUrl:    string | null
  chosenVersion:  string | null
  outputCaption:  string | null
  outputHashtags: string[] | null
}

// ── Platform options ──────────────────────────────────────────────────────────

const PLATFORM_OPTIONS: Array<{ value: string; label: string; emoji: string }> = [
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "tiktok",    label: "TikTok",    emoji: "🎵" },
  { value: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { value: "facebook",  label: "Facebook",  emoji: "👥" },
]

const STEPS = ["Upload", "Platform", "Concepts", "Rendering", "Preview"] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function TrendClient() {
  const [step,         setStep]         = useState<Step>(0)
  const [clips,        setClips]        = useState<UploadedClip[]>([])
  const [platform,     setPlatform]     = useState<string | null>(null)

  // Step 2 — concepts
  const [jobId,        setJobId]        = useState<string | null>(null)
  const [concepts,     setConcepts]     = useState<ConceptWithId[]>([])

  // Step 3 — rendering
  const [jobStatus,    setJobStatus]    = useState<JobStatus | null>(null)
  const [progressA,    setProgressA]    = useState(0)
  const [progressB,    setProgressB]    = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 4 — preview
  const [activeVersion, setActiveVersion] = useState<"a" | "b">("a")
  const [versionPicked, setVersionPicked] = useState(false)
  const [nudgeMode,     setNudgeMode]     = useState(false)
  const [nudgeText,     setNudgeText]     = useState("")
  const [nudgeUsed,     setNudgeUsed]     = useState(false)
  const [feedbackDone,  setFeedbackDone]  = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)

  // Global
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // ── Polling ──────────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/trend/${id}`)
      if (!res.ok) return
      const data = await res.json() as JobStatus
      setJobStatus(data)

      // Decode A/B progress from status
      if (data.versionAUrl) setProgressA(100)
      if (data.versionBUrl) setProgressB(100)

      if (data.status === "ready") {
        stopPolling()
        setStep(4)
      } else if (data.status === "failed") {
        stopPolling()
        setApiError("Render failed. Please try again.")
      }
    } catch {
      // ignore poll errors
    }
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  // ── Step handlers ─────────────────────────────────────────────────────────

  const handleClipsReady = (c: UploadedClip[]) => { setClips(c); setStep(1) }

  // Step 1 → 2: generate concepts
  const handleGenerateConcepts = async () => {
    if (!platform) return
    setLoading(true)
    setApiError(null)

    try {
      const res = await fetch("/api/trend/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          clips: clips.map(c => ({ path: c.path, duration: c.duration, frameDataUri: c.frameDataUri })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setApiError(data.error ?? "Failed to generate concepts"); return }

      setJobId(data.jobId)
      setConcepts(data.concepts as ConceptWithId[])
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  // Step 2 → 3: build selected concept
  const handleBuildConcept = async (conceptId: string) => {
    if (!jobId) return
    setLoading(true)
    setApiError(null)

    try {
      const res = await fetch(`/api/trend/${jobId}/render`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId }),
      })
      const data = await res.json()
      if (!res.ok) { setApiError(data.error ?? "Failed to start render"); return }

      setStep(3)
      pollRef.current = setInterval(() => pollStatus(jobId!), 6000)
      pollStatus(jobId!)
    } finally {
      setLoading(false)
    }
  }

  // Step 4: pick version
  const handlePickVersion = async (version: "a" | "b") => {
    if (!jobId) return
    await fetch(`/api/trend/${jobId}/pick`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    })
    setVersionPicked(true)
    setActiveVersion(version)
  }

  // Step 4: nudge
  const handleNudge = async () => {
    if (!jobId || !nudgeText.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/trend/${jobId}/nudge`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudgeText }),
      })
      const data = await res.json()
      if (!res.ok) { setApiError(data.error ?? "Nudge failed"); return }

      setNudgeUsed(true)
      setNudgeMode(false)
      setNudgeText("")
      setVersionPicked(false)
      setJobStatus(s => s ? { ...s, status: "rendering" } : s)
      setStep(3)
      // Resume polling
      pollRef.current = setInterval(() => pollStatus(jobId!), 6000)
      pollStatus(jobId!)
    } finally {
      setLoading(false)
    }
  }

  // Step 4: feedback
  const handleFeedback = async (rating: "approve" | "reject") => {
    if (!jobId) return
    await fetch(`/api/trend/${jobId}/feedback`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    })
    setFeedbackDone(true)
  }

  const copyCaption = async () => {
    const txt = jobStatus?.outputCaption ?? ""
    await navigator.clipboard.writeText(txt)
    setCaptionCopied(true)
    setTimeout(() => setCaptionCopied(false), 2000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeVideoUrl = activeVersion === "a" ? jobStatus?.versionAUrl : jobStatus?.versionBUrl

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trend Builder</h1>
          <p className="text-sm text-muted-foreground">Ride trending topics with your brand&apos;s style</p>
        </div>
      </div>

      <StepIndicator current={step} />

      {apiError && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400">
          {apiError}
        </div>
      )}

      {/* ── Step 0: Upload ──────────────────────────────────────────────────── */}
      {step === 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-medium">Upload your clips</h2>
          <p className="text-sm text-muted-foreground">
            Upload the raw footage you want to use. PostFlow will match it to trending content in your niche.
          </p>
          <ClipDropzone onClipsReady={handleClipsReady} />
        </section>
      )}

      {/* ── Step 1: Platform ────────────────────────────────────────────────── */}
      {step === 1 && (
        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-base font-medium">Which platform?</h2>
            <p className="text-sm text-muted-foreground">
              PostFlow will pick trending topics specific to this platform.
            </p>
          </div>

          <SelectCard
            options={PLATFORM_OPTIONS}
            value={platform}
            onChange={setPlatform}
            columns={2}
          />

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              disabled={!platform || loading}
              onClick={handleGenerateConcepts}
              className="flex-1"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing trends…</>
              ) : (
                "Generate concepts →"
              )}
            </Button>
          </div>
        </section>
      )}

      {/* ── Step 2: Concept cards ────────────────────────────────────────────── */}
      {step === 2 && (
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-medium">Pick a concept</h2>
            <p className="text-sm text-muted-foreground">
              PostFlow matched these trends to your brand. Pick one to build two versions — trend-first and brand-first.
            </p>
          </div>

          <div className="space-y-4">
            {concepts.map((concept, i) => (
              <ConceptCard
                key={concept.id ?? i}
                concept={concept}
                isBestMatch={i === 0}
                loading={loading}
                onBuild={() => concept.id && handleBuildConcept(concept.id)}
              />
            ))}
          </div>

          <Button variant="outline" onClick={() => setStep(1)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </section>
      )}

      {/* ── Step 3: Rendering ────────────────────────────────────────────────── */}
      {step === 3 && (
        <section className="flex flex-col items-center gap-6 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/60">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-medium">Building A/B versions…</h2>
            <p className="text-sm text-muted-foreground">
              Two versions are rendering in parallel. Version A is trend-first, Version B is brand-first.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <RenderStatusBar
              progressA={progressA}
              progressB={progressB}
              doneA={!!jobStatus?.versionAUrl}
              doneB={!!jobStatus?.versionBUrl}
            />
          </div>
        </section>
      )}

      {/* ── Step 4: Preview + pick ────────────────────────────────────────────── */}
      {step === 4 && jobStatus && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-medium">Which version do you prefer?</h2>
            <p className="text-sm text-muted-foreground">
              A is trend-first. B is brand-first. Pick the one that feels most like you.
            </p>
          </div>

          {/* Version toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            {(["a", "b"] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveVersion(v)}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors",
                  activeVersion === v
                    ? "bg-indigo-600 text-white"
                    : "bg-card text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800",
                )}
              >
                Version {v.toUpperCase()}
                {v === "a" && <span className="ml-1 text-xs opacity-70">Trend</span>}
                {v === "b" && <span className="ml-1 text-xs opacity-70">Brand</span>}
              </button>
            ))}
          </div>

          {/* Video preview */}
          {activeVideoUrl ? (
            <div className="flex justify-center">
              <video
                key={activeVideoUrl}
                src={activeVideoUrl}
                controls
                playsInline
                className="max-h-[480px] max-w-full rounded-xl border shadow-sm"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 rounded-xl border bg-zinc-50 dark:bg-zinc-900 text-muted-foreground text-sm">
              Video unavailable for this version
            </div>
          )}

          {/* Pick + nudge controls */}
          {!versionPicked && !feedbackDone && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handlePickVersion("a")}
                disabled={!jobStatus.versionAUrl}
                className="flex-1"
              >
                Pick A (Trend)
              </Button>
              <Button
                onClick={() => handlePickVersion("b")}
                disabled={!jobStatus.versionBUrl}
                className="flex-1"
              >
                Pick B (Brand)
              </Button>
            </div>
          )}

          {/* After version picked */}
          {versionPicked && !feedbackDone && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Version {activeVersion.toUpperCase()} selected
              </div>

              {/* Optional nudge */}
              {!nudgeUsed && !nudgeMode && (
                <button
                  type="button"
                  onClick={() => setNudgeMode(true)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Not quite right? Nudge it once
                </button>
              )}

              {nudgeMode && !nudgeUsed && (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium">What should change?</p>
                  <textarea
                    value={nudgeText}
                    onChange={e => setNudgeText(e.target.value)}
                    placeholder='e.g. "Make it faster" or "Softer hook" or "Less text"'
                    rows={2}
                    className="w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-background"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setNudgeMode(false)}>Cancel</Button>
                    <Button size="sm" disabled={!nudgeText.trim() || loading} onClick={handleNudge}>
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply nudge"}
                    </Button>
                  </div>
                </div>
              )}

              {nudgeUsed && (
                <p className="text-xs text-muted-foreground italic">Nudge applied — one nudge per session.</p>
              )}

              {/* Caption */}
              {jobStatus.outputCaption && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Generated caption</h3>
                    <button
                      type="button"
                      onClick={copyCaption}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {captionCopied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                    </button>
                  </div>
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {jobStatus.outputCaption}
                  </div>
                </div>
              )}

              {/* Approve / Reject */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                  onClick={() => handleFeedback("reject")}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button className="flex-1" onClick={() => handleFeedback("approve")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </Button>
              </div>
            </div>
          )}

          {/* Done */}
          {feedbackDone && platform && (
            <ConnectPrompt
              platform={platform}
              onSkip={undefined}
            />
          )}
        </section>
      )}
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <nav aria-label="Progress" className="flex items-center gap-1">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending"
        return (
          <div key={label} className="flex items-center gap-1">
            <div className={cn(
              "flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium",
              state === "done"    && "bg-emerald-600 text-white",
              state === "active"  && "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-300",
              state === "pending" && "bg-zinc-100 text-zinc-400 dark:bg-zinc-800",
            )}>
              {state === "done" ? "✓" : i + 1}
            </div>
            <span className={cn(
              "hidden sm:inline text-xs font-medium",
              state === "active" ? "text-foreground" : "text-muted-foreground",
            )}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px w-4 shrink-0", i < current ? "bg-emerald-400" : "bg-border")} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
