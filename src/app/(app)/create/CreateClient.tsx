/**
 * CreateClient — full Smart Video Builder wizard.
 *
 * Step 0: Upload clips (ClipDropzone)
 * Step 1: Goal + Platform (SelectCard)
 * Step 2: Music pick (MusicPicker) — after AI analysis returns
 * Step 3: Rendering (progress bar, polls /api/clip-forge/[id])
 * Step 4: Preview + Approve/Reject + share caption
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Copy, Check, Clapperboard } from "lucide-react"
import { Button }        from "@/components/ui/button"
import { cn }            from "@/lib/utils"
import { ClipDropzone }  from "@/components/clip-forge/ClipDropzone"
import { MusicPicker }   from "@/components/clip-forge/MusicPicker"
import { SelectCard }    from "@/components/clip-forge/SelectCard"
import { ConnectPrompt } from "@/components/clip-forge/ConnectPrompt"
import type { UploadedClip } from "@/components/clip-forge/ClipDropzone"
import type { MusicTrack }  from "@/lib/server/music/music-selector"

// ── Step config ──────────────────────────────────────────────────────────────

const STEPS = ["Upload", "Goal & Platform", "Music", "Building", "Preview"] as const
type Step = 0 | 1 | 2 | 3 | 4

// ── Goal options ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS: Array<{ value: string; label: string; emoji: string; description: string }> = [
  { value: "grow_followers",   label: "Grow followers",   emoji: "📈", description: "Attract new audience members" },
  { value: "educate",          label: "Educate",           emoji: "💡", description: "Teach something valuable" },
  { value: "showcase",         label: "Showcase work",     emoji: "🏆", description: "Show results, products, or services" },
  { value: "entertain",        label: "Entertain",         emoji: "🎬", description: "Keep people watching and sharing" },
  { value: "drive_sales",      label: "Drive sales",       emoji: "💰", description: "Convert viewers into customers" },
  { value: "build_community",  label: "Build community",   emoji: "🤝", description: "Foster connection and loyalty" },
]
type Goal = string

const PLATFORM_OPTIONS: Array<{ value: string; label: string; emoji: string }> = [
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "tiktok",    label: "TikTok",    emoji: "🎵" },
  { value: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { value: "facebook",  label: "Facebook",  emoji: "👥" },
  { value: "youtube",   label: "YouTube",   emoji: "▶️" },
]
type Platform = string

// ── Types ─────────────────────────────────────────────────────────────────────


interface JobResult {
  jobId:       string
  musicTracks: MusicTrack[]
  sortedClips: Array<{ id: string; publicUrl: string; durationSeconds: number }>
  caption:     string
  hashtags:    string[]
}

interface JobStatus {
  status:             string
  renderProgress:     number
  outputVideoUrl:     string | null
  outputCaption:      string | null
  outputHashtags:     string[] | null
  /** Set when the selected music track didn't resolve — rendered without a soundtrack */
  musicSkippedReason?: string | null
}

// ── Main component ────────────────────────────────────────────────────────────

export function CreateClient() {
  const [step,      setStep]     = useState<Step>(0)
  const [clips,     setClips]    = useState<UploadedClip[]>([])
  const [goal,      setGoal]     = useState<Goal | null>(null)
  const [platform,  setPlatform] = useState<Platform | null>(null)

  // Step 2 — after /create
  const [jobResult,      setJobResult]      = useState<JobResult | null>(null)
  const [selectedMusic,  setSelectedMusic]  = useState<string | null>(null)  // full_url or null
  const [musicDefault,   setMusicDefault]   = useState(false)

  // Step 3 — rendering
  const [jobStatus,    setJobStatus]    = useState<JobStatus | null>(null)
  const [pollError,    setPollError]    = useState<string | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 4 — preview
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)

  // Global loading
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // ── Polling ──────────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/clip-forge/${jobId}`)
      if (!res.ok) { setPollError("Status check failed"); return }
      const data = await res.json() as JobStatus
      setJobStatus(data)

      if (data.status === "ready") {
        stopPolling()
        setStep(4)
      } else if (data.status === "failed") {
        stopPolling()
        setPollError("Render failed — please try again.")
      }
    } catch {
      setPollError("Network error while checking render status.")
    }
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  // ── Step handlers ─────────────────────────────────────────────────────────

  // Step 0 → 1
  const handleClipsReady = (uploadedClips: UploadedClip[]) => {
    setClips(uploadedClips)
    setStep(1)
  }

  // Step 1 → 2: create job
  const handleBuildStart = async () => {
    if (!goal || !platform) return
    setLoading(true)
    setApiError(null)

    try {
      const res = await fetch("/api/clip-forge/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          platform,
          clips: clips.map(c => ({
            path:         c.path,
            duration:     c.duration,
            frameDataUri: c.frameDataUri,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) { setApiError(data.error ?? "Failed to create job"); return }

      setJobResult(data as JobResult)
      // Default music to first track
      if ((data as JobResult).musicTracks.length) {
        setSelectedMusic((data as JobResult).musicTracks[0].full_url)
        setMusicDefault(true)
      }
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  // Step 2 → 3: start render
  const handleRenderStart = async () => {
    if (!jobResult) return
    setLoading(true)
    setApiError(null)

    try {
      const res = await fetch(`/api/clip-forge/${jobResult.jobId}/render`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          musicSrc: selectedMusic,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setApiError(data.error ?? "Failed to start render"); return }

      setStep(3)

      // Start polling every 6 seconds
      pollIntervalRef.current = setInterval(
        () => pollJobStatus(jobResult.jobId),
        6000,
      )
      // Poll immediately
      pollJobStatus(jobResult.jobId)
    } finally {
      setLoading(false)
    }
  }

  // Step 4: feedback
  const handleFeedback = async (rating: "approve" | "reject") => {
    if (!jobResult) return
    await fetch(`/api/clip-forge/${jobResult.jobId}/feedback`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    })
    setFeedbackDone(true)
  }

  // Caption copy
  const copyCaption = async () => {
    const caption = jobStatus?.outputCaption ?? jobResult?.caption ?? ""
    await navigator.clipboard.writeText(caption)
    setCaptionCopied(true)
    setTimeout(() => setCaptionCopied(false), 2000)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/60">
          <Clapperboard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Smart Video Builder</h1>
          <p className="text-sm text-muted-foreground">Turn your raw clips into a branded video</p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* API error banner */}
      {apiError && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400">
          {apiError}
        </div>
      )}

      {/* ── Step 0: Upload ──────────────────────────────────────────────────── */}
      {step === 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-medium">Upload your clips</h2>
          <ClipDropzone onClipsReady={handleClipsReady} />
        </section>
      )}

      {/* ── Step 1: Goal + Platform ─────────────────────────────────────────── */}
      {step === 1 && (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-base font-medium">What&apos;s the goal?</h2>
            <SelectCard
              options={GOAL_OPTIONS}
              value={goal}
              onChange={(v) => setGoal(v as Goal)}
              columns={3}
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-medium">Which platform?</h2>
            <SelectCard
              options={PLATFORM_OPTIONS as unknown as Array<{ value: string; label: string; emoji?: string }>}
              value={platform}
              onChange={(v) => setPlatform(v as Platform)}
              columns={3}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              disabled={!goal || !platform || loading}
              onClick={handleBuildStart}
              className="flex-1"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing clips…</>
              ) : (
                "Analyse & pick music →"
              )}
            </Button>
          </div>
        </section>
      )}

      {/* ── Step 2: Music pick ───────────────────────────────────────────────── */}
      {step === 2 && jobResult && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-medium">Choose background music</h2>
            <p className="text-sm text-muted-foreground">
              PostFlow picked these based on your brand&apos;s energy and genre tokens.
              Preview each track, then click to select.
            </p>
          </div>

          <MusicPicker
            tracks={jobResult.musicTracks}
            value={selectedMusic}
            onChange={setSelectedMusic}
          />

          {musicDefault && selectedMusic && (
            <p className="text-xs text-muted-foreground">
              ✓ Auto-selected based on your brand tokens. Change if you prefer something different.
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              disabled={loading}
              onClick={handleRenderStart}
              className="flex-1"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting render…</>
              ) : (
                "Build video →"
              )}
            </Button>
          </div>
        </section>
      )}

      {/* ── Step 3: Rendering ────────────────────────────────────────────────── */}
      {step === 3 && (
        <section className="flex flex-col items-center gap-6 py-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/60">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-medium">Building your video…</h2>
            <p className="text-sm text-muted-foreground">
              Shotstack is compositing your clips with brand overlays and music.
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Rendering</span>
              <span>{jobStatus?.renderProgress ?? 0}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${jobStatus?.renderProgress ?? 0}%` }}
              />
            </div>
          </div>

          {pollError && (
            <p className="text-sm text-rose-600">{pollError}</p>
          )}
        </section>
      )}

      {/* ── Step 4: Preview ──────────────────────────────────────────────────── */}
      {step === 4 && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-medium">Your video is ready</h2>
            <p className="text-sm text-muted-foreground">
              Preview it below, then approve or reject. Approved videos can be scheduled via Buffer.
            </p>
          </div>

          {/* Video preview */}
          {jobStatus?.outputVideoUrl && (
            <div className="flex justify-center">
              <video
                src={jobStatus.outputVideoUrl}
                controls
                playsInline
                className="max-h-[480px] max-w-full rounded-xl border shadow-sm"
              />
            </div>
          )}

          {/* Music fell back — rendered without a soundtrack */}
          {jobStatus?.musicSkippedReason && (
            <p className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
              🔇 Rendered without music: {jobStatus.musicSkippedReason}
            </p>
          )}

          {/* Caption */}
          {(jobStatus?.outputCaption || jobResult?.caption) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Generated caption</h3>
                <button
                  type="button"
                  onClick={copyCaption}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {captionCopied
                    ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy</>
                  }
                </button>
              </div>
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {jobStatus?.outputCaption ?? jobResult?.caption}
              </div>
              {/* Hashtags */}
              {((jobStatus?.outputHashtags ?? jobResult?.hashtags) ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(jobStatus?.outputHashtags ?? jobResult?.hashtags ?? []).map(tag => (
                    <span key={tag} className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                      #{tag.replace(/^#/, "")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {!feedbackDone ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                onClick={() => handleFeedback("reject")}
              >
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleFeedback("approve")}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
              </Button>
            </div>
          ) : (
            <SuccessBlock
              platform={platform ?? "instagram"}
              videoUrl={jobStatus?.outputVideoUrl ?? null}
            />
          )}
        </section>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <nav aria-label="Progress" className="flex items-center gap-1">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending"
        return (
          <div key={label} className="flex items-center gap-1">
            <div className={cn(
              "flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
              state === "done"    && "bg-indigo-600 text-white",
              state === "active"  && "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-300",
              state === "pending" && "bg-zinc-100 text-zinc-400 dark:bg-zinc-800",
            )}>
              {state === "done" ? "✓" : i + 1}
            </div>
            <span className={cn(
              "hidden sm:inline text-xs font-medium",
              state === "active"  ? "text-foreground" : "text-muted-foreground",
            )}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-px w-4 shrink-0",
                i < current ? "bg-indigo-400" : "bg-border",
              )} />
            )}
          </div>
        )
      })}
    </nav>
  )
}

function SuccessBlock({ platform, videoUrl }: { platform: string; videoUrl: string | null }) {
  const LABELS: Record<string, string> = {
    instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn",
    facebook: "Facebook",   youtube: "YouTube",
  }
  const label = LABELS[platform] ?? platform

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 dark:bg-emerald-950/20 dark:border-emerald-800">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Video approved! Ready to schedule on {label}.
        </p>
      </div>

      <ConnectPrompt
        platform={platform}
        onSkip={undefined}
      />

      {videoUrl && (
        <div className="flex justify-center pt-1">
          <a
            href={videoUrl}
            download
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Download video file
          </a>
        </div>
      )}
    </div>
  )
}
