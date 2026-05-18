"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Zap } from "lucide-react"
import type { Database } from "@/types/database.types"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { TOTAL_STEPS } from "@/lib/shared/onboarding/types"
import { Step1Business } from "./steps/Step1Business"
import { Step2Goals } from "./steps/Step2Goals"
import { Step3Identity } from "./steps/Step3Identity"
import { Step4Audience } from "./steps/Step4Audience"
import { Step5Voice } from "./steps/Step5Voice"
import { Step6Analysis } from "./steps/Step6Analysis"
import { Step7SamplePost } from "./steps/Step7SamplePost"
import { Step8Socials } from "./steps/Step8Socials"
import { Step9Frequency } from "./steps/Step9Frequency"
import { Step10Calibration } from "./steps/Step10Calibration"

type Brand = Database["postflow"]["Tables"]["brands"]["Row"]

interface Props {
  existingBrand: Brand | null
}

export function OnboardingWizard({ existingBrand }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(existingBrand ? 2 : 1)
  const [brandId, setBrandId] = useState<string | null>(existingBrand?.id ?? null)
  const [draft, setDraft] = useState<OnboardingDraft>({
    name: existingBrand?.name ?? undefined,
    industry: existingBrand?.industry ?? undefined,
    primary_color: existingBrand?.primary_color ?? "#1A203A",
    secondary_color: existingBrand?.secondary_color ?? "#A8B8A8",
    accent_color: existingBrand?.accent_color ?? "#D4E8C8",
    font_heading: existingBrand?.font_heading ?? "Montserrat",
    font_body: existingBrand?.font_body ?? "Inter",
    posting_frequency: (existingBrand?.posting_frequency as "weekly" | "monthly") ?? "monthly",
    ai_tier: ((existingBrand as unknown as { ai_tier?: string })?.ai_tier as "standard" | "economy") ?? "standard",
  })

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS)) }
  function back() { setStep((s) => Math.max(s - 1, 1)) }

  function mergeDraft(updates: Partial<OnboardingDraft>) {
    setDraft((d) => ({ ...d, ...updates }))
  }

  async function saveToApi(fields: Record<string, unknown>) {
    const res = await fetch("/api/onboarding/save", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_id: brandId, ...fields }),
    })
    const json = await res.json()
    if (json.brand?.id) setBrandId(json.brand.id)
    return json
  }

  const progress = Math.round((step / TOTAL_STEPS) * 100)

  const stepProps = { draft, mergeDraft, brandId, saveToApi, next, back }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-sm">PostFlow</span>
        </div>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">
          Step {step} of {TOTAL_STEPS}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[hsl(var(--muted))]">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {step === 1 && <Step1Business {...stepProps} />}
          {step === 2 && <Step2Goals {...stepProps} />}
          {step === 3 && <Step3Identity {...stepProps} />}
          {step === 4 && <Step4Audience {...stepProps} />}
          {step === 5 && <Step5Voice {...stepProps} />}
          {step === 6 && (
            <Step6Analysis
              {...stepProps}
              onDone={() => next()}
            />
          )}
          {step === 7 && (
            <Step7SamplePost
              {...stepProps}
              onApproved={() => next()}
            />
          )}
          {step === 8 && <Step8Socials {...stepProps} />}
          {step === 9 && (
            <Step9Frequency
              {...stepProps}
              onComplete={async (freq, tier) => {
                await saveToApi({ posting_frequency: freq, ai_tier: tier })
                next()
              }}
            />
          )}
          {step === 10 && (
            <Step10Calibration
              {...stepProps}
              onComplete={async () => {
                router.push("/dashboard")
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
