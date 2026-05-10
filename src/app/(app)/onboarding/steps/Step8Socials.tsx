"use client"

import { Button } from "@/components/ui/button"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell } from "./StepShell"

const PLATFORMS = [
  { id: "instagram", label: "Instagram", note: "Manual posting — we'll send reminders" },
  { id: "linkedin", label: "LinkedIn", note: "Auto-post via Buffer" },
  { id: "facebook", label: "Facebook", note: "Auto-post via Buffer" },
  { id: "tiktok", label: "TikTok", note: "Manual posting — we'll send reminders" },
]

interface Props {
  draft: OnboardingDraft
  next: () => void
  back: () => void
}

export function Step8Socials({ next, back }: Props) {
  return (
    <StepShell
      title="Connect your social accounts"
      description="Connect platforms for analytics and auto-posting. You can skip this and connect later in Settings."
      onBack={back}
    >
      <div className="space-y-3">
        {PLATFORMS.map(({ id, label, note }) => (
          <div
            key={id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{note}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Coming soon — set up in Settings after onboarding"
            >
              Connect
            </Button>
          </div>
        ))}

        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          OAuth connections are configured in Settings → Integrations.
        </p>
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={back}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={next}>Skip for now</Button>
          <Button onClick={next}>Continue</Button>
        </div>
      </div>
    </StepShell>
  )
}
