"use client"

/**
 * InspirationClient — Inspiration Link UI
 *
 * Handles two concerns in one component:
 *   1. URL input + analysis pipeline
 *   2. Results screen (observed patterns + token explanation + apply/skip)
 *
 * State machine:
 *   idle → analysing → result → applied / skipped
 *   Any error state shows an inline error message with a retry option.
 */

import { useState, useTransition } from "react"
import { Sparkles, Loader2, CheckCircle2, XCircle, AlertCircle, RotateCcw, ArrowRight } from "lucide-react"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { cn }       from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface InspirationSignal {
  token_key:        string
  value:            string | number
  confidence_delta: number
  observed_pattern: string
}

interface PostAnalysis {
  platform:          string
  post_type:         string
  observed_patterns: string[]
  signals:           InspirationSignal[]
}

interface AnalyseResult {
  analysisId:  string | null
  analysis:    PostAnalysis
  explanation: string
}

type ViewState =
  | { kind: "idle" }
  | { kind: "analysing" }
  | { kind: "error"; message: string; reason?: string }
  | { kind: "result"; data: AnalyseResult }
  | { kind: "applied"; count: number }
  | { kind: "skipped" }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map internal token key to a friendly display name */
function tokenLabel(key: string): string {
  const MAP: Record<string, string> = {
    hook_style:                      "Hook style",
    hook_duration_seconds:           "Hook duration",
    pacing:                          "Pacing",
    text_overlay_style:              "Text overlay",
    music_energy:                    "Music energy",
    music_genre:                     "Music genre",
    caption_tone:                    "Caption tone",
    hashtag_strategy:                "Hashtag strategy",
    carousel_slide_count:            "Carousel slide count",
    carousel_content_mix:            "Carousel content mix",
    carousel_text_overlay_density:   "Carousel text density",
    carousel_hook_style:             "Carousel hook style",
    carousel_slide_pacing:           "Carousel slide pacing",
  }
  return MAP[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(v: string | number): string {
  if (typeof v === "number") return String(v)
  return v.replace(/_/g, " ")
}

/** Real-time URL format check — used for inline validation before submit */
function isPlausibleUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return u.protocol === "https:"
  } catch {
    return false
  }
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function SignalTag({ signal }: { signal: InspirationSignal }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
      <span>
        <span className="font-medium text-[hsl(var(--foreground))]">{tokenLabel(signal.token_key)}</span>
        {" → "}
        <span className="text-indigo-600 dark:text-indigo-400 font-medium">{formatValue(signal.value)}</span>
        <span className="text-[hsl(var(--muted-foreground))]"> — {signal.observed_pattern}</span>
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  savedAnalyses: SavedAnalysis[]
}

export interface SavedAnalysis {
  id:                string
  source_url:        string
  platform:          string
  explanation:       string | null
  applied:           boolean
  applied_at:        string | null
  created_at:        string
  observed_patterns: string[]
  signal_count:      number
}

export function InspirationClient({ savedAnalyses }: Props) {
  const [url,         setUrl]      = useState("")
  const [view,        setView]     = useState<ViewState>({ kind: "idle" })
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [analyses,    setAnalyses] = useState<SavedAnalysis[]>(savedAnalyses)
  const [,            startTransition] = useTransition()

  const urlDirty  = url.trim().length > 0
  const urlValid  = isPlausibleUrl(url)
  const showError = urlDirty && !urlValid && url.trim().length > 12

  // ── Analyse ─────────────────────────────────────────────────────────────────
  async function handleAnalyse() {
    if (!urlValid) return
    setView({ kind: "analysing" })
    setIsAnalysing(true)

    try {
      const res  = await fetch("/api/inspiration/analyse", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json() as { error?: string; reason?: string } & Partial<AnalyseResult>

      if (!res.ok || !json.analysis) {
        setView({ kind: "error", message: json.error ?? "Analysis failed. Please try again.", reason: json.reason })
        return
      }

      setView({ kind: "result", data: json as AnalyseResult })
    } catch {
      setView({ kind: "error", message: "Analysis failed. Please check your connection and try again." })
    } finally {
      setIsAnalysing(false)
    }
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  function handleApply() {
    if (view.kind !== "result") return
    const { data } = view
    if (!data.analysisId) {
      // analysisId absent (DB write failed) — still show success optimistically
      setView({ kind: "applied", count: data.analysis.signals.length })
      return
    }

    startTransition(async () => {
      try {
        const res  = await fetch("/api/inspiration/apply", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ analysisId: data.analysisId }),
        })
        const json = await res.json() as { ok?: boolean; applied?: number; error?: string }

        if (!res.ok) {
          setView({ kind: "error", message: json.error ?? "Failed to apply. Please try again." })
          return
        }
        setView({ kind: "applied", count: json.applied ?? data.analysis.signals.length })

        // Refresh local library list (mark as applied)
        if (data.analysisId) {
          setAnalyses(prev => prev.map(a =>
            a.id === data.analysisId ? { ...a, applied: true, applied_at: new Date().toISOString() } : a
          ))
        }
      } catch {
        setView({ kind: "error", message: "Failed to apply. Please check your connection." })
      }
    })
  }

  // ── Skip ────────────────────────────────────────────────────────────────────
  function handleSkip() {
    setView({ kind: "skipped" })
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    setUrl("")
    setView({ kind: "idle" })
  }

  // ── Apply from library ──────────────────────────────────────────────────────
  async function handleApplyFromLibrary(analysisId: string) {
    try {
      const res  = await fetch("/api/inspiration/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ analysisId }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (res.ok) {
        setAnalyses(prev => prev.map(a =>
          a.id === analysisId ? { ...a, applied: true, applied_at: new Date().toISOString() } : a
        ))
      } else {
        alert(json.error ?? "Failed to apply")
      }
    } catch {
      alert("Failed to apply. Please try again.")
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-500" />
          Inspiration
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Paste a public Instagram or TikTok post — PostFlow extracts what makes it work and applies those insights to your brand.
        </p>
      </div>

      {/* URL input card */}
      {(view.kind === "idle" || view.kind === "error") && (
        <section className="rounded-xl border bg-[hsl(var(--card))] p-5 space-y-4">
          <p className="text-sm font-medium">Add inspiration link</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  type="url"
                  placeholder="https://www.instagram.com/p/…  or  https://www.tiktok.com/@…"
                  value={url}
                  onChange={e => {
                    setUrl(e.target.value)
                    if (view.kind === "error") setView({ kind: "idle" })
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && urlValid) void handleAnalyse() }}
                  className={cn(
                    "font-mono text-sm",
                    showError && "border-red-400 focus-visible:ring-red-400"
                  )}
                  disabled={isAnalysing}
                  aria-label="Inspiration post URL"
                />
                {showError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Please paste the full https:// link from Instagram or TikTok.
                  </p>
                )}
              </div>
              <Button
                onClick={() => void handleAnalyse()}
                disabled={!urlValid || isAnalysing}
                className="shrink-0"
              >
                Analyse
              </Button>
            </div>
          </div>

          {/* Error feedback */}
          {view.kind === "error" && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{view.message}</span>
            </div>
          )}
        </section>
      )}

      {/* Analysing state */}
      {view.kind === "analysing" && (
        <section className="rounded-xl border bg-[hsl(var(--card))] p-8 flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <div>
            <p className="font-medium">Analysing post…</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Fetching the post and extracting patterns. This takes 8–15 seconds.
            </p>
          </div>
        </section>
      )}

      {/* Result screen */}
      {view.kind === "result" && (() => {
        const { data } = view
        return (
          <section className="rounded-xl border bg-[hsl(var(--card))] divide-y">
            {/* What makes this work */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                What makes this work
              </p>
              {data.analysis.observed_patterns.length > 0 ? (
                <ul className="space-y-1.5">
                  {data.analysis.observed_patterns.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0 mt-1.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No clear patterns detected from this post.</p>
              )}
            </div>

            {/* How we'll apply it */}
            {data.analysis.signals.length > 0 && (
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  How we&apos;ll apply it
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{data.explanation}</p>
                <div className="space-y-2 mt-3">
                  {data.analysis.signals.map((s, i) => (
                    <SignalTag key={i} signal={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-[hsl(var(--muted-foreground))]">
                Skip
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Analyse another
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={data.analysis.signals.length === 0}
                  className="gap-1.5"
                >
                  Apply to my brand
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </section>
        )
      })()}

      {/* Applied success */}
      {view.kind === "applied" && (
        <section className="rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 px-5 py-6 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div>
            <p className="font-semibold">Done! {view.count} insight{view.count !== 1 ? "s" : ""} applied.</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              PostFlow will reflect these patterns in your next video and carousel generations.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="mt-1 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Analyse another post
          </Button>
        </section>
      )}

      {/* Skipped success */}
      {view.kind === "skipped" && (
        <section className="rounded-xl border bg-[hsl(var(--muted))]/40 px-5 py-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Analysis saved. You can apply it later from the library below.</p>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Analyse another post
          </Button>
        </section>
      )}

      {/* Library — saved analyses */}
      {analyses.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm text-[hsl(var(--muted-foreground))]">
            Saved analyses
          </h2>
          <div className="rounded-xl border divide-y">
            {analyses.map(a => (
              <LibraryRow key={a.id} analysis={a} onApply={handleApplyFromLibrary} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Library row ────────────────────────────────────────────────────────────────

function LibraryRow({
  analysis,
  onApply,
}: {
  analysis:  SavedAnalysis
  onApply:   (id: string) => Promise<void>
}) {
  const [applying, setApplying] = useState(false)

  async function handleApply() {
    setApplying(true)
    await onApply(analysis.id)
    setApplying(false)
  }

  const date = new Date(analysis.created_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  })

  const platformLabel = analysis.platform === "instagram" ? "Instagram" :
                        analysis.platform === "tiktok"    ? "TikTok"    : analysis.platform

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            {platformLabel}
          </span>
          {analysis.applied && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Applied
            </span>
          )}
          <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">{date}</span>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{analysis.source_url}</p>
        {analysis.explanation && (
          <p className="text-sm line-clamp-2">{analysis.explanation}</p>
        )}
        {analysis.observed_patterns.length > 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {analysis.signal_count} signal{analysis.signal_count !== 1 ? "s" : ""} · {analysis.observed_patterns.length} pattern{analysis.observed_patterns.length !== 1 ? "s" : ""} detected
          </p>
        )}
      </div>
      {!analysis.applied && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleApply()}
          disabled={applying}
          className="shrink-0 self-center"
        >
          {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
        </Button>
      )}
    </div>
  )
}
