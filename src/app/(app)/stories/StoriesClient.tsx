/**
 * StoriesClient — 3-step wizard for Stories & Reels quick creation.
 *
 * Step 0: Upload — drag-and-drop single photo or short video
 * Step 1: Customise — pick platform + template, then AI generates caption
 * Step 2: Schedule — review caption, edit if needed, schedule to Buffer or download
 *
 * Supported media types:
 *   - Photo (JPEG/PNG/WEBP) → story-teaser template
 *   - Short video (MP4/MOV/WEBM) → reel-cover template
 *
 * Uses ConnectPrompt when no Buffer-linked account exists for the target platform.
 */

"use client"

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react"
import {
  Upload, CheckCircle2, ArrowLeft, Copy, Check,
  Loader2, X, ImageIcon, Film, Sparkles,
} from "lucide-react"
import { Button }        from "@/components/ui/button"
import { SelectCard }    from "@/components/clip-forge/SelectCard"
import { ConnectPrompt } from "@/components/clip-forge/ConnectPrompt"
import { FeedbackRow, BASE_FEEDBACK_TAGS } from "@/components/shared/FeedbackRow"
import { cn }            from "@/lib/utils"
import { useConnections } from "@/hooks/useConnections"

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ["Upload", "Customise", "Schedule"] as const
type Step = 0 | 1 | 2

const MAX_PHOTO_BYTES = 25  * 1024 * 1024   // 25 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024   // 200 MB

const ACCEPTED_PHOTO = ["image/jpeg", "image/png", "image/webp"]
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"]
const ACCEPTED_ALL   = [...ACCEPTED_PHOTO, ...ACCEPTED_VIDEO]

const PLATFORM_OPTIONS: Array<{ value: string; label: string; emoji: string }> = [
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "tiktok",    label: "TikTok",    emoji: "🎵" },
  { value: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { value: "facebook",  label: "Facebook",  emoji: "👥" },
  { value: "youtube",   label: "YouTube",   emoji: "▶️" },
]

const TEMPLATE_OPTIONS: Array<{ value: string; label: string; emoji: string; description: string }> = [
  {
    value:       "story-teaser",
    label:       "Story Teaser",
    emoji:       "📖",
    description: "Eye-catching photo story — perfect for brand moments, behind-the-scenes, or promotions",
  },
  {
    value:       "reel-cover",
    label:       "Reel Cover",
    emoji:       "🎬",
    description: "Short-form video reel — dynamic content designed to stop the scroll",
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaType = "photo" | "video"

interface UploadedMedia {
  file:      File
  path:      string
  mediaType: MediaType
  previewUrl: string
}

interface CreateResult {
  postId:    string
  caption:   string
  hashtags:  string[]
  mediaUrl:  string
  platform:  string
  template:  string
  mediaType: MediaType
}

// ── Main component ────────────────────────────────────────────────────────────

export function StoriesClient() {
  const [step, setStep] = useState<Step>(0)

  // Step 0 — upload
  const [media,      setMedia]      = useState<UploadedMedia | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging,   setDragging]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Step 1 — customise
  const [platform, setPlatform] = useState<string | null>(null)
  const [template, setTemplate] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [apiError,   setApiError]   = useState<string | null>(null)

  // Step 2 — schedule
  const [result,        setResult]        = useState<CreateResult | null>(null)
  const [caption,       setCaption]       = useState("")
  const [captionCopied, setCaptionCopied] = useState(false)
  const [feedback,      setFeedback]      = useState<string | null>(null)
  const [feedbackSent,  setFeedbackSent]  = useState(false)
  const [scheduled,     setScheduled]     = useState(false)
  const [scheduling,    setScheduling]    = useState(false)

  const { isConnected, getConnection, loading: connectionsLoading } = useConnections()

  // ── Step 0: Upload handlers ───────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File) => {
    setUploadError(null)
    setUploading(true)

    const isPhoto = ACCEPTED_PHOTO.includes(file.type)
    const isVideo = ACCEPTED_VIDEO.includes(file.type)

    if (!isPhoto && !isVideo) {
      setUploadError("Unsupported file type. Please upload a photo (JPEG/PNG/WEBP) or short video (MP4/MOV/WEBM).")
      setUploading(false)
      return
    }

    const maxBytes = isPhoto ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES
    if (file.size > maxBytes) {
      setUploadError(`File too large. Max size: ${isPhoto ? "25 MB" : "200 MB"}.`)
      setUploading(false)
      return
    }

    try {
      // Get signed upload URL
      const urlRes = await fetch("/api/stories/upload-url", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      })

      const urlData = await urlRes.json()
      if (!urlRes.ok) {
        setUploadError(urlData.error ?? "Failed to get upload URL")
        setUploading(false)
        return
      }

      const { signedUrl, path } = urlData as { signedUrl: string; path: string; mediaType: MediaType }

      // Upload the file directly to storage
      const uploadRes = await fetch(signedUrl, {
        method:  "PUT",
        headers: { "Content-Type": file.type },
        body:    file,
      })

      if (!uploadRes.ok) {
        setUploadError("Upload failed — please try again.")
        setUploading(false)
        return
      }

      const previewUrl = URL.createObjectURL(file)

      setMedia({
        file,
        path,
        mediaType: isPhoto ? "photo" : "video",
        previewUrl,
      })

      // Auto-select template based on media type
      setTemplate(isPhoto ? "story-teaser" : "reel-cover")

      setStep(1)
    } catch {
      setUploadError("Upload failed — please check your connection and try again.")
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ""
  }, [uploadFile])

  // ── Step 1 → 2: Generate caption ─────────────────────────────────────────

  const handleGenerate = async () => {
    if (!media || !platform || !template) return
    setGenerating(true)
    setApiError(null)

    try {
      const res = await fetch("/api/stories/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path:      media.path,
          platform,
          template,
          mediaType: media.mediaType,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setApiError(data.error ?? "Failed to generate caption")
        return
      }

      const r = data as CreateResult
      setResult(r)
      setCaption(r.caption)
      setStep(2)
    } finally {
      setGenerating(false)
    }
  }

  // ── Step 2: Schedule to Buffer ────────────────────────────────────────────

  const handleSchedule = async () => {
    if (!result || !platform) return
    const conn = getConnection(platform)
    if (!conn?.buffer_profile_id) return

    setScheduling(true)
    try {
      await fetch(`/api/posts/${result.postId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, status: "scheduled" }),
      })
      setScheduled(true)
    } catch {
      setApiError("Failed to schedule — please try again.")
    } finally {
      setScheduling(false)
    }
  }

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption)
    setCaptionCopied(true)
    setTimeout(() => setCaptionCopied(false), 2000)
  }

  const handleFeedback = async (type: string) => {
    setFeedback(type)
    setFeedbackSent(true)
    // Fire-and-forget — no UI action needed
    if (result?.postId) {
      await fetch(`/api/posts/${result.postId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback_tag: type }),
      }).catch(() => {/* ignore feedback errors */})
    }
  }

  const reset = () => {
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl)
    setMedia(null)
    setPlatform(null)
    setTemplate(null)
    setResult(null)
    setCaption("")
    setFeedback(null)
    setFeedbackSent(false)
    setScheduled(false)
    setApiError(null)
    setUploadError(null)
    setStep(0)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950/60">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stories &amp; Reels</h1>
          <p className="text-sm text-muted-foreground">Upload a photo or video — AI writes your caption in seconds</p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Error banners */}
      {(apiError || uploadError) && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400">
          {apiError ?? uploadError}
        </div>
      )}

      {/* ── Step 0: Upload ────────────────────────────────────────────────────── */}
      {step === 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-medium">Upload your media</h2>

          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => !uploading && inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors",
              uploading
                ? "pointer-events-none border-purple-300 bg-purple-50/40 dark:bg-purple-950/20"
                : "cursor-pointer hover:border-purple-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40",
              dragging && "border-purple-400 bg-purple-50/40 dark:bg-purple-950/20",
              !uploading && !dragging && "border-border",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 text-purple-500 animate-spin mb-3" />
                <p className="text-sm font-medium">Uploading…</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Drop your photo or video here</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Photo: JPEG, PNG, WEBP · max 25 MB
                </p>
                <p className="text-xs text-muted-foreground">
                  Video: MP4, MOV, WEBM · max 200 MB
                </p>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_ALL.join(",")}
            className="hidden"
            onChange={onInputChange}
          />

          <p className="text-xs text-muted-foreground text-center">
            Photo uploads use the <strong>story-teaser</strong> template.
            Videos use the <strong>reel-cover</strong> template.
          </p>
        </section>
      )}

      {/* ── Step 1: Customise ─────────────────────────────────────────────────── */}
      {step === 1 && media && (
        <section className="space-y-6">
          {/* Media preview */}
          <div className="flex items-start gap-4 rounded-xl border bg-card p-4">
            <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              {media.mediaType === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
              ) : (
                <video src={media.previewUrl} className="w-full h-full object-cover" muted playsInline />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {media.mediaType === "photo"
                  ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <p className="text-sm font-medium truncate">{media.file.name}</p>
              </div>
              <p className="text-xs text-muted-foreground capitalize">{media.mediaType} · {(media.file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Remove and start over"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Platform selection */}
          <div className="space-y-3">
            <h2 className="text-base font-medium">Which platform?</h2>
            <SelectCard
              options={PLATFORM_OPTIONS as Array<{ value: string; label: string; emoji?: string }>}
              value={platform}
              onChange={(v) => setPlatform(v)}
              columns={3}
            />
          </div>

          {/* Template selection */}
          <div className="space-y-3">
            <h2 className="text-base font-medium">Which template?</h2>
            <SelectCard
              options={TEMPLATE_OPTIONS}
              value={template}
              onChange={(v) => setTemplate(v)}
              columns={2}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              disabled={!platform || !template || generating}
              onClick={handleGenerate}
              className="flex-1"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating caption…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate caption</>
              )}
            </Button>
          </div>
        </section>
      )}

      {/* ── Step 2: Schedule / Download ──────────────────────────────────────── */}
      {step === 2 && result && (
        <section className="space-y-6">
          {/* Media preview (compact) */}
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
            {media?.mediaType === "photo"
              ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              : <Film className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <p className="text-sm truncate text-muted-foreground">{media?.file.name}</p>
            <span className="ml-auto text-xs bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-full shrink-0">
              {result.template === "story-teaser" ? "Story Teaser" : "Reel Cover"}
            </span>
          </div>

          {/* Caption editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Caption</h2>
              <button
                type="button"
                onClick={copyCaption}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {captionCopied
                  ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
                  : <><Copy className="h-3.5 w-3.5" /> Copy</>
                }
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCaption(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Your AI-generated caption will appear here…"
            />
          </div>

          {/* Hashtags */}
          {result.hashtags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Hashtags</h3>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-full"
                  >
                    #{tag.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Caption feedback */}
          {!feedbackSent ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">How&apos;s the caption?</p>
              <FeedbackRow
                tags={BASE_FEEDBACK_TAGS}
                selected={feedback}
                onSelect={handleFeedback}
              />
            </div>
          ) : (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Thanks for the feedback — PostFlow will learn from this.
            </p>
          )}

          {/* Schedule / download area */}
          {!scheduled ? (
            <div className="space-y-4 pt-2">
              {connectionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking connections…
                </div>
              ) : isConnected(result.platform) && getConnection(result.platform)?.buffer_profile_id ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)} className="shrink-0">
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!caption.trim() || scheduling}
                      onClick={handleSchedule}
                    >
                      {scheduling
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scheduling…</>
                        : "Schedule to Buffer"
                      }
                    </Button>
                  </div>
                  <DownloadLink mediaUrl={result.mediaUrl} mediaType={result.mediaType} />
                </div>
              ) : (
                <div className="space-y-4">
                  <ConnectPrompt
                    platform={result.platform}
                    onSkip={() => setScheduled(true)}
                  />
                  <DownloadLink mediaUrl={result.mediaUrl} mediaType={result.mediaType} />
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <SuccessBlock onReset={reset} platform={result.platform} />
          )}
        </section>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <nav aria-label="Progress" className="flex items-center gap-1">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending"
        return (
          <div key={label} className="flex items-center gap-1">
            <div className={cn(
              "flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
              state === "done"    && "bg-purple-600 text-white",
              state === "active"  && "bg-purple-100 text-purple-700 ring-1 ring-purple-400 dark:bg-purple-950/60 dark:text-purple-300",
              state === "pending" && "bg-zinc-100 text-zinc-400 dark:bg-zinc-800",
            )}>
              {state === "done" ? "✓" : i + 1}
            </div>
            <span className={cn(
              "hidden sm:inline text-xs font-medium",
              state === "active" ? "text-foreground" : "text-muted-foreground",
            )}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-px w-4 shrink-0",
                i < current ? "bg-purple-400" : "bg-border",
              )} />
            )}
          </div>
        )
      })}
    </nav>
  )
}

function DownloadLink({ mediaUrl, mediaType }: { mediaUrl: string; mediaType: MediaType }) {
  return (
    <div className="flex justify-center">
      <a
        href={mediaUrl}
        download
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
      >
        Download {mediaType === "photo" ? "photo" : "video"} file
      </a>
    </div>
  )
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn",
  facebook:  "Facebook",  youtube: "YouTube",
}

function SuccessBlock({ onReset, platform }: { onReset: () => void; platform: string }) {
  const label = PLATFORM_LABELS[platform] ?? platform
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 dark:bg-emerald-950/20 dark:border-emerald-800">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved! Your {label} post is ready to go.
        </p>
      </div>
      <Button variant="outline" onClick={onReset} className="w-full">
        Create another story or reel
      </Button>
    </div>
  )
}
