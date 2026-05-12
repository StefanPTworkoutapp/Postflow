/**
 * Component Token Map
 *
 * Derives per-component design decisions from the global token set.
 * Consume these in shared component definitions (e.g. Button variants,
 * Card styles) so that a single token change propagates everywhere.
 *
 * Usage: import { componentTokens } from "@/lib/tokens/components"
 */

import { tokens } from "./design"

export const componentTokens = {
  button: {
    primary: {
      bg:       tokens.color.brand.primary,
      text:     tokens.color.text.inverse,
      hoverBg:  "#0B9090",
      radius:   tokens.radius.lg,
      height:   "44px",
      px:       tokens.space[6],
      weight:   tokens.font.weight.semibold,
    },
    secondary: {
      bg:       tokens.color.surface.subtle,
      text:     tokens.color.text.primary,
      border:   tokens.color.border.default,
      hoverBg:  tokens.color.surface.muted,
      radius:   tokens.radius.lg,
      height:   "44px",
      px:       tokens.space[6],
    },
    ghost: {
      bg:       "transparent",
      text:     tokens.color.text.secondary,
      hoverBg:  tokens.color.surface.subtle,
      radius:   tokens.radius.lg,
      height:   "44px",
      px:       tokens.space[4],
    },
    danger: {
      bg:       tokens.color.semantic.error,
      text:     tokens.color.text.inverse,
      hoverBg:  "#DC2626",
      radius:   tokens.radius.lg,
      height:   "44px",
      px:       tokens.space[6],
    },
  },

  card: {
    default: {
      bg:     tokens.color.surface.base,
      border: tokens.color.border.default,
      radius: tokens.radius.xl,
      shadow: tokens.shadow.card,
      p:      tokens.space[6],
    },
    elevated: {
      bg:     tokens.color.surface.base,
      border: "transparent",
      radius: tokens.radius.xl,
      shadow: tokens.shadow.lg,
      p:      tokens.space[6],
    },
    subtle: {
      bg:     tokens.color.surface.subtle,
      border: tokens.color.border.default,
      radius: tokens.radius.xl,
      shadow: "none",
      p:      tokens.space[5],
    },
  },

  input: {
    default: {
      bg:           tokens.color.surface.base,
      border:       tokens.color.border.default,
      focusBorder:  tokens.color.border.focus,
      radius:       tokens.radius.md,
      height:       "40px",
      px:           tokens.space[3],
      text:         tokens.color.text.primary,
      placeholder:  tokens.color.text.muted,
    },
  },

  badge: {
    default:  { bg: tokens.color.surface.muted,          text: tokens.color.text.secondary },
    brand:    { bg: tokens.color.brand.primary,          text: tokens.color.text.inverse   },
    success:  { bg: "#DCFCE7", text: "#166534" },
    warning:  { bg: "#FEF3C7", text: "#92400E" },
    error:    { bg: "#FEE2E2", text: "#991B1B"  },
    info:     { bg: "#DBEAFE", text: "#1E40AF"  },
  },

  // Platform colors — used by PlatformBadge, calendar pills, etc.
  platform: {
    instagram: { bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4" },
    linkedin:  { bg: "#DBEAFE", text: "#1E3A5F", border: "#93C5FD" },
    facebook:  { bg: "#E0E7FF", text: "#3730A3", border: "#A5B4FC" },
    tiktok:    { bg: "#F4F4F5", text: "#18181B", border: "#D4D4D8" },
    x:         { bg: "#F4F4F5", text: "#18181B", border: "#D4D4D8" },
    threads:   { bg: "#F4F4F5", text: "#18181B", border: "#D4D4D8" },
    youtube:   { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  },

  // Quality score colors — used in MediaGallery badges
  quality: {
    high:   { dot: "#22C55E", label: "Great",  min: 7.5 },
    medium: { dot: "#F59E0B", label: "OK",     min: 4.0 },
    low:    { dot: "#EF4444", label: "Low",    min: 0   },
  },
} as const

export type ComponentTokens = typeof componentTokens
