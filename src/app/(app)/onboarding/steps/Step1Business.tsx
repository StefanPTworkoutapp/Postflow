"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FileText, HelpCircle, Loader2, Sparkles, X } from "lucide-react"
import { step1Schema, INDUSTRIES } from "@/lib/shared/onboarding/types"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell, StepActions } from "./StepShell"

type FormValues = z.infer<typeof step1Schema>

interface Props {
  draft: OnboardingDraft
  mergeDraft: (u: Partial<OnboardingDraft>) => void
  saveToApi: (fields: Record<string, unknown>) => Promise<unknown>
  next: () => void
  back: () => void
}

export function Step1Business({ draft, mergeDraft, saveToApi, next }: Props) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Document import state ────────────────────────────────────────────────
  const [docFile,       setDocFile]       = useState<File | null>(null)
  const [importing,     setImporting]     = useState(false)
  const [importedFields, setImportedFields] = useState<string[]>([])
  const [importError,   setImportError]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name:     draft.name     ?? "",
      industry: draft.industry ?? "",
      niche:    draft.niche    ?? "",
    },
  })

  // ── Import handler ────────────────────────────────────────────────────────
  async function handleImport(file: File) {
    setDocFile(file)
    setImporting(true)
    setImportError(null)
    setImportedFields([])

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res  = await fetch("/api/ai/extract-brand-from-document", { method: "POST", body: formData })
      const data = await res.json() as Record<string, unknown>

      if (!res.ok || data.error) {
        setImportError((data.error as string) ?? "Extraction failed — try a different file.")
        return
      }

      // Fill in Step 1 fields directly
      const filled: string[] = []
      if (typeof data.name     === "string" && data.name)     { setValue("name",     data.name,     { shouldValidate: true }); filled.push("Business name") }
      if (typeof data.niche    === "string" && data.niche)    { setValue("niche",    data.niche,    { shouldValidate: true }); filled.push("Niche") }

      // Merge everything else into the wizard draft (populates later steps)
      const laterFields: Partial<OnboardingDraft> = {}
      if (typeof data.tagline                      === "string") laterFields.tagline                      = data.tagline
      if (typeof data.website_url                  === "string") laterFields.website_url                  = data.website_url
      if (typeof data.target_audience_description  === "string") laterFields.target_audience_description  = data.target_audience_description
      if (typeof data.geographic_location          === "string") laterFields.geographic_location          = data.geographic_location
      if (typeof data.voice_examples               === "string") laterFields.voice_examples               = data.voice_examples
      if (Array.isArray(data.goals) && data.goals.length > 0)   laterFields.goals                        = data.goals as string[]

      if (laterFields.tagline)                     filled.push("Tagline")
      if (laterFields.website_url)                 filled.push("Website")
      if (laterFields.target_audience_description) filled.push("Target audience")
      if (laterFields.geographic_location)         filled.push("Location")
      if (laterFields.voice_examples)              filled.push("Voice examples")
      if (laterFields.goals?.length)               filled.push("Goals")

      if (Object.keys(laterFields).length > 0) mergeDraft(laterFields)
      setImportedFields(filled)

    } catch {
      setImportError("Network error — please try again.")
    } finally {
      setImporting(false)
    }
  }

  function clearImport() {
    setDocFile(null)
    setImportedFields([])
    setImportError(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    setSaving(true)
    setSaveError(null)
    mergeDraft(values)
    try {
      const result = await saveToApi({ name: values.name, industry: values.industry, niche: values.niche || null })
      if ((result as { error?: string }).error) {
        setSaveError((result as { error?: string }).error ?? "Failed to save. Please try again.")
        return
      }
      next()
    } catch {
      setSaveError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell
      title="Tell us about your business"
      description="This helps us understand your brand and generate better content."
    >
      {/* ── Optional document import ──────────────────────────────────────── */}
      <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
            <p className="text-sm font-medium">Have a brand guide or ToV document?</p>
          </div>
          {docFile && !importing && (
            <button type="button" onClick={clearImport} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!docFile ? (
          <>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Upload it and we'll pre-fill your name, niche, audience, voice examples and more — so you can fly through the rest.
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <FileText className="h-4 w-4" />
              Upload PDF, Word or TXT
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
              }}
            />
          </>
        ) : importing ? (
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your document…
          </div>
        ) : importError ? (
          <p className="text-xs text-[hsl(var(--destructive))]">{importError}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
              <span className="font-medium truncate">{docFile.name}</span>
            </div>
            {importedFields.length > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Pre-filled: {importedFields.join(" · ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Manual fields ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Business name *</Label>
          <Input id="name" placeholder="MindyourBody PT Studio" {...register("name")} />
          {errors.name && <p className="text-xs text-[hsl(var(--destructive))]">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="industry">Industry *</Label>
          <select
            id="industry"
            className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
            {...register("industry")}
          >
            <option value="">Select your industry…</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          {errors.industry && <p className="text-xs text-[hsl(var(--destructive))]">{errors.industry.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="niche">
              Niche <span className="text-[hsl(var(--muted-foreground))]">(optional)</span>
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px] text-xs leading-relaxed">
                Be specific about <strong>who</strong> you serve and <strong>what</strong> makes you different.
                This sharpens the AI's content and trend research.
                <br /><br />
                <span className="text-[hsl(var(--muted-foreground))]">
                  e.g. "Online PT for busy mums" · "SaaS for personal trainers" · "Luxury yoga studio, Amsterdam"
                </span>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input id="niche" placeholder="e.g. Online PT for busy mums, Amsterdam" {...register("niche")} />
        </div>

        {saveError && (
          <p className="text-xs text-[hsl(var(--destructive))] rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 px-3 py-2">
            {saveError}
          </p>
        )}
        <StepActions nextLabel="Continue" loading={saving} onNext={handleSubmit(onSubmit)} />
      </form>
    </StepShell>
  )
}
