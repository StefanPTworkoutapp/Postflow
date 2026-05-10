"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { step4Schema, TONE_ADJECTIVES } from "@/lib/shared/onboarding/types"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell, StepActions } from "./StepShell"

type FormValues = z.infer<typeof step4Schema>

interface Props {
  draft: OnboardingDraft
  mergeDraft: (u: Partial<OnboardingDraft>) => void
  saveToApi: (fields: Record<string, unknown>) => Promise<unknown>
  next: () => void
  back: () => void
}

export function Step4Audience({ draft, mergeDraft, saveToApi, next, back }: Props) {
  const [saving, setSaving] = useState(false)
  const [adjectives, setAdjectives] = useState<string[]>(draft.tone_adjectives ?? [])

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      target_audience_description: draft.target_audience_description ?? "",
      target_age_range: draft.target_age_range ?? "",
      geographic_location: draft.geographic_location ?? "",
      tone_adjectives: draft.tone_adjectives ?? [],
      tone_level: draft.tone_level ?? 6,
      do_not_mention: draft.do_not_mention ?? "",
    },
  })

  function toggleAdj(adj: string) {
    const next = adjectives.includes(adj)
      ? adjectives.filter((a) => a !== adj)
      : [...adjectives, adj]
    setAdjectives(next)
    setValue("tone_adjectives", next)
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    mergeDraft({ ...values })
    await saveToApi({
      target_audience_description: values.target_audience_description,
      target_age_range: values.target_age_range || null,
      geographic_location: values.geographic_location || null,
      do_not_mention: values.do_not_mention
        ? values.do_not_mention.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
    })
    setSaving(false)
    next()
  }

  return (
    <StepShell
      title="Your audience & tone"
      description="The more detail you give, the better Claude understands your voice."
      onBack={back}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="audience">Describe your ideal client *</Label>
          <textarea
            id="audience"
            rows={3}
            className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
            placeholder="Active adults aged 30–55 who have chronic pain or sports injuries and want to move better without surgery…"
            {...register("target_audience_description")}
          />
          {errors.target_audience_description && (
            <p className="text-xs text-[hsl(var(--destructive))]">{errors.target_audience_description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="age">Age range <span className="text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
            <Input id="age" placeholder="30–55" {...register("target_age_range")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location <span className="text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
            <Input id="location" placeholder="Amsterdam, NL" {...register("geographic_location")} />
          </div>
        </div>

        {/* Tone adjectives */}
        <div className="space-y-2">
          <Label>Brand personality <span className="text-xs text-[hsl(var(--muted-foreground))]">(pick 2–5)</span></Label>
          <div className="flex flex-wrap gap-2">
            {TONE_ADJECTIVES.map((adj) => (
              <button
                key={adj}
                type="button"
                onClick={() => toggleAdj(adj)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  adjectives.includes(adj)
                    ? "bg-indigo-500 text-white border-indigo-500"
                    : "border-[hsl(var(--border))] hover:border-indigo-300"
                )}
              >
                {adj}
              </button>
            ))}
          </div>
          {errors.tone_adjectives && (
            <p className="text-xs text-[hsl(var(--destructive))]">{errors.tone_adjectives.message}</p>
          )}
        </div>

        {/* Tone level slider */}
        <div className="space-y-2">
          <Label htmlFor="tone_level">
            Tone level — <span className="font-normal text-[hsl(var(--muted-foreground))]">1 = Very formal &nbsp;·&nbsp; 10 = Very casual</span>
          </Label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Formal</span>
            <input type="range" min={1} max={10} step={1} className="flex-1" {...register("tone_level", { valueAsNumber: true })} />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Casual</span>
          </div>
        </div>

        {/* Do not mention */}
        <div className="space-y-1.5">
          <Label htmlFor="dnm">Topics to never mention <span className="text-[hsl(var(--muted-foreground))]">(optional, comma-separated)</span></Label>
          <Input id="dnm" placeholder="competitors, pricing, political topics" {...register("do_not_mention")} />
        </div>

        <StepActions onBack={back} loading={saving} onNext={handleSubmit(onSubmit)} />
      </form>
    </StepShell>
  )
}
