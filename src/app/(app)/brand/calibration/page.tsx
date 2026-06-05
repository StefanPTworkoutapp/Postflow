"use client"

/**
 * /brand/calibration — Brand Intelligence Calibration Wizard
 *
 * 5-question wizard that seeds initial brand intelligence tokens.
 * After completion calls POST /api/brand/calibrate and redirects to
 * /brand?tab=intelligence.
 */

import { useState }       from "react"
import { useRouter }      from "next/navigation"
import { CheckCircle2, ChevronLeft, ChevronRight, Brain } from "lucide-react"
import { Button }         from "@/components/ui/button"
import { cn }             from "@/lib/utils"

// ─── Question definitions ─────────────────────────────────────────────────────

const TOTAL_STEPS = 5

interface OptionQuestion {
  type:     "options"
  key:      string
  question: string
  options:  string[]
}

interface SliderQuestion {
  type:     "slider"
  key:      string
  question: string
  min:      number
  max:      number
  minLabel: string
  maxLabel: string
  default:  number
}

type Question = OptionQuestion | SliderQuestion

const QUESTIONS: Question[] = [
  {
    type:     "options",
    key:      "style",
    question: "How would you describe your posting style?",
    options:  ["Educational", "Entertaining", "Inspirational"],
  },
  {
    type:     "slider",
    key:      "formality",
    question: "How formal is your brand?",
    min:      1,
    max:      10,
    minLabel: "Very casual",
    maxLabel: "Very professional",
    default:  5,
  },
  {
    type:     "options",
    key:      "length",
    question: "What's your average post length?",
    options:  ["Short (1–2 sentences)", "Medium (3–5 sentences)", "Long (paragraph+)"],
  },
  {
    type:     "options",
    key:      "emojis",
    question: "Do you use emojis?",
    options:  ["Never", "Sometimes", "Often"],
  },
  {
    type:     "options",
    key:      "cta",
    question: "What's your main call to action?",
    options:  ["Book a session", "Visit website", "Follow for more", "DM me"],
  },
]

// The API expects exact option labels for non-slider questions,
// but "Short (1–2 sentences)" needs mapping to "Short" etc.
function normaliseOptionValue(key: string, raw: string): string {
  if (key === "length") {
    if (raw.startsWith("Short"))  return "Short"
    if (raw.startsWith("Medium")) return "Medium"
    if (raw.startsWith("Long"))   return "Long"
  }
  return raw
}

// ─── Wizard component ─────────────────────────────────────────────────────────

type Answers = Record<string, string | number>

export default function BrandCalibrationPage() {
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(0)   // 0-indexed
  const [answers,     setAnswers]     = useState<Answers>({
    formality: 5,  // pre-fill slider default
  })
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [done,        setDone]        = useState(false)

  const question    = QUESTIONS[currentStep]
  const isLastStep  = currentStep === TOTAL_STEPS - 1
  const currentVal  = answers[question.key]
  const hasAnswer   = currentVal !== undefined && currentVal !== ""

  function selectOption(value: string) {
    setAnswers(prev => ({ ...prev, [question.key]: value }))
  }

  function handleSlider(value: number) {
    setAnswers(prev => ({ ...prev, [question.key]: value }))
  }

  function goBack() {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  async function goNext() {
    if (!hasAnswer) return

    if (!isLastStep) {
      setCurrentStep(s => s + 1)
      return
    }

    // Last step → submit
    setSubmitting(true)
    setError(null)

    // Build normalised answers payload
    const payload: Record<string, string | number> = {}
    for (const q of QUESTIONS) {
      const raw = answers[q.key]
      if (raw === undefined) continue
      if (q.type === "options" && typeof raw === "string") {
        payload[q.key] = normaliseOptionValue(q.key, raw)
      } else {
        payload[q.key] = raw
      }
    }

    try {
      const res  = await fetch("/api/brand/calibrate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ answers: payload }),
      })
      const data = await res.json() as { success?: boolean; error?: string }

      if (!res.ok || !data.success) {
        setError(data.error ?? "Something went wrong. Please try again.")
        return
      }

      setDone(true)
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Done screen ──────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Calibration complete.</h2>
            <p className="text-muted-foreground">
              Your brand intelligence has been seeded.
            </p>
            <p className="text-sm text-muted-foreground/70">
              Confidence will improve as PostFlow learns from your posts.
            </p>
          </div>
          <Button
            onClick={() => router.push("/brand?tab=intelligence")}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            View Brand Intelligence →
          </Button>
        </div>
      </div>
    )
  }

  // ── Wizard screen ────────────────────────────────────────────────────────────

  const progressPct = Math.round(((currentStep + (hasAnswer ? 1 : 0)) / TOTAL_STEPS) * 100)

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full space-y-8">

        {/* Header */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="h-5 w-5" />
          <span className="text-sm font-medium">Brand Intelligence Calibration</span>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            Question {currentStep + 1} of {TOTAL_STEPS}
          </p>
          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight leading-snug">
            {question.question}
          </h2>

          {/* Option cards */}
          {question.type === "options" && (
            <div className="grid gap-3">
              {question.options.map(opt => {
                const selected = currentVal === opt
                return (
                  <button
                    key={opt}
                    onClick={() => selectOption(opt)}
                    className={cn(
                      "w-full text-left rounded-xl border px-5 py-4 transition-all",
                      "text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                      selected
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-card text-foreground",
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )}

          {/* Slider */}
          {question.type === "slider" && (
            <div className="space-y-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{question.minLabel}</span>
                <span>{question.maxLabel}</span>
              </div>
              <input
                type="range"
                min={question.min}
                max={question.max}
                step={1}
                value={typeof currentVal === "number" ? currentVal : question.default}
                onChange={e => handleSlider(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-center">
                <span className="text-2xl font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                  {typeof currentVal === "number" ? currentVal : question.default}
                  <span className="text-sm font-normal text-muted-foreground"> / 10</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={currentStep === 0 || submitting}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            onClick={goNext}
            disabled={!hasAnswer || submitting}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40"
          >
            {submitting ? (
              <>Saving…</>
            ) : isLastStep ? (
              <>Complete calibration</>
            ) : (
              <>
                Continue
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
