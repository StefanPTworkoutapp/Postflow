"use client"

import { useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import { StepShell } from "./StepShell"

const FEEDBACK_OPTIONS = [
  "Too formal",
  "Too casual",
  "Wrong topic",
  "CTA too weak",
  "Off-brand voice",
]

interface Props {
  draft: OnboardingDraft
  brandId: string | null
  back: () => void
  onApproved: () => void
}

export function Step7SamplePost({ draft, brandId, back, onApproved }: Props) {
  const [post, setPost] = useState<{ caption: string; hashtags: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [customFeedback, setCustomFeedback] = useState("")
  const [showFeedback, setShowFeedback] = useState(false)
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    generate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate(previousFeedback?: string) {
    setLoading(true)
    setError(null)
    setShowFeedback(false)
    setFeedback(null)
    setCustomFeedback("")

    try {
      const res = await fetch("/api/ai/sample-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: draft.name,
          industry: draft.industry,
          audience: draft.target_audience_description ?? "",
          tone_profile: draft.tone_profile,
          examples: draft.voice_examples ?? "",
          do_not_mention: draft.do_not_mention,
          previous_feedback: previousFeedback,
          goals: draft.goals ?? [],
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? "Failed to generate post"); return }
      setPost(json)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    onApproved()
  }

  function handleRegenerate() {
    const fb = feedback === "Other" ? customFeedback : feedback ?? undefined
    generate(fb ?? undefined)
  }

  return (
    <StepShell
      title="Here's a sample post in your voice"
      description="Does this sound like you? Approve it or ask for adjustments."
      onBack={back}
    >
      <div className="space-y-4">
        {loading && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Generating sample post…</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-4 text-sm text-[hsl(var(--destructive))]">
            {error}
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => generate()}>
              Try again
            </Button>
          </div>
        )}

        {post && !loading && (
          <>
            {/* Post preview */}
            <div className="rounded-xl border bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-sm">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</p>
              <p className="text-xs text-indigo-500">
                {post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
              </p>
            </div>

            {!showFeedback ? (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleApprove} disabled={approving}>
                  {approving ? "Saving…" : "✓ This sounds like me!"}
                </Button>
                <Button variant="outline" onClick={() => setShowFeedback(true)}>
                  Needs adjustment
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">What needs to change?</p>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFeedback(opt)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs border transition-colors",
                        feedback === opt
                          ? "bg-indigo-500 text-white border-indigo-500"
                          : "border-[hsl(var(--border))] hover:border-indigo-300"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  placeholder="Tell us more (optional)…"
                  value={customFeedback}
                  onChange={(e) => setCustomFeedback(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleRegenerate}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFeedback(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StepShell>
  )
}
