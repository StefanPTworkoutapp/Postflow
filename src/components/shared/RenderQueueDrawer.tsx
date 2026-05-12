"use client"

/**
 * RenderQueueDrawer
 *
 * Slide-out drawer listing all active and recently completed render jobs
 * for the current brand. Jobs are polled every 4s while the drawer is open.
 *
 * Render sources tracked:
 *   - clip_forge_jobs  (Smart Video Builder)
 *   - trend_concepts   (Trend Builder A/B renders)
 *
 * Usage:
 *   <RenderQueueDrawer open={open} onClose={() => setOpen(false)} />
 *
 *   // Trigger button (example):
 *   <button onClick={() => setOpen(true)}>
 *     <Layers className="h-4 w-4" /> Renders
 *   </button>
 */

import { useEffect, useState, useCallback }   from "react"
import { X, Loader2, CheckCircle2, XCircle, Film, TrendingUp } from "lucide-react"
import { cn }                                  from "@/lib/utils"
import { RenderStatusBar, type RenderStatus }  from "@/components/shared/RenderStatusBar"

// ── Types ────────────────────────────────────────────────────────────────────

export interface RenderJob {
  id:         string
  source:     "clip_forge" | "trend"
  title:      string            // human-readable label
  status:     RenderStatus
  progress?:  number
  createdAt:  string
  renderUrl?: string | null
}

interface Props {
  open:     boolean
  onClose:  () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function RenderQueueDrawer({ open, onClose }: Props) {
  const [jobs, setJobs]     = useState<RenderJob[]>([])
  const [loading, setLoading] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      const res  = await fetch("/api/render/queue")
      if (!res.ok) return
      const data = await res.json() as { jobs: RenderJob[] }
      setJobs(data.jobs ?? [])
    } catch {
      // silently ignore — drawer is non-critical
    }
  }, [])

  // Initial load + polling while open
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchJobs().finally(() => setLoading(false))

    const interval = setInterval(fetchJobs, 4_000)
    return () => clearInterval(interval)
  }, [open, fetchJobs])

  const active    = jobs.filter(j => j.status === "rendering")
  const completed = jobs.filter(j => j.status !== "rendering")

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[190] bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-[200] flex h-screen w-80 flex-col border-l bg-[hsl(var(--card))] shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Render queue"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div>
            <p className="text-sm font-semibold">Render queue</p>
            {active.length > 0 && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {active.length} job{active.length !== 1 ? "s" : ""} in progress
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close render queue"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && jobs.length === 0 && (
            <div className="flex items-center justify-center py-12 gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <Film className="h-8 w-8 text-[hsl(var(--muted-foreground))]/40" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No render jobs yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]/70">
                Jobs from the Video Builder and Trend Builder appear here.
              </p>
            </div>
          )}

          {/* Active jobs */}
          {active.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
                In progress
              </p>
              {active.map(job => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}

          {/* Completed jobs */}
          {completed.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1 pt-2">
                Recent
              </p>
              {completed.map(job => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 shrink-0">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Jobs are kept for 7 days.
          </p>
        </div>
      </div>
    </>
  )
}

// ── JobRow ───────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: RenderJob }) {
  const Icon = job.source === "trend" ? TrendingUp : Film

  return (
    <div className="rounded-lg border bg-[hsl(var(--background))] p-3 space-y-2">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
        <p className="text-xs font-medium truncate flex-1">{job.title}</p>

        {job.status === "done" && (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        )}
        {job.status === "error" && (
          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
        )}
      </div>

      {/* Status bar */}
      <RenderStatusBar
        status={job.status}
        progress={job.progress}
        className="text-xs"
      />

      {/* Download / view link for done jobs */}
      {job.status === "done" && job.renderUrl && (
        <a
          href={job.renderUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--pf-color-brand-primary)] hover:underline"
        >
          View render ↗
        </a>
      )}
    </div>
  )
}
