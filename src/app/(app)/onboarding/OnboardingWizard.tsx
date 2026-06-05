"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Zap } from "lucide-react"
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

// ── localStorage persistence ──────────────────────────────────────────────────
const STORAGE_KEY = "postflow_onboarding_v1"

interface SavedState {
  draft:   OnboardingDraft
  step:    number
  brandId: string | null
}

// NOTE: only call from client-side code (useEffect / event handlers)
function loadSavedState(existingBrandId: string | null): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedState
    // Discard saved state if it belongs to a different brand
    if (existingBrandId && saved.brandId && saved.brandId !== existingBrandId) return null
    return saved
  } catch {
    return null
  }
}

function persistState(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* storage full / unavailable */ }
}

export function clearSavedState() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// ── Fields pre-filled by document import — live in later steps ────────────────
// Flushed to the DB the moment the brand is first created so they're never lost.
const LATER_STEP_FIELDS = [
  "tagline", "website_url", "target_audience_description",
  "geographic_location", "voice_examples", "goals",
] as const

// ── Build base draft from server data ────────────────────────────────────────
function serverDraft(existingBrand: Brand | null): OnboardingDraft {
  return {
    name:              existingBrand?.name              ?? undefined,
    industry:          existingBrand?.industry          ?? undefined,
    primary_color:     existingBrand?.primary_color     ?? "#1A203A",
    secondary_color:   existingBrand?.secondary_color   ?? "#A8B8A8",
    accent_color:      existingBrand?.accent_color      ?? "#D4E8C8",
    font_heading:      existingBrand?.font_heading       ?? "Montserrat",
    font_body:         existingBrand?.font_body          ?? "Inter",
    posting_frequency: (existingBrand?.posting_frequency as "weekly" | "monthly") ?? "monthly",
    ai_tier:           ((existingBrand as unknown as { ai_tier?: string })?.ai_tier as "standard" | "economy") ?? "standard",
  }
}

export function OnboardingWizard({ existingBrand }: Props) {
  const router = useRouter()

  // ── State — initialised from server data only (SSR-safe) ─────────────────
  // localStorage is restored client-side in the hydration useEffect below.
  const [hydrated,  setHydrated]  = useState(false)
  const [step,      setStep]      = useState<number>(existingBrand ? 2 : 1)
  const [brandId,   setBrandId]   = useState<string | null>(existingBrand?.id ?? null)
  const [draft,     setDraft]     = useState<OnboardingDraft>(() => serverDraft(existingBrand))
  const [skipping,  setSkipping]  = useState(false)

  // ── Hydration: restore from localStorage on first client mount ───────────
  // This MUST be in useEffect — useState initialisers run during SSR where
  // window/localStorage are unavailable, so any saved step would be lost.
  useEffect(() => {
    const saved = loadSavedState(existingBrand?.id ?? null)
    if (saved) {
      if (saved.draft) setDraft(d => ({ ...d, ...saved.draft }))

      if (existingBrand) {
        // Server confirms brand exists — restore step and use server-confirmed brandId
        if (saved.step && saved.step > 1) setStep(saved.step)
        setBrandId(existingBrand.id)
      } else if (saved.brandId) {
        // Server says no brand exists but localStorage claims one.
        // The brand was never actually created (failed save, deleted, stale session).
        // Keep the draft data so the user doesn't have to retype, but force step 1
        // and clear the stale brandId so brand creation runs fresh.
        clearSavedState()
        persistState({ draft: { ...serverDraft(existingBrand), ...saved.draft }, step: 1, brandId: null })
        // step and brandId already default to 1 / null — no setStep/setBrandId needed
      }
    }
    setHydrated(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // existingBrand is stable (server prop) — safe to omit

  // ── Persist to localStorage on every meaningful change ───────────────────
  useEffect(() => {
    if (!hydrated) return  // don't overwrite good saved state before we've loaded it
    persistState({ draft, step, brandId })
  }, [draft, step, brandId, hydrated])

  // ── Flush imported-doc fields to the DB when the brand is first created ──
  const prevBrandId = useRef<string | null>(brandId)
  useEffect(() => {
    if (brandId && !prevBrandId.current) {
      const extra: Record<string, unknown> = {}
      for (const field of LATER_STEP_FIELDS) {
        const val = draft[field as keyof OnboardingDraft]
        if (val !== undefined && val !== null && val !== "") extra[field] = val
      }
      if (Object.keys(extra).length > 0) {
        fetch("/api/onboarding/save", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ brand_id: brandId, ...extra }),
        }).catch(console.error)
      }
    }
    prevBrandId.current = brandId
  }, [brandId]) // eslint-disable-line react-hooks/exhaustive-deps

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS)) }
  function back() { setStep((s) => Math.max(s - 1, 1)) }

  function mergeDraft(updates: Partial<OnboardingDraft>) {
    setDraft((d) => ({ ...d, ...updates }))
  }

  async function saveToApi(fields: Record<string, unknown>) {
    const res = await fetch("/api/onboarding/save", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ brand_id: brandId, ...fields }),
    })
    const json = await res.json() as { brand?: { id: string } }
    if (json.brand?.id) setBrandId(json.brand.id)
    return json
  }

  // ── Skip handler ─────────────────────────────────────────────────────────
  async function handleSkip() {
    setSkipping(true)
    try {
      // Save current draft progress and mark as skipped
      await fetch("/api/onboarding/save", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          brand_id:           brandId,
          onboarding_skipped: true,
          ...draft,
        }),
      })
    } catch {
      // Best-effort — still redirect even if save fails
    }
    // Store skip flag so /create can show the banner
    try { sessionStorage.setItem("postflow_onboarding_skipped", "1") } catch { /* ignore */ }
    clearSavedState()
    router.push("/create")
  }

  // ── Loading gate: don't render steps until localStorage has been checked ──
  // This prevents a flash of step 1 before the saved step is restored.
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--pf-teal)]" />
      </div>
    )
  }

  const progress   = Math.round((step / TOTAL_STEPS) * 100)
  const stepProps  = { draft, mergeDraft, brandId, saveToApi, next, back }
  // Skip visible on steps 3–9 (not 1, 2, or 10)
  const showSkip   = step >= 3 && step <= 9

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--pf-teal)]" />
          <span className="font-semibold text-sm">PostFlow</span>
        </div>
        <div className="flex items-center gap-4">
          {showSkip && (
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-50"
            >
              {skipping ? "Saving…" : "Skip setup — create first post →"}
            </button>
          )}
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Step {step} of {TOTAL_STEPS}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[hsl(var(--muted))] h-1">
        <div
          className="h-1 bg-[var(--pf-teal)] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {step === 1  && <Step1Business {...stepProps} />}
          {step === 2  && <Step2Goals {...stepProps} />}
          {step === 3  && <Step3Identity {...stepProps} />}
          {step === 4  && <Step4Audience {...stepProps} />}
          {step === 5  && <Step5Voice {...stepProps} />}
          {step === 6  && <Step6Analysis {...stepProps} onDone={() => next()} />}
          {step === 7  && <Step7SamplePost {...stepProps} onApproved={() => next()} />}
          {step === 8  && <Step8Socials {...stepProps} />}
          {step === 9  && (
            <Step9Frequency
              {...stepProps}
              onComplete={async (freq, tier) => {
                const result = await saveToApi({ posting_frequency: freq, ai_tier: tier })
                if (!(result as { error?: string }).error) next()
              }}
            />
          )}
          {step === 10 && (
            <Step10Calibration
              {...stepProps}
              onComplete={async () => {
                clearSavedState()
                router.push("/dashboard")
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
