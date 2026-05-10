"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: draft.name ?? "",
      industry: draft.industry ?? "",
      niche: draft.niche ?? "",
    },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    mergeDraft(values)
    await saveToApi({ name: values.name, industry: values.industry, niche: values.niche || null })
    setSaving(false)
    next()
  }

  return (
    <StepShell
      title="Tell us about your business"
      description="This helps us understand your brand and generate better content."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <Label htmlFor="niche">
            Niche <span className="text-[hsl(var(--muted-foreground))]">(optional)</span>
          </Label>
          <Input id="niche" placeholder="e.g. PT Studio – Premium, Amsterdam" {...register("niche")} />
        </div>

        <StepActions nextLabel="Continue" loading={saving} onNext={handleSubmit(onSubmit)} />
      </form>
    </StepShell>
  )
}
