"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { step3Schema, FONTS } from "@/lib/shared/onboarding/types"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell, StepActions } from "./StepShell"

type FormValues = z.infer<typeof step3Schema>

interface Props {
  draft: OnboardingDraft
  mergeDraft: (u: Partial<OnboardingDraft>) => void
  saveToApi: (fields: Record<string, unknown>) => Promise<unknown>
  next: () => void
  back: () => void
}

export function Step3Identity({ draft, mergeDraft, saveToApi, next, back }: Props) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      primary_color: draft.primary_color ?? "#1A203A",
      secondary_color: draft.secondary_color ?? "#A8B8A8",
      accent_color: draft.accent_color ?? "#D4E8C8",
      font_heading: draft.font_heading ?? "Montserrat",
      font_body: draft.font_body ?? "Inter",
      tagline: draft.tagline ?? "",
      website_url: draft.website_url ?? "",
    },
  })

  const [pc, sc, ac] = watch(["primary_color", "secondary_color", "accent_color"])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    mergeDraft(values)
    await saveToApi({
      primary_color: values.primary_color,
      secondary_color: values.secondary_color,
      accent_color: values.accent_color,
      font_heading: values.font_heading,
      font_body: values.font_body,
      tagline: values.tagline || null,
      website_url: values.website_url || null,
    })
    setSaving(false)
    next()
  }

  return (
    <StepShell
      title="Your brand identity"
      description="Set your colours and fonts. You can always change these later."
      onBack={back}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Colour preview */}
        <div className="flex gap-3">
          {[
            { label: "Primary", value: pc, field: "primary_color" as const },
            { label: "Secondary", value: sc, field: "secondary_color" as const },
            { label: "Accent", value: ac, field: "accent_color" as const },
          ].map(({ label, value, field }) => (
            <div key={field} className="flex-1 space-y-1.5">
              <Label htmlFor={field}>{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id={field}
                  className="h-9 w-10 cursor-pointer rounded border border-[hsl(var(--input))] p-0.5"
                  {...register(field)}
                />
                {/* Display-only text field — not registered to avoid ref override */}
                <Input
                  className="font-mono text-xs"
                  value={value}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              {errors[field] && (
                <p className="text-xs text-[hsl(var(--destructive))]">{errors[field]?.message}</p>
              )}
            </div>
          ))}
        </div>

        {/* Fonts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="font_heading">Heading font</Label>
            <select
              id="font_heading"
              className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm"
              {...register("font_heading")}
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="font_body">Body font</Label>
            <select
              id="font_body"
              className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm"
              {...register("font_body")}
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Tagline */}
        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline <span className="text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
          <Input id="tagline" placeholder="Move better, live better." {...register("tagline")} />
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="website_url">Website <span className="text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
          <Input id="website_url" type="url" placeholder="https://mindyourbodypt.nl" {...register("website_url")} />
          {errors.website_url && <p className="text-xs text-[hsl(var(--destructive))]">{errors.website_url.message}</p>}
        </div>

        <StepActions onBack={back} loading={saving} onNext={handleSubmit(onSubmit)} />
      </form>
    </StepShell>
  )
}
