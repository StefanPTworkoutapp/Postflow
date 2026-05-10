"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OnboardingDraft } from "@/lib/shared/onboarding/types"
import type { ToneProfile } from "@/lib/server/ai/extractToneProfile"
import { StepShell } from "./StepShell"

interface Props {
  draft: OnboardingDraft
  mergeDraft: (u: Partial<OnboardingDraft>) => void
  brandId: string | null
  back: () => void
  onDone: () => void
}

export function Step6Analysis({ draft, mergeDraft, brandId, back, onDone }: Props) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")
  const [profile, setProfile] = useState<ToneProfile | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    analyse()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function analyse() {
    setStatus("loading")
    setErrorMsg(null)

    try {
      const res = await fetch("/api/ai/analyze-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          examples: draft.voice_examples,
          brand_name: draft.name,
          industry: draft.industry,
          adjectives: draft.tone_adjectives ?? [],
          tone_level: draft.tone_level ?? 6,
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setErrorMsg(json.error ?? "Analysis failed. Please try again.")
        setStatus("error")
        return
      }

      mergeDraft({ tone_profile: json.profile })
      setProfile(json.profile)
      setStatus("done")
    } catch {
      setErrorMsg("Network error. Please try again.")
      setStatus("error")
    }
  }

  return (
    <StepShell
      title="Analysing your brand voice…"
      description="Claude is reading your examples and building your tone profile."
    >
      <div className="flex flex-col items-center py-10 gap-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              This takes about 10 seconds…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="h-10 w-10 text-[hsl(var(--destructive))]" />
            <p className="text-sm text-[hsl(var(--destructive))]">{errorMsg}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={back}>Go back</Button>
              <Button onClick={analyse}>Try again</Button>
            </div>
          </>
        )}

        {status === "done" && profile && (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-lg font-semibold">Voice profile ready!</p>

            <div className="w-full rounded-lg border bg-[hsl(var(--muted))]/40 p-4 space-y-2 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {profile.personality_traits.map((t) => (
                  <span key={t} className="rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 px-2.5 py-0.5 text-xs font-medium">
                    {t}
                  </span>
                ))}
              </div>
              <p><span className="font-medium">Tone:</span> {profile.tone_level}/10 · {profile.expertise_level}</p>
              <p><span className="font-medium">Sentences:</span> {profile.writing_style.sentence_length} · {profile.writing_style.vocabulary}</p>
              <p><span className="font-medium">Emojis:</span> {profile.emoji_usage}</p>
            </div>

            <Button className="w-full" onClick={onDone}>
              See a sample post →
            </Button>
          </>
        )}
      </div>
    </StepShell>
  )
}
