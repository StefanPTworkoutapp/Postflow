"use client"

import { useState } from "react"
import { Lock, Unlock, TrendingUp, TrendingDown, Minus, LayoutTemplate, AlertCircle } from "lucide-react"
import { TemplateSuggestionCard, type TemplateSuggestion } from "@/components/shared/TemplateSuggestionCard"
import { PlatformBadge } from "@/components/shared/PlatformBadge"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateHealth {
  id:             string
  platform:       string
  template_slug:  string
  health_score:   number
  posts_count:    number
  trend:          string
  last_checked_at: string | null
  locked_by_user: boolean
  mode:           string
}

interface Props {
  brandId:        string
  templateHealth: TemplateHealth[]
  suggestions:    TemplateSuggestion[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "rising")   return <TrendingUp  className="h-3.5 w-3.5 text-green-500" />
  if (trend === "declining") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  if (trend === "stable")   return <Minus        className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
  return null  // insufficient_data
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-green-500" : score >= 45 ? "bg-amber-400" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn(
        "tabular-nums text-xs font-semibold w-7 text-right",
        score >= 75 ? "text-green-600 dark:text-green-400" :
        score >= 45 ? "text-amber-600 dark:text-amber-400" :
                      "text-red-600 dark:text-red-400"
      )}>
        {score}
      </span>
    </div>
  )
}

function templateLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days < 1) return "today"
  return `${days}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TemplatesClient({ templateHealth, suggestions }: Props) {
  const [activeSuggestions, setActiveSuggestions] = useState<TemplateSuggestion[]>(suggestions)

  function handleSuggestionResponse(id: string) {
    setActiveSuggestions(prev => prev.filter(s => s.id !== id))
  }

  const hasSuggestions = activeSuggestions.length > 0
  const hasHealth      = templateHealth.length > 0

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <LayoutTemplate className="h-6 w-6 text-indigo-500" />
          Templates
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Track how your templates perform across platforms. PostFlow suggests improvements when better alternatives exist.
        </p>
      </div>

      {/* Suggestions */}
      {hasSuggestions && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-sm">
              {activeSuggestions.length} improvement suggestion{activeSuggestions.length !== 1 ? "s" : ""}
            </h2>
          </div>
          {activeSuggestions.map(s => (
            <TemplateSuggestionCard
              key={s.id}
              suggestion={s}
              onRespond={handleSuggestionResponse}
            />
          ))}
        </section>
      )}

      {/* Health grid */}
      {hasHealth ? (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm text-[hsl(var(--muted-foreground))]">
            Template health
          </h2>
          <div className="rounded-xl border divide-y">
            {templateHealth.map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center gap-4">
                {/* Platform icon */}
                <PlatformBadge platform={t.platform} variant="icon" />

                {/* Template info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{templateLabel(t.template_slug)}</p>
                    <TrendIcon trend={t.trend} />
                    {t.locked_by_user && (
                      <span title="Locked by you">
                        <Lock className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                      </span>
                    )}
                  </div>
                  <HealthBar score={t.health_score} />
                  <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{t.posts_count} post{t.posts_count !== 1 ? "s" : ""}</span>
                    {t.last_checked_at && <span>Checked {relativeTime(t.last_checked_at)}</span>}
                    {t.trend === "insufficient_data" && (
                      <span className="italic">Collecting data…</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border p-8 text-center space-y-2">
          <LayoutTemplate className="h-8 w-8 text-[hsl(var(--muted-foreground))] mx-auto" />
          <p className="text-sm font-medium">No template data yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
            Template health scores appear once you have posted content. PostFlow checks performance every 6 hours.
          </p>
        </section>
      )}

      {/* How it works */}
      <section className="rounded-xl bg-[hsl(var(--muted))]/40 px-4 py-4 space-y-2">
        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          How it works
        </p>
        <ul className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
          <li>• Health scores compare your template performance to your niche benchmarks (0–100)</li>
          <li>• Scores above 75 are healthy · 45–74 needs attention · below 45 PostFlow may suggest alternatives</li>
          <li>• PostFlow only suggests a change when a better template exists and you have enough data (≥5 posts)</li>
          <li>• Lock a template to stop PostFlow suggesting alternatives for it</li>
        </ul>
      </section>
    </div>
  )
}
