"use client"

/**
 * CarouselBuilder
 *
 * Smart slide editor for carousel templates. Shows each slide as a labelled
 * slot with contextual hints so the user always knows exactly what to write
 * and whether a photo is needed. Content slides can be reordered.
 *
 * Supported templates:
 *   carousel-edu  — Hook → numbered content slides → CTA
 *   carousel-myth — Hook → Myth/Reality pairs → CTA
 */

import { useState, useRef } from "react"
import { Loader2, ChevronUp, ChevronDown, Plus, Trash2, ImageIcon, X, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CarouselSlide {
  headline:  string
  body:      string
  mediaUrl?: string | null
  /** Internal — not sent to renderer */
  _type:     "hook" | "content" | "myth" | "reality" | "cta"
  _label:    string
  _hint:     string
  _bodyHint: string
  _mediaHint?: string        // if set, photo upload is shown for this slot
  _fixed?:   boolean         // hook + CTA are fixed (not reorderable/deletable)
}

interface InitialSlide {
  headline:  string
  body?:     string
  is_hook?:  boolean
  is_cta?:   boolean
  mediaUrl?: string | null
}

interface Props {
  templateSlug:   string
  postId:         string
  /** First caption line → hook headline; full caption → passed to renderer */
  captionFirstLine: string
  ctaValue:         string
  /** AI-generated slide content from the calendar entry / post — pre-fills all fields */
  initialSlideContent?: InitialSlide[]
  onRendered?:      (urls: string[]) => void
}

// ── Per-template configuration ────────────────────────────────────────────────

interface TemplateConfig {
  name:          string
  addLabel:      string
  defaultSlides: () => Omit<CarouselSlide, "headline" | "body">[]
  newContent:    () => Omit<CarouselSlide, "headline" | "body">
}

const TEMPLATE_CONFIG: Record<string, TemplateConfig> = {
  "carousel-edu": {
    name:     "Educational",
    addLabel: "Add content slide",
    defaultSlides: () => [
      {
        _type:    "hook",
        _label:   "Hook slide",
        _hint:    "Your bold opening — a claim, question, or stat that makes people stop scrolling.",
        _bodyHint:"Optional subtext shown below the headline.",
        _fixed:   true,
      },
      {
        _type:    "content",
        _label:   "Content slide 1",
        _hint:    "First point, tip, or step. Keep the headline punchy — 6–10 words.",
        _bodyHint:"Expand in 1–2 sentences. Practical beats theoretical.",
      },
      {
        _type:    "content",
        _label:   "Content slide 2",
        _hint:    "Second point. Each slide should stand alone — someone might screenshot this.",
        _bodyHint:"Optional detail or example.",
      },
      {
        _type:    "cta",
        _label:   "CTA slide",
        _hint:    "Save this / Follow for more / Drop a comment. One clear action.",
        _bodyHint:"Optional extra line below the headline.",
        _fixed:   true,
      },
    ],
    newContent: () => ({
      _type:    "content" as const,
      _label:   "Content slide",
      _hint:    "Another tip or point. What do you want them to know?",
      _bodyHint:"Optional supporting detail.",
    }),
  },

  "carousel-myth": {
    name:     "Myth vs Reality",
    addLabel: "Add myth/reality pair",
    defaultSlides: () => [
      {
        _type:    "hook",
        _label:   "Hook slide",
        _hint:    "Tease the myth-busting — 'Everything you've heard about X is wrong.' or similar.",
        _bodyHint:"Optional subtext.",
        _fixed:   true,
      },
      {
        _type:    "myth",
        _label:   "Myth 1",
        _hint:    "Write the myth as people believe it — use their language, not yours.",
        _bodyHint:"Optional extra context on why people believe this.",
      },
      {
        _type:    "reality",
        _label:   "Reality 1",
        _hint:    "The truth that corrects it. Be direct — no 'well actually'.",
        _bodyHint:"Back it up with a fact, stat, or quick explanation.",
      },
      {
        _type:    "myth",
        _label:   "Myth 2",
        _hint:    "Second myth. Pick the most common misconception in your niche.",
        _bodyHint:"Optional.",
      },
      {
        _type:    "reality",
        _label:   "Reality 2",
        _hint:    "The corrected truth. Use concrete language.",
        _bodyHint:"Optional proof or example.",
      },
      {
        _type:    "cta",
        _label:   "CTA slide",
        _hint:    "Save this so you never fall for these myths again.",
        _bodyHint:"Optional follow-up line.",
        _fixed:   true,
      },
    ],
    newContent: () => ({
      _type:    "myth" as const,
      _label:   "Myth",
      _hint:    "The myth as people say it.",
      _bodyHint:"Optional context.",
    }),
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSlides(
  cfg: TemplateConfig,
  captionFirstLine: string,
  ctaValue: string,
  initialSlideContent?: InitialSlide[]
): CarouselSlide[] {
  const defaults = cfg.defaultSlides()

  // If AI-generated slide content provided, use it to build slides
  if (initialSlideContent && initialSlideContent.length > 0) {
    return initialSlideContent.map((item, i) => {
      const type: CarouselSlide["_type"] =
        item.is_hook ? "hook"
        : item.is_cta ? "cta"
        : cfg.name === "Myth vs Reality"
          ? (i % 2 === 1 ? "myth" : "reality")
          : "content"

      const meta = defaults.find(d => d._type === type) ?? defaults[1] ?? defaults[0]
      const label = item.is_hook ? "Hook slide"
                  : item.is_cta  ? "CTA slide"
                  : cfg.name === "Myth vs Reality"
                    ? (type === "myth" ? `Myth ${Math.ceil(i / 2)}` : `Reality ${Math.ceil(i / 2)}`)
                    : `Content slide ${i}`

      return {
        ...meta,
        _type:  type,
        _label: label,
        _fixed: item.is_hook || item.is_cta,
        headline: item.headline ?? "",
        body:     item.body     ?? "",
        mediaUrl: item.mediaUrl ?? null,
      }
    })
  }

  // Fallback: blank slides with hook/CTA pre-filled from caption/CTA
  return defaults.map((meta, i) => ({
    ...meta,
    headline: meta._type === "hook" ? captionFirstLine
            : meta._type === "cta"  ? (ctaValue || "Save this for later!")
            : "",
    body:     "",
    _label:   i === 0 ? meta._label
            : meta._type === "cta" ? meta._label
            : meta._label,
  }))
}

// Renumber content/myth/reality labels after add/remove
function relabelSlides(slides: CarouselSlide[], templateSlug: string): CarouselSlide[] {
  const isMythTemplate = templateSlug === "carousel-myth"
  let mythCount    = 0
  let realityCount = 0
  let contentCount = 0

  return slides.map(s => {
    if (s._fixed) return s
    if (isMythTemplate) {
      if (s._type === "myth") {
        mythCount++
        return { ...s, _label: `Myth ${mythCount}` }
      }
      if (s._type === "reality") {
        realityCount++
        return { ...s, _label: `Reality ${realityCount}` }
      }
    } else {
      if (s._type === "content") {
        contentCount++
        return { ...s, _label: `Content slide ${contentCount}` }
      }
    }
    return s
  })
}

// ── Badge styles ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<CarouselSlide["_type"], string> = {
  hook:    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  content: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  myth:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  reality: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cta:     "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
}

const TYPE_EMOJI: Record<CarouselSlide["_type"], string> = {
  hook:    "🎣",
  content: "📝",
  myth:    "❌",
  reality: "✅",
  cta:     "📣",
}

// ── Main component ────────────────────────────────────────────────────────────

export function CarouselBuilder({ templateSlug, postId, captionFirstLine, ctaValue, initialSlideContent, onRendered }: Props) {
  const cfg = TEMPLATE_CONFIG[templateSlug]
  if (!cfg) return null

  const [slides,     setSlides]     = useState<CarouselSlide[]>(() =>
    makeSlides(cfg, captionFirstLine, ctaValue, initialSlideContent)
  )
  const [rendering,  setRendering]  = useState(false)
  const [renderedUrls, setRenderedUrls] = useState<string[]>([])
  const [error,      setError]      = useState<string | null>(null)
  const [uploading,  setUploading]  = useState<number | null>(null) // slide index being uploaded
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadingForSlide = useRef<number | null>(null)

  // Compute total slides (hook is always index 0, CTA is always last)
  const totalSlides = slides.length

  function updateSlide(idx: number, patch: Partial<CarouselSlide>) {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function moveSlide(idx: number, direction: "up" | "down") {
    setSlides(prev => {
      const next = [...prev]
      const target = direction === "up" ? idx - 1 : idx + 1
      // Don't move past fixed slides
      if (next[target]?._fixed) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return relabelSlides(next, templateSlug)
    })
  }

  function addSlide() {
    setSlides(prev => {
      const newSlide: CarouselSlide = { ...cfg.newContent(), headline: "", body: "" }
      // If myth template, add myth then reality as a pair before the CTA
      if (templateSlug === "carousel-myth") {
        const ctaIdx   = prev.length - 1
        const newMyth: CarouselSlide = {
          _type: "myth", _label: "Myth", _hint: "The myth as people say it.",
          _bodyHint: "Optional context.", headline: "", body: "",
        }
        const newReality: CarouselSlide = {
          _type: "reality", _label: "Reality", _hint: "The truth that corrects it.",
          _bodyHint: "Optional proof.", headline: "", body: "",
        }
        const spliced = [...prev.slice(0, ctaIdx), newMyth, newReality, ...prev.slice(ctaIdx)]
        return relabelSlides(spliced, templateSlug)
      }
      // Standard: insert before CTA
      const ctaIdx = prev.length - 1
      const spliced = [...prev.slice(0, ctaIdx), newSlide, ...prev.slice(ctaIdx)]
      return relabelSlides(spliced, templateSlug)
    })
  }

  function removeSlide(idx: number) {
    setSlides(prev => {
      const removed = prev.filter((_, i) => i !== idx)
      return relabelSlides(removed, templateSlug)
    })
  }

  // Photo upload for a specific slide
  function openUpload(idx: number) {
    uploadingForSlide.current = idx
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const idx  = uploadingForSlide.current
    if (!file || idx === null) return

    setUploading(idx)
    try {
      const formData = new FormData()
      formData.append("file", file)
      // Re-use calendar upload endpoint structure but for slide media
      const res = await fetch(`/api/posts/${postId}/slide-media`, {
        method: "POST",
        body:   formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Upload failed")
      updateSlide(idx, { mediaUrl: json.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(null)
      uploadingForSlide.current = null
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleRender() {
    setRendering(true)
    setError(null)
    try {
      // Strip internal _* fields before sending to API
      const cleanSlides = slides.map(({ headline, body, mediaUrl, _type, _fixed }) => ({
        headline,
        body:    body || undefined,
        mediaUrl: mediaUrl ?? null,
        isHook:  _type === "hook",
        isCTA:   _type === "cta",
      }))

      const res  = await fetch(`/api/posts/${postId}/render-carousel`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ templateSlug, slideContent: cleanSlides }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Render failed")

      setRenderedUrls(json.imageUrls)
      onRendered?.(json.imageUrls)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render failed")
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {cfg.name} carousel
            <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
              {totalSlides} slides
            </span>
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Fill in each slide below — hints tell you exactly what to write.
          </p>
        </div>
      </div>

      {/* Slide list */}
      <div className="space-y-2">
        {slides.map((slide, idx) => {
          const isFirst    = idx === 0
          const isLast     = idx === slides.length - 1
          const canMoveUp  = !slide._fixed && idx > 1               // can't go above hook
          const canMoveDown = !slide._fixed && idx < slides.length - 2 // can't go below CTA

          return (
            <div
              key={idx}
              className={cn(
                "rounded-xl border p-3.5 space-y-2.5 transition-colors",
                slide._type === "hook"    && "border-indigo-200 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20",
                slide._type === "cta"     && "border-violet-200 bg-violet-50/40 dark:border-violet-800 dark:bg-violet-950/20",
                slide._type === "myth"    && "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20",
                slide._type === "reality" && "border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/20",
                slide._type === "content" && "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20",
              )}
            >
              {/* Slide header row */}
              <div className="flex items-center gap-2">
                {/* Slide number */}
                <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-5 text-center shrink-0">
                  {idx + 1}
                </span>

                {/* Type badge */}
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                  TYPE_STYLES[slide._type]
                )}>
                  {TYPE_EMOJI[slide._type]} {slide._label}
                </span>

                {/* Reorder buttons */}
                {!slide._fixed && (
                  <div className="flex gap-0.5 ml-auto">
                    <button
                      type="button"
                      disabled={!canMoveUp}
                      onClick={() => moveSlide(idx, "up")}
                      className="p-0.5 rounded hover:bg-[hsl(var(--muted))] disabled:opacity-25 transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canMoveDown}
                      onClick={() => moveSlide(idx, "down")}
                      className="p-0.5 rounded hover:bg-[hsl(var(--muted))] disabled:opacity-25 transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSlide(idx)}
                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-400 hover:text-red-600 transition-colors ml-0.5"
                      title="Remove slide"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Headline field */}
              <div className="space-y-1">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">
                  Headline
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic leading-snug">
                  {slide._hint}
                </p>
                <input
                  type="text"
                  value={slide.headline}
                  onChange={e => updateSlide(idx, { headline: e.target.value })}
                  placeholder={slide._type === "hook" ? "Your opening hook…" : slide._type === "cta" ? "Save this for later!" : "Slide headline…"}
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                />
              </div>

              {/* Body field */}
              <div className="space-y-1">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">
                  Body <span className="normal-case font-normal">(optional)</span>
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic leading-snug">
                  {slide._bodyHint}
                </p>
                <textarea
                  rows={2}
                  value={slide.body}
                  onChange={e => updateSlide(idx, { body: e.target.value })}
                  placeholder="Supporting detail…"
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] resize-none"
                />
              </div>

              {/* Per-slide photo upload (shown for all non-fixed slides) */}
              {!slide._fixed && (
                <div className="pt-0.5">
                  {slide.mediaUrl ? (
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slide.mediaUrl} alt="" className="h-8 w-8 rounded object-cover border" />
                      <span className="flex-1 truncate">Photo attached</span>
                      <button
                        type="button"
                        onClick={() => updateSlide(idx, { mediaUrl: null })}
                        className="text-zinc-400 hover:text-zinc-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openUpload(idx)}
                      disabled={uploading === idx}
                      className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground border border-dashed border-[hsl(var(--border))] rounded-lg px-3 py-1.5 transition-colors w-full justify-center hover:bg-[hsl(var(--muted))]/30"
                    >
                      {uploading === idx
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                        : <><ImageIcon className="h-3 w-3" /> Add photo for this slide (optional)</>
                      }
                    </button>
                  )}
                </div>
              )}

              {/* Rendered preview for this slide */}
              {renderedUrls[idx] && (
                <div className="rounded-lg overflow-hidden border mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={renderedUrls[idx]}
                    alt={`Slide ${idx + 1} preview`}
                    className="w-full h-auto max-h-40 object-contain bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add slide button */}
      <button
        type="button"
        onClick={addSlide}
        className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg px-4 py-2 w-full justify-center transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
      >
        <Plus className="h-3.5 w-3.5" />
        {cfg.addLabel}
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-[hsl(var(--destructive))] bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Render button + thumbnail strip */}
      <div className="space-y-3 pt-1 border-t">
        <Button
          onClick={handleRender}
          disabled={rendering || slides.some(s => !s.headline.trim())}
          className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {rendering
            ? <><Loader2 className="h-4 w-4 animate-spin" />Rendering {totalSlides} slides…</>
            : <><Play className="h-4 w-4" />Render all {totalSlides} slides</>
          }
        </Button>

        {slides.some(s => !s.headline.trim()) && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
            Fill in all headlines to render.
          </p>
        )}

        {/* Thumbnail strip */}
        {renderedUrls.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {renderedUrls.length} slides rendered — scroll to preview
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {renderedUrls.map((url, i) => (
                <a key={i} href={url.split("?")[0]} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Slide ${i + 1}`}
                    className="h-32 w-auto rounded-lg border shadow-sm hover:opacity-80 transition-opacity"
                  />
                  <p className="text-[10px] text-center text-[hsl(var(--muted-foreground))] mt-0.5">
                    {i + 1}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
