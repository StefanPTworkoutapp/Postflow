"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, Trash2, ArrowLeft, Paperclip, ImageIcon, Download, LayoutTemplate } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { MediaPicker, AttachedMedia } from "@/components/media/MediaPicker"
import { CarouselBuilder } from "@/features/carousel/CarouselBuilder"

// ── Template definitions (client-safe subset — no buildHtml) ──────────────────
interface TemplateMeta {
  slug:        string
  name:        string
  description: string
  type:        "single_image" | "carousel" | "reel_cover" | "story"
}

const ALL_TEMPLATES: TemplateMeta[] = [
  { slug: "photo-overlay",  name: "Photo with Caption",      description: "Full-bleed photo + gradient overlay",         type: "single_image" },
  { slug: "edu-bold",       name: "Education — Bold",        description: "Large bold text on white",                    type: "single_image" },
  { slug: "quote-card",     name: "Quote / Motivation",      description: "Brand colour background, centered quote",     type: "single_image" },
  { slug: "dark-statement", name: "Dark Statement",          description: "Dark bg, bold white headline",                type: "single_image" },
  { slug: "tip-numbered",   name: "Numbered Tip",            description: "Big number in brand colour",                  type: "single_image" },
  { slug: "carousel-edu",   name: "Carousel — Educational",  description: "Hook + content + CTA slides",                 type: "carousel"     },
  { slug: "carousel-myth",  name: "Carousel — Myth vs Reality", description: "Dark myth / brand-colour reality pairs",   type: "carousel"     },
  { slug: "reel-cover",     name: "Reel Cover",              description: "9:16 bold text over photo",                   type: "reel_cover"   },
  { slug: "story-teaser",   name: "Story Teaser",            description: "Vertical story with swipe-up CTA",            type: "story"        },
]

const TYPE_BADGE: Record<TemplateMeta["type"], string> = {
  single_image: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  carousel:     "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  reel_cover:   "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  story:        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
}

const TYPE_LABEL: Record<TemplateMeta["type"], string> = {
  single_image: "Single image",
  carousel:     "Carousel",
  reel_cover:   "Reel cover",
  story:        "Story",
}

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: "📸",
  linkedin:  "💼",
  facebook:  "👥",
  tiktok:    "🎵",
  x:         "✖",
  threads:   "🧵",
}

const STATUS_STEPS = [
  { value: "draft",     label: "Draft",      activeClass: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",  doneClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 line-through" },
  { value: "planned",   label: "Planned",    activeClass: "bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200", doneClass: "bg-amber-50 text-amber-400 dark:bg-amber-950/30 dark:text-amber-600" },
  { value: "ready",     label: "Ready",      activeClass: "bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-200",  doneClass: "bg-green-50 text-green-400 dark:bg-green-950/30 dark:text-green-600" },
  { value: "scheduled", label: "Scheduled",  activeClass: "bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",    doneClass: "bg-blue-50 text-blue-400 dark:bg-blue-950/30 dark:text-blue-600" },
]
const STATUS_ORDER = STATUS_STEPS.map(s => s.value)

interface SlideContentItem {
  headline:  string
  body?:     string
  is_hook?:  boolean
  is_cta?:   boolean
  mediaUrl?: string | null
}

interface Post {
  id:                  string
  platform:            string
  caption:             string
  hashtags:            string[]
  cta:                 string | null
  status:              string
  media_ids:           string[]
  template_slug:       string | null
  slide_content:       SlideContentItem[] | null
  carousel_image_urls: string[] | null
  content_calendar:    {
    id?: string
    scheduled_date?: string
    topic?: string
    media_brief?: string | null
    required_media_type?: string | null
    media_urls?: string[] | null
  } | null
}

interface Props {
  post:      Post
  brandName: string
  industry:  string
}

export function PostEditor({ post, brandName, industry }: Props) {
  const router = useRouter()

  const [caption,       setCaption]       = useState(post.caption ?? "")
  const [hashtags,      setHashtags]      = useState<string[]>(post.hashtags ?? [])
  const [cta,           setCta]           = useState(post.cta ?? "")
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [status,        setStatus]        = useState(post.status)
  const [scheduledDate, setScheduledDate] = useState(
    post.content_calendar?.scheduled_date ?? new Date().toISOString().split("T")[0]
  )
  const [topic,     setTopic]     = useState(post.content_calendar?.topic ?? "")
  const [mediaIds,  setMediaIds]  = useState<string[]>(post.media_ids ?? [])
  const [showPicker, setShowPicker] = useState(false)
  const [feedback,    setFeedback]    = useState("")
  const [saving,      setSaving]      = useState(false)
  const [scheduling,  setScheduling]  = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState<{ type: "success" | "warn"; text: string } | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [regen,       setRegen]       = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)
  const [rendering,     setRendering]     = useState(false)
  const [imageUrl,      setImageUrl]      = useState<string | null>(
    (post as unknown as { generated_image_url?: string | null }).generated_image_url ?? null
  )
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null)
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    // Default new posts (no template yet) to photo-overlay — the most versatile Instagram format
    post.template_slug ?? "photo-overlay"
  )
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [carouselImageUrls, setCarouselImageUrls] = useState<string[]>(
    post.carousel_image_urls ?? []
  )
  const [variants, setVariants] = useState<Array<{ templateSlug: string; templateName: string; imageUrl: string }>>([])
  const [renderingVariants, setRenderingVariants] = useState(false)
  const [variantError, setVariantError] = useState<string | null>(null)
  // Live slide content — may differ from post.slide_content when converting on the fly
  const [slideContent, setSlideContent] = useState<SlideContentItem[] | undefined>(
    post.slide_content ?? undefined
  )
  const [converting, setConverting] = useState(false)

  // Auto-generate caption when post was just created from calendar (no caption yet)
  useEffect(() => {
    if (post.caption || !post.content_calendar?.topic) return
    const topic = post.content_calendar.topic
    setAutoGenerating(true)
    fetch("/api/posts/generate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: "edu-tips",
        platform:    post.platform,
        topic,
      }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.caption) {
          setCaption(json.caption)
          setHashtags(json.hashtags ?? [])
          setCta(json.cta ?? "")
        }
      })
      .catch(() => { /* silently skip — user can regenerate manually */ })
      .finally(() => setAutoGenerating(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  // Pass the new status explicitly to avoid React state batching race conditions
  async function handleSave(overrideStatus?: string) {
    const effectiveStatus = overrideStatus ?? status
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          hashtags,
          cta:            cta || null,
          status:         effectiveStatus,
          scheduled_date: scheduledDate,
          topic:          topic || null,
          media_ids:      mediaIds,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Save failed"); return }
      setStatus(effectiveStatus)
      setSaved(true)
      router.refresh() // invalidate server cache so /posts list reflects new status
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function handleSchedule() {
    setScheduling(true)
    setError(null)
    setScheduleMsg(null)
    try {
      // 1. Save & promote to "scheduled" first
      const saveRes = await fetch(`/api/posts/${post.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          hashtags,
          cta:            cta || null,
          status:         "scheduled",
          scheduled_date: scheduledDate,
          topic:          topic || null,
          media_ids:      mediaIds,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) { setError(saveJson.error ?? "Save failed"); return }
      setStatus("scheduled")
      router.refresh()

      // 2. Push to Buffer
      const bufRes = await fetch("/api/buffer/schedule", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id }),
      })
      const bufJson = await bufRes.json()

      if (bufRes.ok) {
        setScheduleMsg({ type: "success", text: "✅ Sent to Buffer! It will auto-publish at the scheduled time." })
      } else {
        // Buffer not connected or other soft error — post is still saved as "scheduled"
        const msg = bufJson.error ?? "Buffer not connected."
        setScheduleMsg({ type: "warn", text: `⚠️ Post saved as scheduled, but Buffer push failed: ${msg} Connect Buffer in Settings to auto-publish.` })
      }
    } finally {
      setScheduling(false)
    }
  }

  async function handleRegenerate() {
    setRegen(true)
    setError(null)
    try {
      const res = await fetch("/api/posts/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Re-use the stored topic; platform; no template (already drafted)
          template_id:       "edu-tips", // fallback — caption will override tone
          platform:          post.platform,
          topic:             topic || post.content_calendar?.topic || "general content",
          previous_feedback: feedback || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? "Regeneration failed"); return }
      setCaption(json.caption)
      setHashtags(json.hashtags ?? [])
      setCta(json.cta ?? "")
      setFeedback("")
    } finally {
      setRegen(false)
    }
  }

  async function handleRender() {
    setRendering(true)
    setError(null)
    try {
      // Save latest edits first so the render uses current caption/hashtags
      const saveRes = await fetch(`/api/posts/${post.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags, cta: cta || null, status, scheduled_date: scheduledDate, topic: topic || null, media_ids: mediaIds }),
      })
      if (!saveRes.ok) { const j = await saveRes.json(); setError(j.error ?? "Save failed before render"); return }

      const res  = await fetch(`/api/posts/${post.id}/render`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ templateSlug: selectedTemplate ?? undefined }),
      })
      let json: Record<string, unknown> = {}
      try { json = await res.json() } catch { /* empty body */ }
      if (!res.ok || !json.image_url) { setError((json.error as string) ?? "Render failed"); return }
      setImageUrl(json.image_url + "?t=" + Date.now())
      setVariants([]) // clear variants when single render is done
    } finally {
      setRendering(false)
    }
  }

  async function handleRenderVariants() {
    setRenderingVariants(true)
    setVariantError(null)
    setVariants([])
    try {
      // Save latest edits first
      const saveRes = await fetch(`/api/posts/${post.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags, cta: cta || null, status, scheduled_date: scheduledDate, topic: topic || null, media_ids: mediaIds }),
      })
      if (!saveRes.ok) { const j = await saveRes.json(); setVariantError(j.error ?? "Save failed"); return }

      const res  = await fetch(`/api/posts/${post.id}/render-variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({}),
      })
      let json: Record<string, unknown> = {}
      try { json = await res.json() } catch { /* empty body — route may have timed out */ }
      if (!res.ok || !(json.variants as unknown[])?.length) {
        setVariantError((json.error as string) ?? "Variant render failed (timeout or crash — try again)")
        return
      }
      setVariants(json.variants as { templateSlug: string; templateName: string; imageUrl: string }[])
    } finally {
      setRenderingVariants(false)
    }
  }

  async function handleSelectVariant(templateSlug: string, imageUrl: string) {
    // Apply the chosen variant: set as selected template + save the rendered image
    setSelectedTemplate(templateSlug)
    setImageUrl(imageUrl.split("?")[0] + "?t=" + Date.now())
    setVariants([])
    // Persist template_slug and generated_image_url to the post
    await fetch(`/api/posts/${post.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_slug: templateSlug }),
    })
  }

  /**
   * Switch template — converts content to match the new format via AI.
   * - any → carousel:      convert caption into slides
   * - carousel → any:      flatten slides back into a caption
   * - carousel → carousel: re-convert for the new carousel type
   * - single → single:     just swap the visual style, no content change needed
   */
  async function handleTemplateChange(newSlug: string) {
    const prevType = selectedTemplate ? ALL_TEMPLATES.find(t => t.slug === selectedTemplate)?.type : null
    const newType  = ALL_TEMPLATES.find(t => t.slug === newSlug)?.type

    setSelectedTemplate(newSlug)
    setShowTemplatePicker(false)

    const switchingToCarousel   = newType === "carousel"
    const switchingFromCarousel = prevType === "carousel" && newType !== "carousel"
    const switchingCarouselType = prevType === "carousel" && newType === "carousel" && selectedTemplate !== newSlug
    const hasCaption            = caption.trim().length > 0
    const alreadyHasSlides      = slideContent && slideContent.length > 0

    const needsConversion =
      (switchingToCarousel && hasCaption && (!alreadyHasSlides || switchingCarouselType)) ||
      (switchingFromCarousel && alreadyHasSlides)

    if (!needsConversion) return

    setConverting(true)
    try {
      const res  = await fetch(`/api/posts/${post.id}/convert-format`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ templateSlug: newSlug }),
      })
      const json = await res.json()
      if (!res.ok) return

      if (switchingToCarousel && json.slide_content?.length) {
        setSlideContent(json.slide_content as SlideContentItem[])
      }
      if (switchingFromCarousel && json.caption) {
        setCaption(json.caption)
        if (json.hashtags) setHashtags(json.hashtags)
        if (json.cta)      setCta(json.cta)
        setSlideContent(undefined)
      }
    } catch { /* user can edit manually */ }
    finally  { setConverting(false) }
  }

  async function handleFeedback(type: string) {
    setFeedbackSending(true)
    try {
      await fetch(`/api/posts/${post.id}/feedback`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ feedback_type: type }),
      })
      setFeedbackGiven(type)
    } finally {
      setFeedbackSending(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? "Delete failed")
        return
      }
      router.push("/posts")
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link + header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/posts"
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Posts
          </Link>
          {/* Go back to brief/setup — useful when coming from "New post" */}
          {!post.content_calendar && (
            <Link
              href="/posts/new"
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors underline underline-offset-2"
            >
              ← Change brief
            </Link>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl">{PLATFORM_EMOJI[post.platform] ?? "📄"}</span>
        <div>
          <h1 className="text-xl font-semibold capitalize">{post.platform} post</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {topic || "No topic set"}
          </p>
        </div>
      </div>

      {/* Status progression */}
      <div className="space-y-1.5">
        <Label>Status</Label>
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const currentIdx = STATUS_ORDER.indexOf(status)
            const stepIdx    = i
            const isActive   = status === step.value
            const isDone     = stepIdx < currentIdx
            const isLast     = i === STATUS_STEPS.length - 1

            return (
              <div key={step.value} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setStatus(step.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-colors border-y border-l",
                    i === 0 && "rounded-l-full border-l",
                    isLast && "rounded-r-full border-r",
                    isActive && `${step.activeClass} border-transparent ring-2 ring-offset-1 ring-current z-10 relative`,
                    isDone  && `${step.doneClass} border-[hsl(var(--border))]`,
                    !isActive && !isDone && "bg-[hsl(var(--muted))]/30 text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                  )}
                >
                  {isDone ? `✓ ${step.label}` : step.label}
                </button>
                {!isLast && (
                  <span className={cn(
                    "w-3 h-0.5 shrink-0",
                    stepIdx < currentIdx ? "bg-zinc-300 dark:bg-zinc-600" : "bg-[hsl(var(--border))]"
                  )} />
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Click a step to change status. Completed steps are ticked.</p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Topic</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What is this post about?"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Schedule date</Label>
          <Input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
      </div>

      {/* Media brief from calendar entry */}
      {post.content_calendar?.media_brief && post.content_calendar.required_media_type !== "none" && (() => {
        const mt = post.content_calendar.required_media_type
        const cfg =
          mt === "video"    ? { border: "border-rose-200 dark:border-rose-800",     bg: "bg-rose-50/60 dark:bg-rose-950/20",       label: "🎬 Video brief",          text: "text-rose-900 dark:text-rose-200",     head: "text-rose-800 dark:text-rose-300" } :
          mt === "carousel" ? { border: "border-indigo-200 dark:border-indigo-800", bg: "bg-indigo-50/60 dark:bg-indigo-950/20",   label: "🖼 Carousel — slide guide", text: "text-indigo-900 dark:text-indigo-200", head: "text-indigo-800 dark:text-indigo-300" } :
          mt === "stock"    ? { border: "border-zinc-200 dark:border-zinc-700",     bg: "bg-zinc-50 dark:bg-zinc-900",             label: "🌐 Source online",          text: "text-zinc-700 dark:text-zinc-300",     head: "text-zinc-600 dark:text-zinc-400" } :
                              { border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-50/60 dark:bg-orange-950/20",   label: "📷 Photo brief",            text: "text-orange-900 dark:text-orange-200", head: "text-orange-800 dark:text-orange-300" }
        return (
        <div className={`rounded-xl border px-4 py-3 space-y-2 ${cfg.border} ${cfg.bg}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.head}`}>{cfg.label}</p>
          <p className={`text-sm leading-relaxed ${cfg.text}`}>{post.content_calendar.media_brief}</p>
          {/* Uploaded media thumbnails from the calendar entry */}
          {(post.content_calendar.media_urls ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(post.content_calendar.media_urls ?? []).map((url, i) => {
                const isVideo = /\.(mp4|mov|webm|avi|mkv)$/i.test(url)
                return isVideo ? (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                     className={`flex items-center gap-1.5 rounded-lg border bg-white dark:bg-zinc-900 px-3 py-2 text-xs hover:opacity-80 transition-opacity ${cfg.head}`}>
                    🎬 Video {i + 1}
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Upload ${i + 1}`}
                         className={`h-20 w-20 rounded-lg border object-cover hover:opacity-80 transition-opacity ${cfg.border}`} />
                  </a>
                )
              })}
              <p className={`w-full text-[10px] ${cfg.head}`}>
                ↑ Uploaded from the calendar list — use these when creating the post.
              </p>
            </div>
          )}
        </div>
        )
      })()}

      {/* Template picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Card template
          </Label>
          <button
            type="button"
            onClick={() => setShowTemplatePicker(v => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            {showTemplatePicker ? "Hide templates" : selectedTemplate
              ? `Change (${ALL_TEMPLATES.find(t => t.slug === selectedTemplate)?.name ?? selectedTemplate})`
              : "Choose template"}
          </button>
        </div>

        {/* Currently selected badge */}
        {selectedTemplate && !showTemplatePicker && (() => {
          const t = ALL_TEMPLATES.find(t => t.slug === selectedTemplate)
          if (!t) return null
          return (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/20 px-3 py-2">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded", TYPE_BADGE[t.type])}>
                {TYPE_LABEL[t.type]}
              </span>
              <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">{t.name}</span>
              <span className="text-xs text-indigo-600/70 dark:text-indigo-400">{t.description}</span>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="ml-auto text-xs text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200"
                title="Remove template"
              >
                ✕
              </button>
            </div>
          )
        })()}

        {/* No template selected */}
        {!selectedTemplate && !showTemplatePicker && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No template selected — "Generate card" will use the default brand card.
          </p>
        )}

        {/* Template grid */}
        {showTemplatePicker && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mt-1">
            {ALL_TEMPLATES.map((t) => {
              const isSelected = selectedTemplate === t.slug
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => handleTemplateChange(t.slug)}
                  className={cn(
                    "text-left rounded-xl border p-3 space-y-1.5 transition-all",
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-400"
                      : "border-[hsl(var(--border))] hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10"
                  )}
                >
                  <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded", TYPE_BADGE[t.type])}>
                    {TYPE_LABEL[t.type]}
                  </span>
                  <p className="text-xs font-semibold leading-tight">{t.name}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">{t.description}</p>
                  {isSelected && <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">✓ Selected</p>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Carousel builder — shown when a carousel template is selected */}
      {selectedTemplate && ALL_TEMPLATES.find(t => t.slug === selectedTemplate)?.type === "carousel" && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/10 p-4">
          {converting ? (
            <div className="flex items-center justify-center gap-2.5 py-8 text-indigo-600 dark:text-indigo-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Converting your content into slides…</span>
            </div>
          ) : (
            <CarouselBuilder
              key={selectedTemplate}
              templateSlug={selectedTemplate}
              postId={post.id}
              captionFirstLine={caption.split("\n").filter(Boolean)[0] ?? ""}
              ctaValue={cta}
              initialSlideContent={slideContent}
              onRendered={(urls) => {
                setImageUrl(urls[0] ?? null)
                setCarouselImageUrls(urls)
              }}
            />
          )}
        </div>
      )}

      {/* Caption + Preview */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Caption</Label>
              {autoGenerating && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Writing caption…
                </span>
              )}
            </div>
            <textarea
              rows={12}
              className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] resize-y"
              value={autoGenerating ? "" : caption}
              placeholder={autoGenerating ? "Writing your caption with AI…" : ""}
              disabled={autoGenerating}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Hashtags <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(comma-separated)</span></Label>
            <Input
              value={hashtags.join(", ")}
              onChange={(e) =>
                setHashtags(
                  e.target.value.split(",").map((h) => h.trim().replace(/^#/, "")).filter(Boolean)
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>CTA <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(optional)</span></Label>
            <Input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Call-to-action line"
            />
          </div>

          {/* Media */}
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label>Attached media</Label>
              <button
                type="button"
                onClick={() => setShowPicker(v => !v)}
                className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {showPicker ? "Hide picker" : mediaIds.length ? "Change" : "Attach media"}
              </button>
            </div>

            <AttachedMedia
              mediaIds={mediaIds}
              onRemove={(id) => setMediaIds(prev => prev.filter(x => x !== id))}
            />

            {showPicker && (
              <MediaPicker
                selected={mediaIds}
                onChange={setMediaIds}
                className="mt-2"
              />
            )}
          </div>

          {/* Tone feedback */}
          <div className="space-y-2 pt-1 border-t">
            <Label>Rate this caption</Label>
            {feedbackGiven ? (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Thanks — this helps PostFlow learn your voice.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { type: "great",       label: "👍 Loved it"      },
                  { type: "too_formal",  label: "🎩 Too formal"    },
                  { type: "too_casual",  label: "😅 Too casual"    },
                  { type: "wrong_voice", label: "🎭 Wrong voice"   },
                  { type: "cta_weak",    label: "📉 Weak CTA"      },
                ].map(fb => (
                  <button
                    key={fb.type}
                    type="button"
                    disabled={feedbackSending}
                    onClick={() => handleFeedback(fb.type)}
                    className="px-2.5 py-1 text-xs rounded-full border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
                  >
                    {fb.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Regenerate */}
          <div className="space-y-1.5 pt-1 border-t">
            <Label>Feedback for regeneration <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(optional)</span></Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. shorter, more casual, focus on pain relief"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={regen}
                onClick={handleRegenerate}
                className="shrink-0 gap-1.5"
              >
                {regen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate
              </Button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Preview</Label>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRender}
                disabled={rendering || renderingVariants}
                className="gap-1.5 text-xs"
              >
                {rendering
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Rendering…</>
                  : <><ImageIcon className="h-3.5 w-3.5" />{imageUrl ? "Re-render" : "Generate card"}</>
                }
              </Button>
              {/* Variant picker — only for single-image templates */}
              {(!selectedTemplate || ALL_TEMPLATES.find(t => t.slug === selectedTemplate)?.type !== "carousel") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRenderVariants}
                  disabled={rendering || renderingVariants}
                  className="gap-1.5 text-xs text-[hsl(var(--muted-foreground))]"
                  title="Render 3 template variants to compare"
                >
                  {renderingVariants
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Comparing…</>
                    : <><LayoutTemplate className="h-3.5 w-3.5" />Try 3 styles</>
                  }
                </Button>
              )}
            </div>
          </div>

          {/* Variant error */}
          {variantError && (
            <p className="text-xs text-[hsl(var(--destructive))]">{variantError}</p>
          )}

          {/* 3-up variant picker */}
          {variants.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Pick a style — click to use:</p>
              <div className="grid grid-cols-3 gap-2">
                {variants.map((v) => (
                  <button
                    key={v.templateSlug}
                    onClick={() => handleSelectVariant(v.templateSlug, v.imageUrl)}
                    className="group relative rounded-lg border-2 border-transparent hover:border-indigo-500 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.imageUrl} alt={v.templateName} className="w-full h-auto" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] font-medium py-1 text-center translate-y-full group-hover:translate-y-0 transition-transform">
                      {v.templateName}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setVariants([])}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Rendered PNG */}
          {imageUrl && variants.length === 0 ? (
            <div className="space-y-2">
              <div className="rounded-xl border overflow-hidden shadow-sm bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Rendered post card"
                  className="w-full h-auto max-h-[480px] object-contain"
                />
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))] flex-1">{caption.length} characters</p>
                <a
                  href={imageUrl}
                  download={`post-${post.platform}-${post.id.slice(0, 8)}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </a>
              </div>
            </div>
          ) : (
            /* Text preview fallback */
            <div className="rounded-xl border bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-sm min-h-[200px]">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                {post.platform}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{caption}</p>
              {hashtags.length > 0 && (
                <p className="text-xs text-indigo-500">
                  {hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
              <p className="text-xs text-[hsl(var(--muted-foreground))] pt-2 border-t">
                Click <strong>Generate card</strong> to render a branded image for this post.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}

      {/* Save */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </Button>

          {/* Draft → Plan */}
          {status === "draft" && (
            <Button variant="outline" onClick={() => handleSave("planned")} disabled={saving}>
              📅 Plan it
            </Button>
          )}

          {/* Draft / Planned → Ready */}
          {(status === "draft" || status === "planned") && (
            <Button variant="outline" onClick={() => handleSave("ready")} disabled={saving}>
              Mark as ready ✓
            </Button>
          )}

          {/* Ready → Scheduled */}
          {status === "ready" && (
            <Button onClick={handleSchedule} disabled={saving || scheduling} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {scheduling
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Scheduling…</>
                : carouselImageUrls.length > 0
                  ? `Schedule ${carouselImageUrls.length} slides to Buffer →`
                  : "Schedule post →"}
            </Button>
          )}

          {/* Step back */}
          {(status === "planned" || status === "ready" || status === "scheduled") && (
            <Button
              variant="ghost"
              onClick={() => handleSave(status === "scheduled" ? "ready" : status === "ready" ? "planned" : "draft")}
              disabled={saving}
              className="text-[hsl(var(--muted-foreground))] ml-auto"
            >
              ← Move back
            </Button>
          )}
        </div>

        {/* Carousel render reminder */}
        {selectedTemplate && ALL_TEMPLATES.find(t => t.slug === selectedTemplate)?.type === "carousel" && carouselImageUrls.length === 0 && (
          <p className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            ⚠️ Render your carousel slides above before scheduling — Buffer needs the images.
          </p>
        )}

        {/* Carousel rendered confirmation */}
        {carouselImageUrls.length > 0 && (
          <p className="text-xs rounded-lg px-3 py-2 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400">
            ✅ {carouselImageUrls.length} carousel slides ready — they&apos;ll be sent to Buffer as a multi-image post.
          </p>
        )}

        {/* Buffer schedule feedback */}
        {scheduleMsg && (
          <p className={cn(
            "text-xs rounded-lg px-3 py-2",
            scheduleMsg.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
          )}>
            {scheduleMsg.text}
          </p>
        )}
        {status === "scheduled" && !scheduleMsg && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/40 rounded-lg px-3 py-2">
            📌 This post is scheduled. If Buffer is connected, it will auto-publish at the scheduled time.
          </p>
        )}
      </div>
    </div>
  )
}
