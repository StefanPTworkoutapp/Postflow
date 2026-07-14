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
  /** Platform-dedicated templates; undefined = available on all platforms. */
  platforms?:  string[]
}

// KEEP IN SYNC with the render registry (src/lib/server/render/templates/index.ts)
// and the postflow.templates DB seed — a slug missing here is invisible in the
// editor's picker even when the server-side rotation can select it.
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
  { slug: "x-statement",      name: "X — Statement",         description: "Bold statement card native to X",             type: "single_image", platforms: ["x"] },
  { slug: "linkedin-insight", name: "LinkedIn — Insight",    description: "Professional insight/pull-quote card",        type: "single_image", platforms: ["linkedin"] },
  { slug: "tiktok-cover",     name: "TikTok — Photo Cover",  description: "Vertical gradient cover with hook headline",  type: "single_image", platforms: ["tiktok"] },
]

/**
 * Maps a render template slug → caption template id + post_type.
 * This bridges the two template systems:
 *   - render templates (slugs) control how the image looks
 *   - caption templates (ids) control how the caption is generated
 * Both need to be passed to /api/posts/generate for correct output.
 */
const RENDER_TO_CAPTION: Record<string, { captionId: string; postType: string }> = {
  "photo-overlay":  { captionId: "edu-tips",       postType: "single_image" },
  "edu-bold":       { captionId: "edu-tips",       postType: "single_image" },
  "quote-card":     { captionId: "quote-insight",  postType: "single_image" },
  "dark-statement": { captionId: "myth-bust",      postType: "single_image" },
  "tip-numbered":   { captionId: "edu-tips",       postType: "single_image" },
  "carousel-edu":   { captionId: "carousel-edu",   postType: "carousel"     },
  "carousel-myth":  { captionId: "carousel-edu",   postType: "carousel"     },
  "reel-cover":     { captionId: "reel-hook",      postType: "reel"         },
  "story-teaser":   { captionId: "story-hook",     postType: "story"        },
  "x-statement":      { captionId: "quote-insight", postType: "single_image" },
  "linkedin-insight": { captionId: "edu-tips",      postType: "single_image" },
  "tiktok-cover":     { captionId: "edu-tips",      postType: "single_image" },
}

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
  id:                     string
  platform:               string
  post_type:              string | null
  caption:                string
  hashtags:               string[]
  cta:                    string | null
  status:                 string
  media_ids:              string[]
  template_slug:          string | null
  slide_content:          SlideContentItem[] | null
  carousel_image_urls:    string[] | null
  /** Set when the post has been shared to a client portal and reviewed */
  client_approval_status: "pending" | "approved" | "flagged" | null
  /** Error message from the last failed direct-publish attempt (status === "failed") */
  publish_error?:      string | null
  /** 'direct' (default): PostFlow publishes via the platform API. 'reminder': PostFlow emails
   *  a ready-to-post package and the client posts it themselves (adds music manually in-app). */
  publish_mode?:       string | null
  /** Recommended track name/vibe for reminder-mode posts — metadata only, no audio file. */
  reminder_song_name?: string | null
  reminder_song_vibe?: string | null
  /** Set once the reminder email has actually gone out */
  reminder_sent_at?:   string | null
  content_calendar:    {
    id?: string
    scheduled_date?: string
    topic?: string
    media_brief?: string | null
    required_media_type?: string | null
    media_urls?: string[] | null
  } | null
}

interface OptimalTimeInfo {
  label:      string   // e.g. "Tuesday at 09:00"
  date:       string   // YYYY-MM-DD for the date input
  confidence: "data" | "fallback"
}

export interface TemplateHealthMap {
  [slug: string]: {
    health_score: number
    trend:        string | null
    posts_count:  number
  }
}

interface Props {
  post:            Post
  brandName:       string
  industry:        string
  /** BCP 47 code for brand's default language, e.g. "en", "nl", "de", "fr" */
  contentLanguage?: string
  /** Pre-computed optimal schedule time for the post's platform */
  optimalTime?:    OptimalTimeInfo
  /** Template health scores for this brand + platform (from template_health table) */
  templateHealth?: TemplateHealthMap
}

export function PostEditor({ post, brandName, industry, contentLanguage = "en", optimalTime, templateHealth }: Props) {
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
  const [retrying,    setRetrying]    = useState(false)
  const [publishError, setPublishError] = useState<string | null>(post.publish_error ?? null)
  // Reminder publish mode — 'direct' (default, PostFlow publishes via API) or
  // 'reminder' (PostFlow emails a ready-to-post package; the client posts it
  // themselves and adds the recommended song manually in-app).
  const [publishMode, setPublishMode] = useState<"direct" | "reminder">(
    post.publish_mode === "reminder" ? "reminder" : "direct"
  )
  const [markingPosted, setMarkingPosted] = useState(false)
  // notifyPublish: kept for backward-compat JSX; not triggered by direct publishing
  const [notifyPublish, setNotifyPublish] = useState(false)
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

  // ── V2C: Language selector ─────────────────────────────────────────────────
  const [targetLanguage, setTargetLanguage] = useState<string>(contentLanguage)

  // ── V2C: Stock image search ────────────────────────────────────────────────
  interface StockPhoto {
    id:                string
    regular:           string
    thumb:             string
    download_location: string
    alt_description:   string | null
    author: { name: string; username: string; link: string }
  }
  const [stockQuery,        setStockQuery]        = useState("")
  const [stockResults,      setStockResults]      = useState<StockPhoto[]>([])
  const [stockLoading,      setStockLoading]      = useState(false)
  const [stockError,        setStockError]        = useState<string | null>(null)
  const [stockTab,          setStockTab]          = useState<"media" | "stock">("media")
  const [selectedStockPhoto, setSelectedStockPhoto] = useState<StockPhoto | null>(null)

  // Auto-generate caption when post was just created from calendar (no caption yet)
  useEffect(() => {
    if (post.caption || !post.content_calendar?.topic) return
    const topic = post.content_calendar.topic
    // Resolve caption template + post_type from the render template selected at creation time
    const initSlug   = post.template_slug ?? "photo-overlay"
    const initMap    = RENDER_TO_CAPTION[initSlug] ?? { captionId: "edu-tips", postType: post.post_type ?? "single_image" }
    setAutoGenerating(true)
    fetch("/api/posts/generate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id:     initMap.captionId,
        post_type:       initMap.postType,
        platform:        post.platform,
        topic,
        target_language: contentLanguage,
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
          publish_mode:   publishMode,
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
      // 1. Save latest caption / metadata first
      const saveRes = await fetch(`/api/posts/${post.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          hashtags,
          cta:            cta || null,
          scheduled_date: scheduledDate,
          topic:          topic || null,
          media_ids:      mediaIds,
          publish_mode:   publishMode,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) { setError(saveJson.error ?? "Save failed"); return }

      // 2. Schedule via direct publishing (no Buffer needed)
      // Use the selected date at optimal time — default to 18:00 if no optimal time available
      const optimalHour    = optimalTime ? parseInt(optimalTime.label.split("at ")[1]?.split(":")[0] ?? "18") : 18
      const scheduledAt    = new Date(`${scheduledDate}T${String(optimalHour).padStart(2, "0")}:00:00`).toISOString()

      const schedRes = await fetch(`/api/posts/${post.id}/schedule`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scheduledAt }),
      })
      const schedJson = await schedRes.json()

      if (schedRes.ok) {
        setStatus("scheduled")
        setScheduleMsg({
          type: "success",
          text: publishMode === "reminder"
            ? `✅ Reminder set for ${new Date(scheduledAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${String(optimalHour).padStart(2, "0")}:00. You'll get an email with everything you need to post it yourself.`
            : `✅ Scheduled for ${new Date(scheduledAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${String(optimalHour).padStart(2, "0")}:00. PostFlow will publish it automatically.`,
        })
        router.refresh()
      } else if (schedJson.needsBuffer) {
        // Platform not yet supported for direct publishing — fall back to Buffer
        const bufRes = await fetch("/api/buffer/schedule", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ post_id: post.id }),
        })
        const bufJson = await bufRes.json()
        if (bufRes.ok) {
          setStatus("scheduled")
          setScheduleMsg({ type: "success", text: "✅ Sent to Buffer! It will auto-publish at the scheduled time." })
          router.refresh()
        } else {
          const msg = bufJson.error ?? "Buffer not connected."
          setScheduleMsg({ type: "warn", text: `⚠️ ${schedJson.error} Also tried Buffer: ${msg}` })
        }
      } else {
        setError(schedJson.error ?? "Scheduling failed")
      }
    } finally {
      setScheduling(false)
    }
  }

  // Retry a failed direct-publish: re-fires the same schedule flow used by
  // "Schedule post →" above, just with an immediate-future time so the post
  // doesn't need a new date/time pick. Reuses POST /api/posts/[id]/schedule.
  async function handleRetry() {
    setRetrying(true)
    setError(null)
    setScheduleMsg(null)
    try {
      const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
      const schedRes = await fetch(`/api/posts/${post.id}/schedule`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scheduledAt }),
      })
      const schedJson = await schedRes.json()

      if (schedRes.ok) {
        setStatus("scheduled")
        setPublishError(null)
        setScheduleMsg({
          type: "success",
          text: "✅ Retrying — this post will publish again in a couple of minutes.",
        })
        router.refresh()
      } else if (schedJson.needsBuffer) {
        setScheduleMsg({ type: "warn", text: `⚠️ ${schedJson.error}` })
      } else {
        setError(schedJson.error ?? "Retry failed")
      }
    } finally {
      setRetrying(false)
    }
  }

  async function handleRegenerate() {
    setRegen(true)
    setError(null)
    try {
      // Use the currently selected render template to drive both caption style + post type
      const currentSlug = selectedTemplate ?? post.template_slug ?? "photo-overlay"
      const regenMap    = RENDER_TO_CAPTION[currentSlug] ?? { captionId: "edu-tips", postType: post.post_type ?? "single_image" }
      const res = await fetch("/api/posts/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id:       regenMap.captionId,
          post_type:         regenMap.postType,
          platform:          post.platform,
          topic:             topic || post.content_calendar?.topic || "general content",
          previous_feedback: feedback || undefined,
          target_language:   targetLanguage,
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

  async function handleStockSearch(q: string) {
    if (!q.trim()) return
    setStockLoading(true)
    setStockError(null)
    try {
      const res  = await fetch(`/api/media/stock-search?q=${encodeURIComponent(q)}&orientation=squarish`)
      const data = await res.json() as { photos?: StockPhoto[]; error?: string }
      if (!res.ok || data.error) {
        setStockError(data.error ?? "Search failed")
        return
      }
      setStockResults(data.photos ?? [])
    } catch {
      setStockError("Search failed — check your connection")
    } finally {
      setStockLoading(false)
    }
  }

  async function handleSelectStockPhoto(photo: StockPhoto) {
    // Ping Unsplash download endpoint (required by Unsplash TOS)
    void fetch(`/api/media/stock-download?url=${encodeURIComponent(photo.download_location)}`, { method: "POST" })
    setSelectedStockPhoto(photo)
    // Store the regular-quality URL as the post's generated_image_url
    try {
      await fetch(`/api/posts/${post.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_image_url: photo.regular }),
      })
      setImageUrl(photo.regular)
    } catch { /* non-fatal — photo still selected visually */ }
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

  // Background render (P4, 2026-07-14) — enqueue then poll for the result
  // rather than holding the request open for 3 sequential Puppeteer renders.
  async function pollVariantsJob(jobId: string): Promise<{ templateSlug: string; templateName: string; imageUrl: string }[]> {
    const POLL_MS = 2_500
    const MAX_POLLS = 48 // ~2 minutes ceiling

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_MS))
      const res  = await fetch(`/api/render-jobs/${jobId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to check render status")

      if (json.status === "done") {
        const variants = (json.result?.variants ?? []) as { templateSlug: string; templateName: string; imageUrl: string }[]
        if (!variants.length) throw new Error("Variant render returned no variants")
        return variants
      }
      if (json.status === "failed") throw new Error(json.error ?? "Variant render failed")
      // pending/rendering — keep polling
    }
    throw new Error("Variant render is taking longer than expected — try again in a moment.")
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
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok || !json.jobId) {
        setVariantError((json.error as string) ?? "Could not start variant render — try again")
        return
      }

      const variants = await pollVariantsJob(json.jobId as string)
      setVariants(variants)
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : "Variant render failed — try again")
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
      router.push("/schedule?tab=posts")
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  // Reminder-mode posts have no platform post id (nothing was published via an
  // API) — this just records that the client actually posted it themselves,
  // so downstream analytics/round-trip code sees the same "posted" terminal
  // state a direct-publish post reaches.
  async function handleMarkPosted() {
    setMarkingPosted(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "posted" }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Failed to mark as posted"); return }
      setStatus("posted")
      router.refresh()
    } finally {
      setMarkingPosted(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link + header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/schedule?tab=posts"
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold capitalize">{post.platform} post</h1>
            {status === "failed" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-full px-2 py-0.5">
                ❌ Publish failed
              </span>
            )}
            {status === "reminder_sent" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-full px-2 py-0.5">
                ⏰ Reminder sent — post it yourself
              </span>
            )}
            {status === "scheduled" && publishMode === "reminder" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-full px-2 py-0.5">
                ⏰ Reminder scheduled
              </span>
            )}
            {post.client_approval_status === "approved" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-full px-2 py-0.5">
                👍 Client approved
              </span>
            )}
            {post.client_approval_status === "flagged" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5">
                ⚑ Client flagged — review needed
              </span>
            )}
            {post.client_approval_status === "pending" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-2 py-0.5">
                ⏳ Awaiting client review
              </span>
            )}
          </div>
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
          {/* Optimal time chip */}
          {optimalTime && (
            <button
              type="button"
              onClick={() => setScheduledDate(optimalTime.date)}
              title={
                optimalTime.confidence === "fallback"
                  ? "Based on industry benchmark (not enough data yet)"
                  : "Based on your real performance data"
              }
              className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <span className="text-amber-500">⚡</span>
              <span>
                Best time for {post.platform}: {optimalTime.label}
                {optimalTime.confidence === "fallback" && (
                  <span className="ml-1 opacity-60">(benchmark)</span>
                )}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Publish mode — only relevant before the post has actually gone out */}
      {["draft", "planned", "ready", "failed"].includes(status) && (
        <div className="space-y-1.5">
          <Label>Publish mode</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setPublishMode("direct")}
              className={cn(
                "flex-1 text-left rounded-xl border p-3 transition-colors",
                publishMode === "direct"
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-400"
                  : "border-[hsl(var(--border))] hover:border-indigo-300"
              )}
            >
              <p className="text-sm font-medium">🚀 Auto-publish</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                PostFlow publishes this post automatically at the scheduled time.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPublishMode("reminder")}
              className={cn(
                "flex-1 text-left rounded-xl border p-3 transition-colors",
                publishMode === "reminder"
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-400"
                  : "border-[hsl(var(--border))] hover:border-indigo-300"
              )}
            >
              <p className="text-sm font-medium">⏰ Reminder — I&apos;ll post it myself</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                You get an email at the scheduled time with the caption, media link, and a
                recommended song to add manually — no auto-publish, so you can pick the
                exact music yourself in-app.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Reminder-mode song recommendation — shown once scheduled */}
      {publishMode === "reminder" && (post.reminder_song_name || (status === "scheduled" || status === "reminder_sent")) && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/20 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-300">🎵 Recommended song</p>
          {post.reminder_song_name ? (
            <p className="text-sm text-indigo-900 dark:text-indigo-200 mt-1">
              Search for <strong>{post.reminder_song_name}</strong> in {post.platform}&apos;s audio picker
              {post.reminder_song_vibe && <span className="text-indigo-700/80 dark:text-indigo-400"> — {post.reminder_song_vibe}</span>}
            </p>
          ) : (
            <p className="text-sm text-indigo-900/80 dark:text-indigo-200/80 mt-1">
              A song will be recommended once this post is scheduled.
            </p>
          )}
        </div>
      )}

      {/* Reminder sent — client posts it themselves, then confirms here */}
      {status === "reminder_sent" && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/20 p-4 space-y-2">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            ⏰ Reminder email sent{post.reminder_sent_at ? ` at ${new Date(post.reminder_sent_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.
          </p>
          <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80">
            Post it yourself on {post.platform}, then confirm below so your analytics stay accurate.
          </p>
          <Button
            size="sm"
            onClick={handleMarkPosted}
            disabled={markingPosted}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {markingPosted ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Marking…</> : "✓ Mark as posted"}
          </Button>
        </div>
      )}

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
          <div className="space-y-2 mt-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ALL_TEMPLATES.filter(t => !t.platforms || t.platforms.includes(post.platform)).map((t) => {
                const isSelected = selectedTemplate === t.slug
                const health     = templateHealth?.[t.slug]
                // Health badge: only show when we have >= 3 posts of data
                const showHealth = health && health.posts_count >= 3
                const healthColor = !showHealth ? "" :
                  health.health_score >= 70 ? "text-green-600 dark:text-green-400" :
                  health.health_score >= 50 ? "text-amber-600 dark:text-amber-400" :
                                              "text-red-600 dark:text-red-400"
                const healthIcon = !showHealth ? "" :
                  health.trend === "rising"   ? "↑" :
                  health.trend === "declining" ? "↓" : "→"

                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => handleTemplateChange(t.slug)}
                    className={cn(
                      "text-left rounded-xl border p-3 space-y-1.5 transition-all",
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-400"
                        : health && health.trend === "declining"
                          ? "border-[hsl(var(--border))] hover:border-amber-300 opacity-75"
                          : "border-[hsl(var(--border))] hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded", TYPE_BADGE[t.type])}>
                        {TYPE_LABEL[t.type]}
                      </span>
                      {showHealth && (
                        <span className={cn("text-[9px] font-semibold", healthColor)} title={`${health.posts_count} posts · score ${health.health_score}`}>
                          {health.health_score} {healthIcon}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-tight">{t.name}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">{t.description}</p>
                    {isSelected && <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">✓ Selected</p>}
                    {showHealth && health.trend === "declining" && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">Declining for your brand</p>
                    )}
                  </button>
                )
              })}
            </div>
            {/* Health legend — only when data exists */}
            {templateHealth && Object.keys(templateHealth).length > 0 && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Numbers = health score (0–100) based on your post performance. ↑ rising · ↓ declining · → stable
              </p>
            )}
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
              <div className="flex items-center gap-2">
                {/* Language selector pills */}
                <div className="flex items-center gap-0.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-0.5">
                  {(["nl", "en", "de", "fr"] as const).map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setTargetLanguage(lang)}
                      className={cn(
                        "px-2 py-0.5 text-[11px] font-medium rounded-full transition-colors uppercase",
                        targetLanguage === lang
                          ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
                          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      )}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                {autoGenerating && (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Writing caption…
                  </span>
                )}
              </div>
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

          {/* Media — tabbed: "Your media" | "Stock images" */}
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStockTab("media")}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium pb-0.5 border-b-2 transition-colors",
                  stockTab === "media"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Your media
              </button>
              <button
                type="button"
                onClick={() => setStockTab("stock")}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium pb-0.5 border-b-2 transition-colors",
                  stockTab === "stock"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Stock images
              </button>
            </div>

            {stockTab === "media" ? (
              <>
                <div className="flex justify-end">
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
              </>
            ) : (
              /* Stock image search */
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={stockQuery}
                    onChange={e => setStockQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void handleStockSearch(stockQuery) }}
                    placeholder={`Search photos… (e.g. ${industry || "your industry"})`}
                    className="flex-1 h-8 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleStockSearch(stockQuery)}
                    disabled={stockLoading || !stockQuery.trim()}
                    className="h-8 text-xs px-3"
                  >
                    {stockLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
                  </Button>
                </div>

                {stockError && (
                  <p className="text-xs text-[hsl(var(--destructive))]">{stockError}</p>
                )}

                {stockResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {stockResults.map(photo => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => void handleSelectStockPhoto(photo)}
                        className={cn(
                          "relative rounded-lg overflow-hidden border-2 transition-all hover:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                          selectedStockPhoto?.id === photo.id
                            ? "border-indigo-500"
                            : "border-transparent"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.thumb}
                          alt={photo.alt_description ?? "Stock photo"}
                          className="w-full h-20 object-cover"
                        />
                        {selectedStockPhoto?.id === photo.id && (
                          <span className="absolute top-1 right-1 bg-indigo-600 rounded-full p-0.5">
                            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected photo attribution (required by Unsplash TOS) */}
                {selectedStockPhoto && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    Photo by{" "}
                    <a
                      href={`${selectedStockPhoto.author.link}?utm_source=postflow&utm_medium=referral`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-[hsl(var(--foreground))]"
                    >
                      {selectedStockPhoto.author.name}
                    </a>
                    {" "}on{" "}
                    <a
                      href="https://unsplash.com/?utm_source=postflow&utm_medium=referral"
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-[hsl(var(--foreground))]"
                    >
                      Unsplash
                    </a>
                    {" "}✓ Selected
                  </p>
                )}

                {stockResults.length === 0 && !stockLoading && !stockError && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">
                    Search for free stock photos to use as your post image.
                  </p>
                )}
              </div>
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
                {/* Base tags — always shown */}
                {[
                  { type: "great",       label: "👍 Loved it"    },
                  { type: "too_formal",  label: "🎩 Too formal"  },
                  { type: "too_casual",  label: "😅 Too casual"  },
                  { type: "wrong_voice", label: "🎭 Wrong voice" },
                  { type: "cta_weak",    label: "📉 Weak CTA"    },
                  { type: "too_long",    label: "📏 Too long"    },
                  { type: "too_short",   label: "✂️ Too short"   },
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

                {/* Video / Reel tags — shown for reel-cover template */}
                {selectedTemplate === "reel-cover" && [
                  { type: "great_hook",       label: "🎣 Great hook"        },
                  { type: "bad_music",        label: "🎵 Bad music choice"  },
                  { type: "too_fast",         label: "⚡ Too fast"           },
                  { type: "too_slow",         label: "🐢 Too slow"           },
                  { type: "wrong_length",     label: "⏱️ Wrong length"       },
                  { type: "doesnt_fit_brand", label: "🚫 Doesn't fit brand" },
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

                {/* Carousel tags — shown for carousel-edu / carousel-myth templates */}
                {(selectedTemplate === "carousel-edu" || selectedTemplate === "carousel-myth") && [
                  { type: "too_many_slides",  label: "📚 Too many slides"   },
                  { type: "too_few_slides",   label: "📄 Too few slides"    },
                  { type: "wrong_content_mix",label: "🔀 Wrong content mix" },
                  { type: "text_too_heavy",   label: "📝 Too text-heavy"    },
                  { type: "text_too_light",   label: "🖼️ Too image-heavy"   },
                  { type: "great_slide_flow", label: "✨ Great slide flow"  },
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
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />{publishMode === "reminder" ? "Scheduling reminder…" : "Scheduling…"}</>
                : publishMode === "reminder"
                  ? "Schedule reminder →"
                  : carouselImageUrls.length > 0
                    ? `Schedule ${carouselImageUrls.length} slides to Buffer →`
                    : "Schedule post →"}
            </Button>
          )}

          {/* Failed → Retry */}
          {status === "failed" && (
            <Button onClick={handleRetry} disabled={saving || retrying} className="bg-red-600 hover:bg-red-700 text-white">
              {retrying
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Retrying…</>
                : publishMode === "reminder" ? "🔁 Retry reminder" : "🔁 Retry publish"}
            </Button>
          )}

          {/* Reminder sent → Mark as posted (also available from this action row) */}
          {status === "reminder_sent" && (
            <Button onClick={handleMarkPosted} disabled={markingPosted} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {markingPosted
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Marking…</>
                : "✓ Mark as posted"}
            </Button>
          )}

          {/* Step back */}
          {(status === "planned" || status === "ready" || status === "scheduled" || status === "failed" || status === "reminder_sent") && (
            <Button
              variant="ghost"
              onClick={() => handleSave(status === "scheduled" || status === "failed" || status === "reminder_sent" ? "ready" : status === "ready" ? "planned" : "draft")}
              disabled={saving}
              className="text-[hsl(var(--muted-foreground))] ml-auto"
            >
              ← Move back
            </Button>
          )}
        </div>

        {/* Failed publish — clear error state with the reason */}
        {status === "failed" && publishError && (
          <p className="text-xs rounded-lg px-3 py-2 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400">
            ❌ Publish failed: {publishError}
          </p>
        )}

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

        {/* Notification-publish banner (Instagram/Facebook require a tap in Buffer app) */}
        {notifyPublish && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
            <div>
              <p className="font-semibold text-sm text-[hsl(var(--foreground))]">Almost there</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                This post needs one tap in the Buffer app to go live on Instagram.
                You&apos;ll get a push notification at the scheduled time — just tap to publish.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setNotifyPublish(false)}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40 transition-colors"
              >
                Got it
              </button>
              <a
                href="https://buffer.com/app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xs px-3 py-2 rounded-lg bg-[var(--pf-teal)] text-white font-medium text-center hover:opacity-90 transition-opacity"
              >
                Open Buffer →
              </a>
            </div>
          </div>
        )}

        {status === "scheduled" && !scheduleMsg && !notifyPublish && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/40 rounded-lg px-3 py-2">
            {publishMode === "reminder"
              ? "⏰ This post is in reminder mode — you'll get an email at the scheduled time to post it yourself."
              : "📌 This post is scheduled. If Buffer is connected, it will auto-publish at the scheduled time."}
          </p>
        )}
      </div>
    </div>
  )
}
