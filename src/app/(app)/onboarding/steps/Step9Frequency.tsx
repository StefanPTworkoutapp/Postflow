"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import type { AiTier } from "@/lib/ai/models"
import { StepShell } from "./StepShell"

const FREQUENCY_OPTIONS: { value: "weekly" | "monthly"; label: string; description: string }[] = [
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

const TIER_OPTIONS: {
  value: AiTier
  label: string
  badge: string
  description: string
  detail: string
}[] = [
  {
    value:       "standard",
    label:       "Standard",
    badge:       "Recommended",
    description: "Claude Sonnet — best quality for captions and calendars.",
    detail:      "Full reasoning, nuanced tone, stronger adherence to brand voice.",
  },
  {
    value:       "economy",
    label:       "Economy",
    badge:       "Cost-effective",
    description: "Claude Haiku for captions — lower cost, slightly simpler output.",
    detail:      "Great for high-volume posting. Calendar stays on Sonnet for reliability.",
  },
]

interface Props {
  draft: OnboardingDraft
  back: () => void
  onComplete: (frequency: "weekly" | "monthly", tier: AiTier) => Promise<void>
}

export function Step9Frequency({ draft, back, onComplete }: Props) {
  const [frequency, setFrequency] = useState<"weekly" | "monthly">(
    draft.posting_frequency ?? "monthly"
  )
  const [tier, setTier] = useState<AiTier>(draft.ai_tier ?? "standard")
  const [saving, setSaving] = useState(false)

  async function handleDone() {
    setSaving(true)
    await onComplete(frequency, tier)
  }

  return (
    <StepShell
      title="Final setup"
      description="Set your posting rhythm and AI generation quality."
      onBack={back}
    >
      <div className="space-y-6">

        {/* ── Posting frequency ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium">How often do you create content?</p>
          <div className="space-y-2">
            {FREQUENCY_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFrequency(value)}
                className={cn(
                  "w-full text-left rounded-lg border-2 p-4 transition-colors",
                  frequency === value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-[hsl(var(--border))] hover:border-indigo-300"
                )}
              >
                <p className={cn("font-medium text-sm", frequency === value && "text-indigo-700 dark:text-indigo-300")}>
                  {label}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── AI generation tier ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium">AI generation quality</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Controls which Claude model generates your captions and content ideas.
            You can change this anytime in Brand → Goals.
          </p>
          <div className="space-y-2">
            {TIER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTier(opt.value)}
                className={cn(
                  "w-full text-left rounded-lg border-2 p-4 transition-colors",
                  tier === opt.value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-[hsl(var(--border))] hover:border-indigo-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <p className={cn("font-medium text-sm", tier === opt.value && "text-indigo-700 dark:text-indigo-300")}>
                    {opt.label}
                  </p>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-medium",
                    opt.value === "standard"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
                  )}>
                    {opt.badge}
                  </span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{opt.description}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 opacity-70">{opt.detail}</p>
              </button>
            ))}
          </div>
        </div>

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
