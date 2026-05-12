/**
 * ConceptCard — displays a single trend-aligned video concept.
 *
 * Shows:
 *   - Title + trending reason
 *   - Format description (pacing, duration, platform)
 *   - Sound vibe
 *   - Brand fit score bar
 *   - "Best match" badge on the highest-scoring card
 *   - [Build this →] CTA button
 *
 * Per spec §6.2:
 *   ⭐ Best match for your brand
 *   Fast montage + voiceover hook · Instagram Reel · 15–20s
 *   "Getting 3–5× normal reach in your niche this week."
 *   🎵 Sound vibe: upbeat electronic
 *   Brand fit ████████░░ 84%
 *   [Build this →]
 */

"use client"

import { Music, TrendingUp, Star, ChevronRight } from "lucide-react"
import { Button }  from "@/components/ui/button"
import { cn }      from "@/lib/utils"
import type { TrendConcept } from "@/lib/server/trends/trend-filter"

const PACING_LABELS: Record<string, string> = {
  fast:   "Fast montage",
  medium: "Steady paced",
  slow:   "Thoughtful paced",
}

const HOOK_LABELS: Record<string, string> = {
  fast_question:  "Question hook",
  bold_statement: "Bold statement",
  shock_stat:     "Stat hook",
  story_open:     "Story opener",
  list_tease:     "List tease",
  before_after:   "Before/after",
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram Reel",
  tiktok:    "TikTok Video",
  linkedin:  "LinkedIn Video",
  facebook:  "Facebook Reel",
  youtube:   "YouTube Short",
}

interface ConceptCardProps {
  concept:    TrendConcept & { id: string | null }
  isBestMatch: boolean
  onBuild:    () => void
  loading?:   boolean
  className?: string
}

export function ConceptCard({
  concept,
  isBestMatch,
  onBuild,
  loading = false,
  className,
}: ConceptCardProps) {
  const score   = concept.brand_fit_score
  const barFill = Math.round(score / 10)  // 0–10 blocks

  const scoreColor =
    score >= 75 ? "text-emerald-600 dark:text-emerald-400" :
    score >= 50 ? "text-amber-600 dark:text-amber-400"    : "text-rose-600 dark:text-rose-400"

  return (
    <div className={cn(
      "flex flex-col gap-4 rounded-xl border p-5 transition-all",
      isBestMatch
        ? "border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20"
        : "border-border bg-card hover:border-indigo-200",
      className,
    )}>
      {/* Best match badge */}
      {isBestMatch && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          <Star className="h-3.5 w-3.5 fill-current" />
          Best match for your brand
        </div>
      )}

      {/* Title + trending reason */}
      <div className="space-y-1">
        <h3 className="font-semibold text-base leading-snug">{concept.title}</h3>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
          <span className="italic">&ldquo;{concept.trending_reason}&rdquo;</span>
        </div>
      </div>

      {/* Format line */}
      <p className="text-sm text-muted-foreground">
        {PACING_LABELS[concept.format_spec.pacing] ?? concept.format_spec.pacing}
        {" + "}
        {HOOK_LABELS[concept.format_spec.hook_style] ?? concept.format_spec.hook_style}
        {" · "}
        {PLATFORM_LABELS[concept.platform] ?? concept.platform}
        {" · "}
        {concept.format_spec.duration_sec}s
      </p>

      {/* Hook text */}
      {concept.hook_text && (
        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium">
          &ldquo;{concept.hook_text}&rdquo;
        </div>
      )}

      {/* Sound vibe */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Music className="h-3.5 w-3.5 shrink-0" />
        Sound vibe: <span className="font-medium text-foreground ml-0.5">{concept.sound_vibe}</span>
      </div>

      {/* Brand fit bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Brand fit</span>
          <span className={cn("font-semibold tabular-nums", scoreColor)}>{score}%</span>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < barFill
                  ? score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-rose-400"
                  : "bg-zinc-200 dark:bg-zinc-700",
              )}
            />
          ))}
        </div>
      </div>

      {/* Build CTA */}
      <Button
        onClick={onBuild}
        disabled={loading}
        size="sm"
        className="w-full mt-1 gap-1.5"
        variant={isBestMatch ? "default" : "outline"}
      >
        Build this
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
