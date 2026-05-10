"use client"

import { useRef, useState } from "react"
import { ImagePlus, Lightbulb, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { INDUSTRIES, FONTS } from "@/lib/shared/onboarding/types"
import { RankedGoalPicker } from "@/components/ui/RankedGoalPicker"
import { EmojiInput } from "@/components/ui/EmojiInput"
import type { Database } from "@/types/database.types"

type Brand = Database["postflow"]["Tables"]["brands"]["Row"]

const TABS = [
  { id: "identity", label: "Identity" },
  { id: "audience", label: "Audience" },
  { id: "voice", label: "Voice" },
  { id: "goals", label: "Goals" },
] as const

type Tab = (typeof TABS)[number]["id"]

interface PreviewImage {
  url: string
  data: string
  mediaType: string
}

interface Props {
  brand: Brand
}

export function BrandEditor({ brand }: Props) {
  const [tab, setTab] = useState<Tab>("identity")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Identity ──────────────────────────────────────────────
  const [name, setName] = useState(brand.name ?? "")
  const [industry, setIndustry] = useState(brand.industry ?? "")
  const [logoUrl, setLogoUrl] = useState<string | null>(brand.logo_url ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [niche, setNiche] = useState(brand.niche ?? "")
  const [tagline, setTagline] = useState(brand.tagline ?? "")
  const [websiteUrl, setWebsiteUrl] = useState(brand.website_url ?? "")
  const [primaryColor, setPrimaryColor] = useState(brand.primary_color ?? "#1A203A")
  const [secondaryColor, setSecondaryColor] = useState(brand.secondary_color ?? "#A8B8A8")
  const [accentColor, setAccentColor] = useState(brand.accent_color ?? "#D4E8C8")
  const [fontHeading, setFontHeading] = useState(brand.font_heading ?? "Montserrat")
  const [fontBody, setFontBody] = useState(brand.font_body ?? "Inter")
  const [templateStyle, setTemplateStyle] = useState(brand.template_style ?? 50)

  // ── Audience ──────────────────────────────────────────────
  const [audienceDesc, setAudienceDesc] = useState(brand.target_audience_description ?? "")
  const [ageRange, setAgeRange] = useState(brand.target_age_range ?? "")
  const [location, setLocation] = useState(brand.geographic_location ?? "")
  const [doNotMention, setDoNotMention] = useState(
    (brand.do_not_mention ?? []).join(", ")
  )

  // ── Voice ─────────────────────────────────────────────────
  const [voiceExamples, setVoiceExamples] = useState(
    ((brand.tone_examples as string[] | null)?.[0]) ?? ""
  )
  const [emojiPolicy, setEmojiPolicy] = useState<"never" | "sparingly" | "often">(
    ((brand as unknown as { emoji_policy?: string }).emoji_policy as "never" | "sparingly" | "often") ?? "sparingly"
  )
  const [emojiFavorites, setEmojiFavorites] = useState<string>(
    (brand as unknown as { emoji_favorites?: string }).emoji_favorites ?? ""
  )
  const [images, setImages] = useState<PreviewImage[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Goals ─────────────────────────────────────────────────
  const [goals, setGoals] = useState<string[]>(
    (brand as unknown as { goals?: string[] }).goals ?? (brand.primary_goal ? [brand.primary_goal] : [])
  )
  const [postingFrequency, setPostingFrequency] = useState<"weekly" | "monthly">(
    (brand.posting_frequency as "weekly" | "monthly") ?? "monthly"
  )

  // ── Image helpers ─────────────────────────────────────────

  async function resizeToBase64(file: File): Promise<{ data: string; mediaType: string }> {
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
        canvas.width = width; canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82)
        resolve({ data: dataUrl.split(",")[1], mediaType: "image/jpeg" })
      }
      img.onerror = reject
      img.src = objectUrl
    })
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = 5 - images.length
    const toAdd = files.slice(0, remaining)
    const previews = await Promise.all(
      toAdd.map(async (file) => {
        const { data, mediaType } = await resizeToBase64(file)
        return { url: URL.createObjectURL(file), data, mediaType }
      })
    )
    setImages((prev) => [...prev, ...previews])
    setExtracted(false)
    setExtractError(null)
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setExtracted(false)
  }

  async function handleExtract() {
    if (!images.length) return
    setExtracting(true)
    setExtractError(null)
    try {
      const res = await fetch("/api/ai/extract-from-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map(({ data, mediaType }) => ({ data, mediaType })),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setExtractError(json.error ?? "Extraction failed"); return }
      setVoiceExamples((prev) => {
        const sep = prev.trim() ? "\n\n---\n\n" : ""
        return prev.trim() + sep + json.text
      })
      setExtracted(true)
      setImages([])
    } catch {
      setExtractError("Network error. Please try again.")
    } finally {
      setExtracting(false)
    }
  }

  // ── Logo upload ───────────────────────────────────────────

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setLogoError(null)
    setLogoUploading(true)
    try {
      // 1. Get signed URL
      const urlRes = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      })
      const { signedUrl, path, publicUrl, error: urlErr } = await urlRes.json()
      if (urlErr) throw new Error(urlErr)

      // 2. Upload to storage
      const up = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!up.ok) throw new Error("Upload failed")

      // 3. Save logo_url on the brand
      const saveRes = await fetch("/api/onboarding/save", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id, logo_url: publicUrl }),
      })
      const saveJson = await saveRes.json()
      if (saveJson.error) throw new Error(saveJson.error)

      setLogoUrl(publicUrl)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setLogoUploading(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const payload: Record<string, unknown> = { brand_id: brand.id }

    if (tab === "identity") {
      Object.assign(payload, {
        name, industry,
        niche: niche || null,
        tagline: tagline || null,
        website_url: websiteUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        font_heading: fontHeading,
        font_body: fontBody,
        template_style: templateStyle,
      })
    } else if (tab === "audience") {
      Object.assign(payload, {
        target_audience_description: audienceDesc,
        target_age_range: ageRange || null,
        geographic_location: location || null,
        do_not_mention: doNotMention
          ? doNotMention.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      })
    } else if (tab === "voice") {
      Object.assign(payload, {
        tone_examples:    voiceExamples ? [voiceExamples] : null,
        emoji_policy:     emojiPolicy,
        emoji_favorites:  emojiPolicy === "sparingly" && emojiFavorites.trim() ? emojiFavorites.trim() : null,
      })
    } else if (tab === "goals") {
      Object.assign(payload, {
        goals: goals.length ? goals : null,
        primary_goal: goals[0] ?? null,
        posting_frequency: postingFrequency,
      })
    }

    try {
      const res = await fetch("/api/onboarding/save", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to save")
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-5 max-w-xl">

        {/* ── Identity ── */}
        {tab === "identity" && (
          <>
            {/* Logo */}
            <div className="space-y-1.5">
              <Label>Logo <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(optional)</span></Label>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-16 w-16 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0",
                  logoUrl ? "border-transparent" : "border-[hsl(var(--border))]"
                )}>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-[hsl(var(--muted-foreground))]/50" />
                  )}
                </div>
                <div className="space-y-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoUploading
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                      : logoUrl ? "Replace logo" : "Upload logo"}
                  </Button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  )}
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">PNG, SVG or JPG · max 2 MB</p>
                  {logoError && <p className="text-xs text-[hsl(var(--destructive))]">{logoError}</p>}
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>

            <Field label="Business name *">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Industry *">
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              >
                <option value="">Select an industry…</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </Field>
            <Field label="Niche / speciality" optional>
              <Input placeholder="e.g. ACL rehab, padel physio" value={niche} onChange={(e) => setNiche(e.target.value)} />
            </Field>
            <Field label="Tagline" optional>
              <Input placeholder="e.g. Move better, live better." value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </Field>
            <Field label="Website URL" optional>
              <Input type="url" placeholder="https://yoursite.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <ColorField label="Primary" value={primaryColor} onChange={setPrimaryColor} />
              <ColorField label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
              <ColorField label="Accent" value={accentColor} onChange={setAccentColor} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Heading font"><FontSelect value={fontHeading} onChange={setFontHeading} /></Field>
              <Field label="Body font"><FontSelect value={fontBody} onChange={setFontBody} /></Field>
            </div>

            {/* Template style slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Card style</Label>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {templateStyle <= 20 ? "Clean & minimal"
                    : templateStyle <= 40 ? "Refined"
                    : templateStyle <= 60 ? "Balanced"
                    : templateStyle <= 80 ? "Expressive"
                    : "Bold & vivid"}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={templateStyle}
                  onChange={(e) => setTemplateStyle(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-600"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) ${templateStyle}%, hsl(var(--border)) ${templateStyle}%)`
                  }}
                />
                <div className="flex justify-between mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <span>Minimal</span>
                  <span>Bold</span>
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Controls typography weight, colour saturation, and spacing in your branded cards.
              </p>
            </div>
          </>
        )}

        {/* ── Audience ── */}
        {tab === "audience" && (
          <>
            <Field label="Who is your target audience? *">
              <textarea
                rows={4}
                className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                placeholder="e.g. Amateur padel players aged 30–50 dealing with overuse injuries…"
                value={audienceDesc}
                onChange={(e) => setAudienceDesc(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Age range" optional>
                <Input placeholder="e.g. 25–45" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
              </Field>
              <Field label="Location" optional>
                <Input placeholder="e.g. Netherlands" value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
            </div>
            <Field label="Do not mention" optional>
              <Input
                placeholder="e.g. competitors, specific prices"
                value={doNotMention}
                onChange={(e) => setDoNotMention(e.target.value)}
              />
            </Field>
          </>
        )}

        {/* ── Voice ── */}
        {tab === "voice" && (
          <div className="space-y-4">
            {/* Tone learning suggestion */}
            {brand.tone_suggestion && (
              <ToneSuggestionCard
                suggestion={brand.tone_suggestion}
                feedbackType={brand.tone_suggestion_type}
                brandId={brand.id}
              />
            )}
            {/* Screenshot upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Upload screenshots</Label>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {images.length}/5 — add more one by one or in a batch
                </span>
              </div>

              {/* Drop zone — always visible so they can keep adding */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 5}
                className={cn(
                  "w-full rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors",
                  images.length >= 5
                    ? "border-[hsl(var(--border))] opacity-40 cursor-not-allowed"
                    : "border-[hsl(var(--border))] hover:border-indigo-300 cursor-pointer"
                )}
              >
                <ImagePlus className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {images.length >= 5 ? "Maximum 5 reached" : "Click to add screenshots"}
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

              {/* Thumbnails */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Screenshot ${i + 1}`} className="h-20 w-auto rounded-lg border object-cover" />
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

              {extractError && (
                <p className="text-xs text-[hsl(var(--destructive))]">{extractError}</p>
              )}

              {images.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleExtract}
                  disabled={extracting}
                  className="gap-2"
                >
                  {extracting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Extracting…</>
                    : `Extract text from ${images.length} screenshot${images.length > 1 ? "s" : ""} →`
                  }
                </Button>
              )}

              {extracted && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ Text extracted and added below
                </p>
              )}
            </div>

            {/* Emoji policy */}
            <div className="space-y-2">
              <Label>Emoji usage in posts</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "never",     label: "Never",      desc: "No emojis at all",           icon: "🚫" },
                  { value: "sparingly", label: "Sparingly",  desc: "1–2 max, only when natural",  icon: "🟡" },
                  { value: "often",     label: "Often",      desc: "Use freely throughout",       icon: "✅" },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEmojiPolicy(opt.value)}
                    className={cn(
                      "text-left rounded-xl border-2 p-3 transition-colors",
                      emojiPolicy === opt.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                        : "border-[hsl(var(--border))] hover:border-indigo-300"
                    )}
                  >
                    <div className="text-lg mb-1">{opt.icon}</div>
                    <p className={cn("text-sm font-medium", emojiPolicy === opt.value && "text-indigo-700 dark:text-indigo-300")}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Favourite emojis — only shown for sparingly */}
            {emojiPolicy === "sparingly" && (
              <div className="space-y-1.5">
                <Label>Your go-to emojis <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
                <EmojiInput value={emojiFavorites} onChange={setEmojiFavorites} />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  AI will only use these — no random emojis.
                </p>
              </div>
            )}

            {/* Text area — always editable, images append to it */}
            <Field label="Example posts (editable)">
              <textarea
                rows={10}
                className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                placeholder={"Paste posts directly, or extract them from screenshots above.\n\nSeparate multiple posts with --- on its own line."}
                value={voiceExamples}
                onChange={(e) => setVoiceExamples(e.target.value)}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Saving here updates stored examples.{" "}
                <a href="/onboarding" className="text-indigo-500 underline">Re-run onboarding</a>{" "}
                to regenerate your AI tone profile.
              </p>
            </Field>
          </div>
        )}

        {/* ── Goals ── */}
        {tab === "goals" && (
          <>
            <div className="space-y-2">
              <Label>Goals <span className="font-normal text-[hsl(var(--muted-foreground))]">— tap in order of priority</span></Label>
              <RankedGoalPicker selected={goals} onChange={setGoals} />
            </div>
            <div className="space-y-2">
              <Label>Posting frequency</Label>
              <div className="space-y-2">
                {(["weekly", "monthly"] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setPostingFrequency(freq)}
                    className={cn(
                      "w-full text-left rounded-lg border-2 px-4 py-3 text-sm transition-colors capitalize",
                      postingFrequency === freq
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "border-[hsl(var(--border))] hover:border-indigo-300"
                    )}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Save bar */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
          {error && <span className="text-sm text-[hsl(var(--destructive))]">{error}</span>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {optional && <span className="ml-1 text-[hsl(var(--muted-foreground))] font-normal">(optional)</span>}
      </Label>
      {children}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2 items-center">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 rounded border cursor-pointer p-0.5" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" maxLength={7} />
      </div>
    </div>
  )
}

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
    >
      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
  )
}

// ── Tone Suggestion Card ──────────────────────────────────────────────────────

const FEEDBACK_LABELS: Record<string, string> = {
  too_formal:  "too formal",
  too_casual:  "too casual",
  wrong_voice: "wrong brand voice",
  weak_cta:    "weak CTA",
}

function ToneSuggestionCard({
  suggestion,
  feedbackType,
  brandId,
}: {
  suggestion:   string
  feedbackType: string | null
  brandId:      string
}) {
  const [dismissed, setDismissed] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  if (dismissed) return null

  const label = feedbackType ? FEEDBACK_LABELS[feedbackType] ?? feedbackType : null

  async function handleDismiss() {
    setDismissing(true)
    try {
      await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone_suggestion: null, tone_suggestion_type: null, tone_suggestion_at: null }),
      })
      setDismissed(true)
    } finally {
      setDismissing(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
              Tone learning suggestion
              {label && <span className="font-normal ml-1 opacity-70">· based on "{label}" feedback</span>}
            </p>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
              {suggestion}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 shrink-0 mt-0.5"
        >
          {dismissing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
