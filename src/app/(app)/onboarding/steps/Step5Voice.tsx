"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell, StepActions } from "./StepShell"
import { EmojiInput } from "@/components/ui/EmojiInput"

interface Props {
  draft: OnboardingDraft
  mergeDraft: (u: Partial<OnboardingDraft>) => void
  saveToApi: (fields: Record<string, unknown>) => Promise<unknown>
  next: () => void
  back: () => void
}

type InputMode = "text" | "images"

interface PreviewImage {
  file: File
  url: string
  data: string       // base64
  mediaType: string
}

export function Step5Voice({ draft, mergeDraft, saveToApi, next, back }: Props) {
  const [mode, setMode] = useState<InputMode>("text")
  const [examples, setExamples] = useState(draft.voice_examples ?? "")
  const [websiteUrl, setWebsiteUrl] = useState(draft.website_url ?? "")
  const [emojiPolicy,    setEmojiPolicy]    = useState<"never" | "sparingly" | "often">("sparingly")
  const [emojiFavorites, setEmojiFavorites] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Image mode state
  const [images, setImages] = useState<PreviewImage[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Resize image to max 900px on the longest side, then return base64 JPEG.
   * Keeps file size well under 1 MB per image so the JSON body stays small.
   */
  async function readFileAsBase64(file: File): Promise<{ data: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const MAX = 900
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82)
        const data = dataUrl.split(",")[1]
        resolve({ data, mediaType: "image/jpeg" })
      }
      img.onerror = reject
      img.src = objectUrl
    })
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5)
    if (!files.length) return

    const previews = await Promise.all(
      files.map(async (file) => {
        const { data, mediaType } = await readFileAsBase64(file)
        return { file, url: URL.createObjectURL(file), data, mediaType }
      })
    )
    setImages((prev) => [...prev, ...previews].slice(0, 5))
    setExtracted(false)
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setExtracted(false)
  }

  async function handleExtract() {
    if (!images.length) return
    setExtracting(true)
    setError(null)

    try {
      const res = await fetch("/api/ai/extract-from-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map(({ data, mediaType }) => ({ data, mediaType })),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? "Extraction failed"); return }
      setExamples(json.text)
      setExtracted(true)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setExtracting(false)
    }
  }

  async function handleNext() {
    if (examples.trim().length < 50) {
      setError(
        mode === "images" && !extracted
          ? "Extract text from your screenshots first, or switch to text mode."
          : "Paste at least one example post (50+ characters)"
      )
      return
    }
    setSaving(true)
    setError(null)
    mergeDraft({ voice_examples: examples, website_url: websiteUrl })
    await saveToApi({
      tone_examples:   [examples],
      website_url:     websiteUrl || null,
      emoji_policy:    emojiPolicy,
      emoji_favorites: emojiPolicy === "sparingly" && emojiFavorites.trim() ? emojiFavorites.trim() : null,
    })
    setSaving(false)
    next()
  }

  return (
    <StepShell
      title="Your voice in their own words"
      description="Share 2–5 posts you love — paste the text or upload screenshots directly."
      onBack={back}
    >
      <div className="space-y-5">
        {/* Mode toggle */}
        <div className="flex rounded-lg border overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              mode === "text"
                ? "bg-indigo-500 text-white"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            )}
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => setMode("images")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              mode === "images"
                ? "bg-indigo-500 text-white"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            )}
          >
            Upload screenshots
          </button>
        </div>

        {/* Text mode */}
        {mode === "text" && (
          <div className="space-y-1.5">
            <Label htmlFor="examples">Example posts *</Label>
            <textarea
              id="examples"
              rows={8}
              className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              placeholder={"Padel elbow is one of the most common injuries I see. But here's what most people get wrong...\n\n---\n\nACL recovery is hard. Here's exactly what month 1 looks like..."}
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Separate multiple posts with a blank line or "---"
            </p>
          </div>
        )}

        {/* Image upload mode */}
        {mode === "images" && (
          <div className="space-y-3">
            <Label>Screenshots (up to 5) *</Label>

            {/* Drop zone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-[hsl(var(--border))] hover:border-indigo-300 p-8 flex flex-col items-center gap-2 transition-colors"
            >
              <ImagePlus className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm font-medium">Click to upload screenshots</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                PNG, JPG or WebP · up to 5 images
              </p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />

            {/* Previews */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Screenshot ${i + 1}`}
                      className="h-24 w-auto rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[hsl(var(--destructive))] text-white flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Extract button */}
            {images.length > 0 && !extracted && (
              <Button
                variant="outline"
                onClick={handleExtract}
                disabled={extracting}
                className="gap-2"
              >
                {extracting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Extracting text…</>
                ) : (
                  "Extract post text with Claude →"
                )}
              </Button>
            )}

            {/* Extracted preview */}
            {extracted && examples && (
              <div className="rounded-lg bg-[hsl(var(--muted))]/50 border p-3 space-y-1">
                <p className="text-xs font-medium text-green-600 dark:text-green-400">
                  ✓ Text extracted — review below
                </p>
                <textarea
                  rows={6}
                  className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                  value={examples}
                  onChange={(e) => setExamples(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}

        {/* Website URL — always shown */}
        <div className="space-y-1.5">
          <Label htmlFor="website">
            Your website or About page{" "}
            <span className="text-[hsl(var(--muted-foreground))]">(optional)</span>
          </Label>
          <Input
            id="website"
            type="url"
            placeholder="https://mindyourbodypt.nl/about"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            We&apos;ll use your About page copy as additional voice context.
          </p>
        </div>

        {/* Emoji policy */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Emojis in your posts?</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "never",     label: "Never",     desc: "Pure text only",         icon: "🚫" },
              { value: "sparingly", label: "Sparingly", desc: "1–2, only when natural", icon: "🟡" },
              { value: "often",     label: "Often",     desc: "Use them freely",         icon: "✅" },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEmojiPolicy(opt.value)}
                className={[
                  "text-left rounded-xl border-2 p-3 transition-colors",
                  emojiPolicy === opt.value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-[hsl(var(--border))] hover:border-indigo-300",
                ].join(" ")}
              >
                <div className="text-lg mb-1">{opt.icon}</div>
                <p className={["text-sm font-medium", emojiPolicy === opt.value ? "text-indigo-700 dark:text-indigo-300" : ""].join(" ")}>{opt.label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {emojiPolicy === "sparingly" && (
            <div className="space-y-1.5 pt-1">
              <label className="text-sm font-medium">Your go-to emojis <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label>
              <EmojiInput value={emojiFavorites} onChange={setEmojiFavorites} />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">AI will only pick from these — no random emojis.</p>
            </div>
          )}
        </div>

        <StepActions onBack={back} onNext={handleNext} loading={saving} nextLabel="Analyse my voice →" />
      </div>
    </StepShell>
  )
}
