"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RankedGoalPicker } from "@/components/ui/RankedGoalPicker"
import { INDUSTRIES } from "@/lib/shared/onboarding/types"
import { UpgradeBrandModal } from "@/components/layout/UpgradeBrandModal"

type Step = 1 | 2

export function AddBrandWizard() {
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState("")
  const [industry, setIndustry] = useState("")
  const [goals, setGoals] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [limitModal, setLimitModal] = useState<{
    open: boolean
    plan: string
    limit: number
    upgradeTo: string | null
  }>({ open: false, plan: "free", limit: 1, upgradeTo: null })

  // ── Step 1 validation ──────────────────────────────────────────────────
  const step1Valid = name.trim().length >= 2 && industry.length > 0

  function goToStep2() {
    if (!step1Valid) return
    setError(null)
    setStep(2)
  }

  // ── Step 2 submit ──────────────────────────────────────────────────────
  async function createBrand() {
    if (goals.length === 0) {
      setError("Pick at least one goal")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry,
          primary_goal: goals[0],
        }),
      })

      if (res.status === 403) {
        const data = await res.json() as {
          error: string
          plan: string
          limit: number
          upgradeTo: string | null
        }
        if (data.error === "brand_limit_reached") {
          setLimitModal({
            open: true,
            plan: data.plan,
            limit: data.limit,
            upgradeTo: data.upgradeTo,
          })
          setSubmitting(false)
          return
        }
      }

      const data = await res.json() as { brand?: { id: string }, error?: string }
      if (!res.ok || !data.brand) {
        setError(data.error ?? "Failed to create brand")
        setSubmitting(false)
        return
      }

      // Set the new brand as active, then send the user to the brand setup page.
      await fetch("/api/brands/active", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId: data.brand.id }),
      })

      // Hard navigation so server components re-read the cookie.
      window.location.href = "/brand?setup=1"
    } catch {
      setError("Network error — please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <p className="text-xs font-medium tracking-wide uppercase text-[hsl(var(--muted-foreground))]">
        Step {step} of 2
      </p>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Add a new brand</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Start with the basics — you can complete the rest of the setup right after.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Brand name *</Label>
              <Input
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My second brand"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-industry">Industry *</Label>
              <select
                id="brand-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              >
                <option value="">Select your industry…</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-[hsl(var(--destructive))] rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => router.back()} type="button">Cancel</Button>
            <Button onClick={goToStep2} disabled={!step1Valid}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">What are your goals?</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Pick the goals that matter most. We&apos;ll prioritise content that supports them.
            </p>
          </div>

          <RankedGoalPicker selected={goals} onChange={setGoals} />

          {error && (
            <p className="text-xs text-[hsl(var(--destructive))] rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} type="button" disabled={submitting}>Back</Button>
            <Button onClick={createBrand} disabled={submitting || goals.length === 0}>
              {submitting ? "Creating…" : "Create brand"}
            </Button>
          </div>
        </div>
      )}

      <UpgradeBrandModal
        open={limitModal.open}
        onClose={() => setLimitModal((s) => ({ ...s, open: false }))}
        currentPlan={limitModal.plan}
        limit={limitModal.limit}
        upgradeTo={limitModal.upgradeTo}
      />
    </div>
  )
}
