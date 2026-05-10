"use client"

import { useState } from "react"
import { RankedGoalPicker } from "@/components/ui/RankedGoalPicker"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell, StepActions } from "./StepShell"

interface Props {
  draft: OnboardingDraft
  mergeDraft: (u: Partial<OnboardingDraft>) => void
  saveToApi: (fields: Record<string, unknown>) => Promise<unknown>
  next: () => void
  back: () => void
}

export function Step2Goals({ draft, mergeDraft, saveToApi, next, back }: Props) {
  const [selected, setSelected] = useState<string[]>(draft.goals ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleNext() {
    if (selected.length === 0) { setError("Pick at least one goal"); return }
    setSaving(true)
    setError(null)
    mergeDraft({ goals: selected })
    await saveToApi({ goals: selected, primary_goal: selected[0] })
    setSaving(false)
    next()
  }

  return (
    <StepShell
      title="What are your goals?"
      description="Select all that apply — tap in order of priority. First selected = primary goal."
      onBack={back}
    >
      <div className="space-y-4">
        <RankedGoalPicker selected={selected} onChange={setSelected} />
        {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
      </div>
      <div className="mt-6">
        <StepActions onBack={back} onNext={handleNext} loading={saving} />
      </div>
    </StepShell>
  )
}
