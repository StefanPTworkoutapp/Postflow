"use client"

/**
 * PlatformBadge
 *
 * A compact pill or icon that represents a social media platform.
 * Uses componentTokens.platform for consistent brand colors.
 *
 * Variants:
 *   "pill"    — colored pill with emoji + label (default)
 *   "icon"    — emoji only, circular
 *   "dot"     — small colored dot (for calendar pills, compact lists)
 *
 * Usage:
 *   <PlatformBadge platform="instagram" />
 *   <PlatformBadge platform="tiktok" variant="icon" />
 *   <PlatformBadge platform="linkedin" variant="dot" connected />
 */

import { cn } from "@/lib/utils"

export const PLATFORM_META: Record<string, { label: string; emoji: string; bg: string; text: string; border: string }> = {
  instagram: { label: "Instagram",  emoji: "📸", bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4" },
  linkedin:  { label: "LinkedIn",   emoji: "💼", bg: "#DBEAFE", text: "#1E3A5F", border: "#93C5FD" },
  facebook:  { label: "Facebook",   emoji: "👥", bg: "#E0E7FF", text: "#3730A3", border: "#A5B4FC" },
  tiktok:    { label: "TikTok",     emoji: "🎵", bg: "#F4F4F5", text: "#18181B", border: "#D4D4D8" },
  x:         { label: "X",          emoji: "✖",  bg: "#F4F4F5", text: "#18181B", border: "#D4D4D8" },
  threads:   { label: "Threads",    emoji: "🧵", bg: "#F4F4F5", text: "#18181B", border: "#D4D4D8" },
  youtube:   { label: "YouTube",    emoji: "▶️",  bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  buffer:    { label: "Buffer",     emoji: "🔵", bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
}

interface PlatformBadgeProps {
  platform:   string
  variant?:   "pill" | "icon" | "dot"
  /** Show a green "connected" indicator dot */
  connected?: boolean
  className?: string
}

export function PlatformBadge({
  platform,
  variant = "pill",
  connected,
  className,
}: PlatformBadgeProps) {
  const meta = PLATFORM_META[platform.toLowerCase()] ?? {
    label: platform, emoji: "🌐", bg: "#F4F4F5", text: "#18181B", border: "#D4D4D8",
  }

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-block h-2 w-2 rounded-full", className)}
        style={{ backgroundColor: meta.text }}
        title={meta.label}
      />
    )
  }

  if (variant === "icon") {
    return (
      <span
        className={cn(
          "relative inline-flex h-8 w-8 items-center justify-center rounded-full text-sm border",
          className
        )}
        style={{ backgroundColor: meta.bg, borderColor: meta.border }}
        title={meta.label}
      >
        {meta.emoji}
        {connected && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-zinc-900" />
        )}
      </span>
    )
  }

  // Default: pill
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{ backgroundColor: meta.bg, color: meta.text, borderColor: meta.border }}
    >
      {meta.emoji} {meta.label}
      {connected && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 ml-0.5" />
      )}
    </span>
  )
}
