"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell } from "./StepShell"

const OPTIONS: { value: "weekly" | "monthly"; label: string; description: string }[] = [
  {
    value: "weekly",
    label: "Weekly",
    description: "I film content weekly and post 3–5× per week.",
  },
  {
    value: "monthly",
    label: "Monthly",
    description: "I film content in one batch monthly and plan ahead.",
  },
]

interface Props {
  draft: OnboardingDraft
  back: () => void
  onComplete: (frequency: "weekly" | "monthly") => Promise<void>
}

export function Step9Frequency({ draft, back, onComplete }: Props) {
  const [selected, setSelected] = useState<"weekly" | "monthly">(
    draft.posting_frequency ?? "monthly"
  )
  const [saving, setSaving] = useState(false)

  async function handleDone() {
    setSaving(true)
    await onComplete(selected)
  }

  return (
    <StepShell
      title="How often do you create content?"
      description="This determines how we build your calendar."
      onBack={back}
    >
      <div className="space-y-3">
        {OPTIONS.map(({ value, label, description }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSelected(value)}
            className={cn(
              "w-full text-left rounded-lg border-2 p-4 transition-colors",
              selected === value
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                : "border-[hsl(var(--border))] hover:border-indigo-300"
            )}
          >
            <p className={cn("font-medium text-sm", selected === value && "text-indigo-700 dark:text-indigo-300")}>{label}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={back}>Back</Button>
        <Button onClick={handleDone} disabled={saving}>
          {saving ? "Setting up your dashboard…" : "Finish setup 🎉"}
        </Button>
      </div>
    </StepShell>
  )
}
