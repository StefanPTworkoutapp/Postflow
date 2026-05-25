"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, ImagePlus, Lightbulb, Loader2, X } from "lucide-react"
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
  { id: "ai", label: "AI behaviour" },
  { id: "sharing", label: "Client sharing" },
] as const

type Tab = (typeof TABS)[number]["id"]

type StyleVolatility = "steady" | "mixed" | "experimental"

const STYLE_VOLATILITY_OPTIONS = [
  {
    value: "steady" as StyleVolatility,
    icon: "🏛️",
    label: "Steady",
    tagline: "Consistent brand identity",
    desc: "~85% proven formats + ~15% exploratory. Ideal for corporate or professional brands that need to project reliability.",
  },
  {
    value: "mixed" as StyleVolatility,
    icon: "⚖️",
    label: "Mixed",
    tagline: "Balanced growth",
    desc: "~70% proven formats + ~30% exploratory. The default — expands reach while keeping brand recognition intact.",
  },
  {
    value: "experimental" as StyleVolatility,
    icon: "🚀",
    label: "Experimental",
    tagline: "Growth-focused testing",
    desc: "~50% proven formats + ~50% exploratory. Best for new brands or campaigns where maximising learning is the goal.",
  },
] as const

interface PortalInvite {
  id:             string
  email:          string
  created_at:     string
  expires_at:     string | null
  last_viewed_at: string | null
}

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

  // Document upload state
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docExtracting, setDocExtracting] = useState(false)
  const [docExtracted, setDocExtracted] = useState(false)
  const [docExtractError, setDocExtractError] = useState<string | null>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  // ── Goals ─────────────────────────────────────────────────
  const [goals, setGoals] = useState<string[]>(
    (brand as unknown as { goals?: string[] }).goals ?? (brand.primary_goal ? [brand.primary_goal] : [])
  )
  const [postingFrequency, setPostingFrequency] = useState<"weekly" | "monthly">(
    (brand.posting_frequency as "weekly" | "monthly") ?? "monthly"
  )
  const [aiTier, setAiTier] = useState<"standard" | "economy">(
    ((brand as unknown as { ai_tier?: string }).ai_tier as "standard" | "economy") ?? "standard"
  )

  // ── AI behaviour ──────────────────────────────────────────
  // Read current style_volatility_preference from intelligence_tokens (set at calibration,
  // user can override here — writes through nudgeToken with signal_type "manual")
  const initialStyleVolatility = (): StyleVolatility => {
    const tokens = (brand as unknown as { intelligence_tokens?: Record<string, { value: string }> }).intelligence_tokens
    const val = tokens?.style_volatility_preference?.value
    if (val === "steady" || val === "mixed" || val === "experimental") return val
    return "mixed" // default until calibration seeds it
  }
  const [styleVolatility, setStyleVolatility] = useState<StyleVolatility>(initialStyleVolatility)
  const [styleVolatilitySaving, setStyleVolatilitySaving] = useState(false)
  const [styleVolatilitySaved, setStyleVolatilitySaved] = useState(false)
  const [styleVolatilityError, setStyleVolatilityError] = useState<string | null>(null)

  // ── Client sharing (portal invites) ───────────────────────
  const [portalEmail, setPortalEmail] = useState("")
  const [portalExpiry, setPortalExpiry] = useState<number | "">(30)
  const [portalSending, setPortalSending] = useState(false)
  const [portalResult, setPortalResult] = useState<{ url: string } | null>(null)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [invites, setInvites] = useState<PortalInvite[] | null>(null)
  const [invitesLoading, setInvitesLoading] = useState(false)

  // ── Side effects ──────────────────────────────────────────
  useEffect(() => {
    if (tab === "sharing") loadInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

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

  async function handleDocExtract() {
    if (!docFile) return
    setDocExtracting(true)
    setDocExtractError(null)
    try {
      const formData = new FormData()
      formData.append("file", docFile)
      const res = await fetch("/api/ai/extract-from-document", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok || json.error) { setDocExtractError(json.error ?? "Extraction failed"); return }
      setVoiceExamples((prev) => {
        const sep = prev.trim() ? "\n\n---\n\n" : ""
        return prev.trim() + sep + json.text
      })
      setDocExtracted(true)
    } catch {
      setDocExtractError("Network error. Please try again.")
    } finally {
      setDocExtracting(false)
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

  // ── Portal invite handlers ────────────────────────────────

  async function loadInvites() {
    if (invites !== null) return // already loaded
    setInvitesLoading(true)
    try {
      const res = await fetch(`/api/portal/invites?brandId=${brand.id}`)
      const json = await res.json()
      if (res.ok) setInvites(json.invites ?? [])
    } finally {
      setInvitesLoading(false)
    }
  }

  async function sendInvite() {
    if (!portalEmail.trim()) return
    setPortalSending(true)
    setPortalError(null)
    setPortalResult(null)
    try {
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId:       brand.id,
          email:         portalEmail.trim(),
          expiresInDays: portalExpiry === "" ? undefined : portalExpiry,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setPortalError(json.error ?? "Failed to send invite")
      } else {
        setPortalResult({ url: json.portalUrl })
        setPortalEmail("")
        // Append to local invites list
        setInvites((prev) =>
          prev
            ? [{ id: json.inviteId, email: portalEmail.trim(), created_at: new Date().toISOString(), expires_at: null, last_viewed_at: null }, ...prev]
            : null
        )
      }
    } catch {
      setPortalError("Network error. Please try again.")
    } finally {
      setPortalSending(false)
    }
  }

  // ── AI behaviour save ─────────────────────────────────────

  async function saveStyleVolatility(value: StyleVolatility) {
    setStyleVolatility(value)
    setStyleVolatilitySaving(true)
    setStyleVolatilityError(null)
    setStyleVolatilitySaved(false)
    try {
      const res = await fetch(`/api/brands/${brand.id}/token`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenKey: "style_volatility_preference", value }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setStyleVolatilityError(json.error ?? "Failed to save")
      } else {
        setStyleVolatilitySaved(true)
        setTimeout(() => setStyleVolatilitySaved(false), 3000)
      }
    } catch {
      setStyleVolatilityError("Network error. Please try again.")
    } finally {
      setStyleVolatilitySaving(false)
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
        ai_tier: aiTier,
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

            {/* Document upload */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t" />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">or upload a ToV document</span>
                <div className="flex-1 border-t" />
              </div>

              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Brand guide, style document, or any file with writing examples.
                Supports PDF, Word (.docx), and plain text.
              </p>

              {/* Drop zone */}
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-[hsl(var(--border))] hover:border-indigo-300 p-5 flex flex-col items-center gap-2 transition-colors"
              >
                <FileText className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Click to upload a document</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">PDF, DOCX, or TXT · max 10 MB</p>
              </button>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setDocFile(f)
                  setDocExtracted(false)
                  setDocExtractError(null)
                  e.target.value = ""
                }}
              />

              {docFile && (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-[hsl(var(--muted))]/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span className="text-sm truncate">{docFile.name}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                      {(docFile.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDocFile(null); setDocExtracted(false) }}
                    className="ml-2 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {docExtractError && (
                <p className="text-xs text-[hsl(var(--destructive))]">{docExtractError}</p>
              )}

              {docFile && !docExtracted && (
                <Button
                  variant="outline"
                  onClick={handleDocExtract}
                  disabled={docExtracting}
                  className="gap-2"
                >
                  {docExtracting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Extracting voice examples…</>
                    : `Extract voice examples from ${docFile.name} →`
                  }
                </Button>
              )}

              {docExtracted && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ Voice examples extracted and added below
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

            <div className="space-y-2">
              <Label>AI generation quality</Label>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Controls which Claude model generates your captions and calendar.
              </p>
              <div className="space-y-2">
                {([
                  {
                    value:   "standard" as const,
                    label:   "Standard",
                    badge:   "Recommended",
                    desc:    "Claude Sonnet — best quality for captions and calendars.",
                    detail:  "Full reasoning, nuanced tone, stronger brand voice adherence.",
                    badgeCn: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
                  },
                  {
                    value:   "economy" as const,
                    label:   "Economy",
                    badge:   "Cost-effective",
                    desc:    "Claude Haiku for captions — lower cost, slightly simpler output.",
                    detail:  "Great for high-volume posting. Calendar stays on Sonnet.",
                    badgeCn: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
                  },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAiTier(opt.value)}
                    className={cn(
                      "w-full text-left rounded-lg border-2 px-4 py-3 transition-colors",
                      aiTier === opt.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                        : "border-[hsl(var(--border))] hover:border-indigo-300"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("text-sm font-medium", aiTier === opt.value && "text-indigo-700 dark:text-indigo-300")}>
                        {opt.label}
                      </span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", opt.badgeCn)}>
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{opt.desc}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-70">{opt.detail}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── AI behaviour ── */}
        {tab === "ai" && (
          <div className="space-y-6">
            {/* Style volatility */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Content style balance</Label>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">
                  Controls how PostFlow balances proven formats with experimental content.
                  Proven formats protect your brand identity; exploratory posts help discover
                  what works with new audiences or tactics.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {STYLE_VOLATILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => saveStyleVolatility(opt.value)}
                    disabled={styleVolatilitySaving}
                    className={cn(
                      "text-left rounded-xl border-2 p-3.5 transition-colors relative",
                      styleVolatility === opt.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                        : "border-[hsl(var(--border))] hover:border-indigo-300"
                    )}
                  >
                    {styleVolatility === opt.value && (
                      <span className="absolute top-2 right-2 text-indigo-500 text-xs font-medium">✓</span>
                    )}
                    <div className="text-xl mb-1.5">{opt.icon}</div>
                    <p className={cn(
                      "text-sm font-medium",
                      styleVolatility === opt.value && "text-indigo-700 dark:text-indigo-300"
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mt-0.5">
                      {opt.tagline}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 leading-relaxed">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Feedback row */}
              <div className="flex items-center gap-3 h-6">
                {styleVolatilitySaving && (
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </div>
                )}
                {styleVolatilitySaved && !styleVolatilitySaving && (
                  <span className="text-xs text-green-600 dark:text-green-400">Preference saved — takes effect on next post generation</span>
                )}
                {styleVolatilityError && !styleVolatilitySaving && (
                  <span className="text-xs text-[hsl(var(--destructive))]">{styleVolatilityError}</span>
                )}
              </div>
            </div>

            {/* Context note */}
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-4 space-y-1.5">
              <p className="text-sm font-medium">How PostFlow uses this</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Every time PostFlow generates a caption or calendar entry, it reads your style
                balance preference and adjusts the content mix accordingly. <strong>Steady</strong> keeps
                your established voice front-and-centre. <strong>Mixed</strong> allows some
                variation to keep content fresh. <strong>Experimental</strong> actively tests new
                angles to find what resonates with your audience.
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Analytics will continue to reinforce what performs well regardless of this setting —
                this controls the starting point for each new post, not the learning itself.
              </p>
            </div>
          </div>
        )}

        {/* ── Client sharing ── */}
        {tab === "sharing" && (
          <div className="space-y-6">
            {/* Send invite */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Send a portal link</Label>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">
                  Your client will get a read-only link showing the next 60 days of scheduled posts.
                  They can approve or flag each post — no account needed.
                  <span className="ml-1 font-medium text-indigo-600 dark:text-indigo-400">Pro plan required.</span>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={portalEmail}
                    onChange={(e) => setPortalEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                    className="flex-1"
                  />
                  <select
                    value={portalExpiry}
                    onChange={(e) => setPortalExpiry(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] shrink-0"
                  >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value="">No expiry</option>
                  </select>
                  <Button size="sm" onClick={sendInvite} disabled={portalSending || !portalEmail.trim()}>
                    {portalSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send"}
                  </Button>
                </div>

                {portalError && (
                  <p className="text-xs text-[hsl(var(--destructive))]">{portalError}</p>
                )}

                {portalResult && (
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-3 py-2.5 space-y-1.5">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">✓ Invite sent! Portal link:</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={portalResult.url}
                        className="flex-1 text-xs font-mono bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 rounded px-2 py-1 text-green-800 dark:text-green-300"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(portalResult.url); }}
                        className="text-xs text-green-700 dark:text-green-400 hover:underline shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Existing invites */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Active portal links</Label>
              {invitesLoading && (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              )}
              {invites !== null && invites.length === 0 && !invitesLoading && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No portal links yet.</p>
              )}
              {invites !== null && invites.length > 0 && (
                <div className="space-y-2">
                  {invites.map((invite) => {
                    const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date()
                    return (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate">{invite.email}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                            Sent {new Date(invite.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            {invite.expires_at && (
                              <span className={cn("ml-1.5", isExpired ? "text-[hsl(var(--destructive))]" : "")}>
                                · {isExpired ? "expired" : `expires ${new Date(invite.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 ml-3">
                          {invite.last_viewed_at ? (
                            <span className="text-green-600 dark:text-green-400">
                              Viewed {new Date(invite.last_viewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          ) : (
                            <span>Not viewed yet</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save bar — only shown for tabs that use the shared handleSave */}
        {tab !== "ai" && tab !== "sharing" && (
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
          {error && <span className="text-sm text-[hsl(var(--destructive))]">{error}</span>}
        </div>
        )}
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
