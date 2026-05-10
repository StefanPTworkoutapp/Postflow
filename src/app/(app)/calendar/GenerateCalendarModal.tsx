"use client"

import { useState } from "react"
import { Loader2, Sparkles, X, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PLATFORMS = [
  { id: "instagram", label: "Instagram", emoji: "📸", default: 4, recommended: 4, hint: "Recommended: 4×/week" },
  { id: "linkedin",  label: "LinkedIn",  emoji: "💼", default: 2, recommended: 2, hint: "Recommended: 2×/week" },
  { id: "facebook",  label: "Facebook",  emoji: "👥", default: 3, recommended: 3, hint: "Recommended: 3×/week" },
  { id: "tiktok",    label: "TikTok",    emoji: "🎵", default: 5, recommended: 5, hint: "Recommended: 5×/week" },
  { id: "x",         label: "X",         emoji: "✖",  default: 4, recommended: 4, hint: "Recommended: 4×/week" },
  { id: "threads",   label: "Threads",   emoji: "🧵", default: 3, recommended: 3, hint: "Recommended: 3×/week" },
]

const PILLARS = [
  { id: "education",   label: "Education",   desc: "Teach & inform",     color: "border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200" },
  { id: "motivation",  label: "Motivation",  desc: "Inspire & energise", color: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200" },
  { id: "community",   label: "Community",   desc: "Connect & engage",   color: "border-green-300 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200" },
  { id: "promotional", label: "Promotional", desc: "Services & results", color: "border-purple-300 bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200" },
]

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: "📸", linkedin: "💼", facebook: "👥",
  tiktok: "🎵", x: "✖", threads: "🧵",
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

interface Props {
  year:    number
  month:   number
  onClose: () => void
  onDone:  () => void
}

export function GenerateCalendarModal({ year, month, onClose, onDone }: Props) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "linkedin"])
  const [selectedPillars,   setSelectedPillars]   = useState<string[]>(["education", "motivation", "community", "promotional"])
  const [frequencies,       setFrequencies]       = useState<Record<string, number>>(
    Object.fromEntries(PLATFORMS.map(p => [p.id, p.default]))
  )
  const [shootingFrequency, setShootingFrequency] = useState<"weekly" | "monthly">("weekly")
  const [generating, setGenerating] = useState(false)
  const [result,     setResult]     = useState<{ count: number; summary: Record<string, number> } | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function togglePillar(id: string) {
    setSelectedPillars(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function adjustFreq(platform: string, delta: number) {
    setFrequencies(prev => ({
      ...prev,
      [platform]: Math.max(1, Math.min(7, (prev[platform] ?? 3) + delta)),
    }))
  }

  async function generate() {
    if (!selectedPlatforms.length) { setError("Select at least one platform."); return }
    if (!selectedPillars.length)   { setError("Select at least one content pillar."); return }
    setGenerating(true)
    setError(null)
    try {
      const res  = await fetch("/api/calendar/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          year, month,
          platforms: selectedPlatforms,
          pillars:   selectedPillars,
          frequencyOverrides: Object.fromEntries(
            selectedPlatforms.map(p => [p, frequencies[p]])
          ),
          shootingFrequency,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Generation failed"); return }
      setResult({ count: json.count, summary: json.summary ?? {} })
    } finally {
      setGenerating(false)
    }
  }

  const totalPosts = selectedPlatforms.reduce((sum, p) => sum + (frequencies[p] ?? 3), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-[hsl(var(--background))] rounded-2xl shadow-2xl border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="font-semibold text-sm">Generate {MONTH_NAMES[month - 1]} {year}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Tweak the frequency per platform — AI handles the topics
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          /* ── Success ── */
          <div className="px-6 py-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-5xl">🎉</div>
              <p className="font-semibold text-lg">{result.count} posts planned!</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Open any post to generate its caption.
              </p>
            </div>
            {Object.keys(result.summary).length > 0 && (
              <div className="rounded-xl border divide-y">
                {Object.entries(result.summary)
                  .sort((a, b) => b[1] - a[1])
                  .map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span>{PLATFORM_EMOJI[platform] ?? "📄"}</span>
                        <span className="capitalize">{platform}</span>
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))] font-medium">
                        {count} posts · ~{Math.round(count / 4.3 * 10) / 10}×/week
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <Button onClick={onDone} className="w-full">View calendar</Button>
          </div>
        ) : (
          /* ── Config ── */
          <div className="px-6 py-5 space-y-6 max-h-[72vh] overflow-y-auto">

            {/* Platforms + frequency */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Platforms & frequency</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Defaults are based on best practice — adjust to what works for you.
                </p>
              </div>

              <div className="space-y-2">
                {PLATFORMS.map(p => {
                  const selected = selectedPlatforms.includes(p.id)
                  const freq     = frequencies[p.id] ?? p.default
                  const isDefault = freq === p.recommended

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                        selected
                          ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20"
                          : "border-[hsl(var(--border))] opacity-50"
                      )}
                    >
                      {/* Toggle checkbox */}
                      <button
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className={cn(
                          "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-[hsl(var(--border))]"
                        )}
                      >
                        {selected && <span className="text-xs font-bold">✓</span>}
                      </button>

                      {/* Label */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span>{p.emoji}</span>
                        <span className="text-sm font-medium">{p.label}</span>
                        {!isDefault && selected && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">· recommended {p.recommended}×</span>
                        )}
                      </div>

                      {/* Frequency stepper */}
                      <div className={cn(
                        "flex items-center gap-1.5 shrink-0 transition-opacity",
                        !selected && "pointer-events-none"
                      )}>
                        <button
                          type="button"
                          onClick={() => adjustFreq(p.id, -1)}
                          disabled={!selected || freq <= 1}
                          className="w-6 h-6 rounded-md border flex items-center justify-center hover:bg-[hsl(var(--muted))] disabled:opacity-30 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-semibold w-8 text-center tabular-nums">
                          {freq}×/w
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustFreq(p.id, 1)}
                          disabled={!selected || freq >= 7}
                          className="w-6 h-6 rounded-md border flex items-center justify-center hover:bg-[hsl(var(--muted))] disabled:opacity-30 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Content pillars */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Content pillars</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">AI mixes these across the month.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PILLARS.map(p => {
                  const selected = selectedPillars.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePillar(p.id)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all",
                        selected ? p.color : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-xs opacity-70">{p.desc}</p>
                      </div>
                      {selected && <span className="text-xs font-bold ml-2">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Shooting frequency */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Shooting schedule</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Helps AI cluster media requirements so you shoot efficiently.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "weekly",  label: "Weekly shoots",  desc: "Spread out — fresh content each week",    emoji: "📅" },
                  { id: "monthly", label: "Batch shoot",    desc: "One shoot session covers the whole month", emoji: "🎬" },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setShootingFrequency(opt.id)}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                      shootingFrequency === opt.id
                        ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-700 dark:bg-indigo-950/30"
                        : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                    )}
                  >
                    <span className="text-lg mt-0.5">{opt.emoji}</span>
                    <div>
                      <p className="text-sm font-medium leading-tight">{opt.label}</p>
                      <p className="text-xs opacity-60 mt-0.5 leading-tight">{opt.desc}</p>
                    </div>
                    {shootingFrequency === opt.id && (
                      <span className="ml-auto text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
          </div>
        )}

        {/* Footer */}
        {!result && (
          <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-[hsl(var(--muted))]/20">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              ~{Math.round(totalPosts * 4.3)} posts total · existing posts kept
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={generating}>Cancel</Button>
              <Button size="sm" onClick={generate} disabled={generating} className="gap-1.5 min-w-[120px]">
                {generating
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Planning…</>
                  : <><Sparkles className="h-3.5 w-3.5" />Generate</>
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
