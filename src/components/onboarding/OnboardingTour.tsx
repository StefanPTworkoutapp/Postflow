"use client"

/**
 * OnboardingTour — 4-screen product walkthrough shown once after signup.
 *
 * Tracks dismissal in localStorage ("postflow_tour_v1").
 * Renders a centred modal overlay with step dots, forward/back navigation,
 * and a skip link. Mounts via AppLayout so it can appear on any route.
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CalendarDays,
  Sparkles,
  BarChart2,
  Rocket,
  ArrowRight,
  X,
} from "lucide-react"

const TOUR_KEY = "postflow_tour_v1"

interface TourStep {
  icon:        React.ReactNode
  eyebrow:     string
  title:       string
  description: string
  bullets:     string[]
  accentColor: string
}

const STEPS: TourStep[] = [
  {
    icon:        <Rocket className="h-8 w-8" />,
    eyebrow:     "Welcome to PostFlow",
    title:       "Your AI-powered content engine",
    description: "PostFlow writes, schedules, and analyses your social content — so you stay consistent without the daily grind.",
    bullets: [
      "One brand profile powers everything",
      "AI writes in your exact tone of voice",
      "Works with LinkedIn, Instagram, Facebook & more",
    ],
    accentColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    icon:        <CalendarDays className="h-8 w-8" />,
    eyebrow:     "Step 1 — Plan",
    title:       "Generate a full month in seconds",
    description: "Tell PostFlow your content mix and it fills your calendar with tailored post ideas, complete with topics, media briefs, and carousel outlines.",
    bullets: [
      "AI plans posts across all your platforms",
      "Drag-and-drop to reschedule anything",
      "Media upload direct from the calendar",
    ],
    accentColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon:        <Sparkles className="h-8 w-8" />,
    eyebrow:     "Step 2 — Create",
    title:       "Captions, carousels, and thumbnails",
    description: "Click any calendar entry to open the Post Editor. PostFlow pre-fills the caption, hashtags, and CTA — you tweak and approve.",
    bullets: [
      "8 branded templates for any post type",
      "Regenerate with a reason if the first draft misses",
      "One-click schedule to Buffer",
    ],
    accentColor: "text-sky-600 dark:text-sky-400",
  },
  {
    icon:        <BarChart2 className="h-8 w-8" />,
    eyebrow:     "Step 3 — Improve",
    title:       "Know what works, do more of it",
    description: "PostFlow pulls in your real engagement numbers weekly, spots patterns, and automatically adjusts future captions to match what your audience loves.",
    bullets: [
      "Impressions, reach, and saves per post",
      "Best day/time heatmap for each platform",
      "AI tone coach learns from your feedback",
    ],
    accentColor: "text-emerald-600 dark:text-emerald-400",
  },
]

export function OnboardingTour() {
  const [visible, setVisible] = useState(false)
  const [step,    setStep]    = useState(0)

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) {
        setVisible(true)
      }
    } catch {
      // Private browsing — silently skip
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(TOUR_KEY, "1")
    } catch {
      // ignore
    }
    setVisible(false)
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function back() {
    if (step > 0) setStep(s => s - 1)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      {/* Modal card */}
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-[hsl(var(--background))] shadow-2xl ring-1 ring-[hsl(var(--border))]">
        {/* Close button */}
        <button
          onClick={dismiss}
          aria-label="Skip tour"
          className="absolute right-4 top-4 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-1.5 pt-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === step
                  ? "w-6 bg-indigo-600 dark:bg-indigo-400"
                  : "w-1.5 bg-[hsl(var(--muted-foreground))]/30 hover:bg-[hsl(var(--muted-foreground))]/50"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pb-4 pt-6 text-center">
          {/* Icon */}
          <div className={cn(
            "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl",
            "bg-[hsl(var(--muted))]",
            current.accentColor
          )}>
            {current.icon}
          </div>

          {/* Eyebrow */}
          <p className={cn("text-xs font-semibold uppercase tracking-widest mb-1", current.accentColor)}>
            {current.eyebrow}
          </p>

          {/* Title */}
          <h2 className="text-xl font-bold tracking-tight mb-3">
            {current.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mb-5">
            {current.description}
          </p>

          {/* Bullets */}
          <ul className="space-y-2 text-left mb-6">
            {current.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className={cn("mt-0.5 flex-shrink-0 text-base leading-none", current.accentColor)}>✓</span>
                <span className="text-[hsl(var(--foreground))]">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-[hsl(var(--border))] px-8 py-4 flex items-center justify-between">
          {/* Back / step count */}
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={back}>
                Back
              </Button>
            ) : (
              <button
                onClick={dismiss}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>

          {/* Next / Finish */}
          <Button
            size="sm"
            onClick={next}
            className="gap-1.5"
          >
            {isLast ? (
              <>
                Get started
                <Rocket className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
