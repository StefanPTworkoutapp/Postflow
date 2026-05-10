"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DEFAULT_TEMPLATES, type PostTemplate, type Platform } from "@/lib/shared/posts/templates"
import { MediaPicker } from "@/components/media/MediaPicker"

const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { value: "facebook",  label: "Facebook",  emoji: "👥" },
  { value: "tiktok",    label: "TikTok",    emoji: "🎵" },
  { value: "threads",   label: "Threads",   emoji: "🧵" },
  { value: "x",         label: "X",         emoji: "✖" },
]

type Step = "template" | "brief"

export function PostCreator() {
  const router = useRouter()

  const [platform, setPlatform] = useState<Platform>("instagram")
  const [template, setTemplate] = useState<PostTemplate | null>(null)
  const [topic,    setTopic]    = useState("")
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [step,     setStep]     = useState<Step>("template")
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const filteredTemplates = DEFAULT_TEMPLATES.filter(t => t.best_for.includes(platform))

  /** Save draft immediately → PostEditor handles generation */
  async function handleCreate() {
    if (!template || !topic.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/posts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          platform,
          template_id:    template.id,
          caption:        null,   // PostEditor auto-generates this
          hashtags:       [],
          cta:            null,
          scheduled_date: scheduledDate,
          topic,
          media_ids:      mediaIds,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? "Failed to create post"); return }
      router.push(`/posts/${json.post?.id ?? json.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Step 1: Platform + Post type ── */}
      {step === "template" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setPlatform(value); setTemplate(null) }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm border transition-colors flex items-center gap-1.5",
                    platform === value
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "border-[hsl(var(--border))] hover:border-indigo-300"
                  )}
                >
                  <span>{emoji}</span>{label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Post type</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t)}
                  className={cn(
                    "text-left rounded-xl border-2 p-4 transition-colors",
                    template?.id === t.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                      : "border-[hsl(var(--border))] hover:border-indigo-300"
                  )}
                >
                  <p className={cn("font-medium text-sm", template?.id === t.id && "text-indigo-700 dark:text-indigo-300")}>
                    {t.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{t.description}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">
                    {t.media_count === 0 ? "Text only" : `${t.media_count} image${t.media_count > 1 ? "s" : ""}`}
                    {" · "}
                    {t.hashtag_count.min}–{t.hashtag_count.max} hashtags
                  </p>
                </button>
              ))}
            </div>
          </div>

          <Button disabled={!template} onClick={() => setStep("brief")}>
            Continue →
          </Button>
        </div>
      )}

      {/* ── Step 2: Brief ── */}
      {step === "brief" && (
        <div className="space-y-5 max-w-lg">
          {/* Recap of step 1 — clickable to go back */}
          <button
            type="button"
            onClick={() => setStep("template")}
            className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            ← <span className="font-medium">{PLATFORMS.find(p => p.value === platform)?.emoji} {PLATFORMS.find(p => p.value === platform)?.label}</span>
            <span className="text-[hsl(var(--muted-foreground))]/60">·</span>
            <span>{template?.name}</span>
            <span className="text-xs underline underline-offset-2 ml-1">Change</span>
          </button>

          <div className="space-y-1.5">
            <Label>What is this post about? *</Label>
            <textarea
              rows={3}
              className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              placeholder="e.g. 3 exercises to relieve lower back pain after sitting all day"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Schedule date <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span></Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="max-w-[200px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Attach media <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span></Label>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Pick photos or videos from your media library to attach to this post.
            </p>
            <MediaPicker
              selected={mediaIds}
              onChange={setMediaIds}
              max={template?.media_count ?? 10}
            />
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              disabled={!topic.trim() || saving}
              onClick={handleCreate}
              className="gap-2"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
                : "Create post →"
              }
            </Button>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            AI writes the caption in the next step — you can edit and re-generate freely.
          </p>
        </div>
      )}
    </div>
  )
}
