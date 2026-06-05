"use client"

/**
 * WeeklyIdeas — displays 3 AI-generated post ideas for the current week.
 *
 * Caches results in localStorage for the week (keyed by Monday's ISO date)
 * so we don't call the API on every page load.
 */

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Lightbulb, RefreshCw, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeeklyIdea {
  hook:     string
  format:   string
  platform: string
  reason:   string
}

interface Props {
  brandId: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the ISO date string (YYYY-MM-DD) of the Monday of the current week. */
function getMondayKey(): string {
  const d   = new Date()
  const day = d.getDay()             // 0 = Sun, 1 = Mon, …
  const diff = day === 0 ? -6 : 1 - day  // days back to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split("T")[0]
}

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  LinkedIn:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Facebook:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  TikTok:    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
}

const FORMAT_COLORS: Record<string, string> = {
  Reel:     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Carousel: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Single:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Story:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WeeklyIdeas({ brandId }: Props) {
  const router             = useRouter()
  const [ideas,   setIdeas]   = useState<WeeklyIdea[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const cacheKey = `postflow_weekly_ideas_${getMondayKey()}`

  const fetchIdeas = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)

    // Check cache first (unless forcing a refresh)
    if (!force) {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached) as WeeklyIdea[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setIdeas(parsed)
            setLoading(false)
            return
          }
        }
      } catch {
        // Corrupted cache — proceed to fetch
      }
    }

    try {
      const res  = await fetch(`/api/dashboard/weekly-ideas?brandId=${brandId}`)
      const json = await res.json() as { ideas?: WeeklyIdea[]; error?: string }

      if (!res.ok || !json.ideas) {
        throw new Error(json.error ?? "Failed to load ideas")
      }

      setIdeas(json.ideas)
      localStorage.setItem(cacheKey, JSON.stringify(json.ideas))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ideas")
    } finally {
      setLoading(false)
    }
  }, [brandId, cacheKey])

  useEffect(() => {
    fetchIdeas(false)
  }, [fetchIdeas])

  function handleCreate(hook: string) {
    try {
      sessionStorage.setItem("postflow_prefill_hook", hook)
    } catch {
      // sessionStorage unavailable — navigate anyway
    }
    router.push("/create")
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Ideas for this week
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground"
            onClick={() => fetchIdeas(true)}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Refresh ideas
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading state */}
        {loading && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="rounded-lg border p-4 space-y-3 animate-pulse"
                style={{ opacity: 1 - i * 0.15 }}
              >
                <div className="flex gap-1.5">
                  <div className="h-5 w-16 rounded-full bg-[hsl(var(--muted))]" />
                  <div className="h-5 w-14 rounded-full bg-[hsl(var(--muted))]" />
                </div>
                <div className="h-4 w-full rounded bg-[hsl(var(--muted))]" />
                <div className="h-4 w-3/4 rounded bg-[hsl(var(--muted))]" />
                <div className="h-3 w-full rounded bg-[hsl(var(--muted))]" />
                <div className="h-7 w-28 rounded bg-[hsl(var(--muted))] ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Couldn&apos;t load ideas.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchIdeas(true)}
            >
              Retry <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}

        {/* Ideas grid */}
        {!loading && !error && ideas && (
          <div className="grid gap-3 sm:grid-cols-3">
            {ideas.map((idea, i) => (
              <div
                key={i}
                className="flex flex-col gap-2.5 rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
              >
                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    label={idea.platform}
                    className={PLATFORM_COLORS[idea.platform] ?? "bg-zinc-100 text-zinc-700"}
                  />
                  <Badge
                    label={idea.format}
                    className={FORMAT_COLORS[idea.format] ?? "bg-zinc-100 text-zinc-700"}
                  />
                </div>

                {/* Hook */}
                <p className="text-base font-semibold leading-snug flex-1">
                  &ldquo;{idea.hook}&rdquo;
                </p>

                {/* Reason */}
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                  Why: {idea.reason}
                </p>

                {/* CTA */}
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30 px-2"
                    onClick={() => handleCreate(idea.hook)}
                  >
                    Create this
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
