"use client"

/**
 * FeedbackRow
 *
 * Reusable inline tone-feedback pill row used on post cards, render previews,
 * and the Trend Builder. Fires a callback with the chosen tag; the parent
 * decides what to do (API call, state update, etc.).
 *
 * Props:
 *   tags        — ordered list of feedback options to render
 *   onSelect    — called with the selected tag string
 *   selected    — currently selected tag (controlled)
 *   disabled    — disables all buttons (e.g. while saving)
 *   size        — "sm" (default) or "md"
 *   className   — extra Tailwind classes on the container
 *
 * Usage:
 *   <FeedbackRow
 *     tags={BASE_FEEDBACK_TAGS}
 *     selected={feedbackGiven}
 *     onSelect={handleFeedback}
 *     disabled={sending}
 *   />
 */

import { cn } from "@/lib/utils"

export interface FeedbackTag {
  type:  string
  label: string
}

// ── Standard tag sets (import these where needed) ─────────────────────────────

export const BASE_FEEDBACK_TAGS: FeedbackTag[] = [
  { type: "great",       label: "👍 Loved it"    },
  { type: "too_formal",  label: "🎩 Too formal"  },
  { type: "too_casual",  label: "😅 Too casual"  },
  { type: "wrong_voice", label: "🎭 Wrong voice" },
  { type: "cta_weak",    label: "📉 Weak CTA"    },
  { type: "too_long",    label: "📏 Too long"    },
  { type: "too_short",   label: "✂️ Too short"   },
]

export const REEL_FEEDBACK_TAGS: FeedbackTag[] = [
  { type: "great_hook",       label: "🎣 Great hook"        },
  { type: "bad_music",        label: "🎵 Bad music"         },
  { type: "too_fast",         label: "⚡ Too fast"           },
  { type: "too_slow",         label: "🐢 Too slow"           },
  { type: "wrong_length",     label: "⏱️ Wrong length"       },
  { type: "doesnt_fit_brand", label: "🚫 Doesn't fit brand" },
]

export const CAROUSEL_FEEDBACK_TAGS: FeedbackTag[] = [
  { type: "too_many_slides",   label: "📚 Too many slides"  },
  { type: "too_few_slides",    label: "📄 Too few slides"   },
  { type: "wrong_content_mix", label: "🔀 Wrong mix"        },
  { type: "text_too_heavy",    label: "📝 Too text-heavy"   },
  { type: "text_too_light",    label: "🖼️ Too image-heavy"  },
  { type: "great_slide_flow",  label: "✨ Great flow"       },
]

// ── Component ──────────────────────────────────────────────────────────────────

interface FeedbackRowProps {
  tags:      FeedbackTag[]
  onSelect:  (type: string) => void
  selected?: string | null
  disabled?: boolean
  size?:     "sm" | "md"
  className?: string
}

export function FeedbackRow({
  tags,
  onSelect,
  selected,
  disabled = false,
  size = "sm",
  className,
}: FeedbackRowProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map(tag => (
        <button
          key={tag.type}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(tag.type)}
          className={cn(
            "rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            size === "sm" && "px-2.5 py-1 text-xs",
            size === "md" && "px-3 py-1.5 text-sm",
            selected === tag.type
              ? "bg-[var(--pf-color-brand-primary)] text-white border-[var(--pf-color-brand-primary)]"
              : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--border))]"
          )}
        >
          {tag.label}
        </button>
      ))}
    </div>
  )
}
