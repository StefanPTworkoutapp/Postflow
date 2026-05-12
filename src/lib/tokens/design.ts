/**
 * PostFlow Design Token System
 *
 * Single source of truth for all visual decisions.
 * These values are consumed two ways:
 *   1. As CSS custom properties in globals.css (via the --pf-* variables)
 *   2. As typed JS constants in server-side render templates and shared logic
 *
 * Changing a token here cascades to every consumer.
 * Brand kit values (user colors/fonts) are resolved at render time — they do NOT
 * live here. This file is PostFlow's own design system, not the user's brand.
 */

export const tokens = {
  color: {
    brand: {
      primary:   "#0DA5A5", // Teal — PostFlow app identity
      secondary: "#1A203A", // Navy
      accent:    "#D4E8C8", // Lime green
    },
    semantic: {
      success: "#22C55E",
      warning: "#F59E0B",
      error:   "#EF4444",
      info:    "#3B82F6",
    },
    surface: {
      base:    "#FFFFFF",
      subtle:  "#F8F9FA",
      muted:   "#F1F3F5",
      overlay: "rgba(0,0,0,0.48)",
    },
    text: {
      primary:   "#0F172A",
      secondary: "#475569",
      muted:     "#94A3B8",
      inverse:   "#FFFFFF",
      brand:     "#0DA5A5",
    },
    border: {
      default: "#E2E8F0",
      strong:  "#CBD5E1",
      focus:   "#0DA5A5",
    },
  },

  font: {
    family: {
      display: '"Montserrat", sans-serif',
      body:    '"Inter", sans-serif',
      mono:    '"JetBrains Mono", monospace',
    },
    size: {
      xs:   "0.75rem",
      sm:   "0.875rem",
      base: "1rem",
      lg:   "1.125rem",
      xl:   "1.25rem",
      "2xl":"1.5rem",
      "3xl":"1.875rem",
      "4xl":"2.25rem",
    },
    weight: {
      normal:   "400",
      medium:   "500",
      semibold: "600",
      bold:     "700",
    },
    leading: {
      tight:   "1.25",
      normal:  "1.5",
      relaxed: "1.625",
    },
  },

  space: {
    0:  "0",
    1:  "0.25rem",
    2:  "0.5rem",
    3:  "0.75rem",
    4:  "1rem",
    5:  "1.25rem",
    6:  "1.5rem",
    8:  "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
  },

  radius: {
    sm:   "0.375rem",
    md:   "0.5rem",
    lg:   "0.75rem",
    xl:   "1rem",
    "2xl":"1.5rem",
    full: "9999px",
  },

  shadow: {
    sm:   "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md:   "0 4px 6px -1px rgb(0 0 0 / 0.07)",
    lg:   "0 10px 15px -3px rgb(0 0 0 / 0.08)",
    xl:   "0 20px 25px -5px rgb(0 0 0 / 0.10)",
    card: "0 2px 8px 0 rgb(0 0 0 / 0.06)",
  },

  motion: {
    duration: {
      fast:   "120ms",
      normal: "200ms",
      slow:   "350ms",
      enter:  "250ms",
      exit:   "180ms",
    },
    easing: {
      default: "cubic-bezier(0.16, 1, 0.3, 1)",
      spring:  "cubic-bezier(0.34, 1.56, 0.64, 1)",
      out:     "cubic-bezier(0, 0, 0.2, 1)",
    },
  },

  z: {
    base:    0,
    raised:  10,
    overlay: 100,
    drawer:  200,
    modal:   300,
    toast:   400,
  },
} as const

export type Tokens = typeof tokens

// ── Flat CSS variable map ─────────────────────────────────────────────────────
// Used by globals.css to set --pf-* CSS custom properties.
// Keys become CSS variable names: e.g. "color-brand-primary" → --pf-color-brand-primary

export const cssVarMap: Record<string, string> = {
  "color-brand-primary":   tokens.color.brand.primary,
  "color-brand-secondary": tokens.color.brand.secondary,
  "color-brand-accent":    tokens.color.brand.accent,

  "color-semantic-success": tokens.color.semantic.success,
  "color-semantic-warning": tokens.color.semantic.warning,
  "color-semantic-error":   tokens.color.semantic.error,
  "color-semantic-info":    tokens.color.semantic.info,

  "color-surface-base":    tokens.color.surface.base,
  "color-surface-subtle":  tokens.color.surface.subtle,
  "color-surface-muted":   tokens.color.surface.muted,
  "color-surface-overlay": tokens.color.surface.overlay,

  "color-text-primary":   tokens.color.text.primary,
  "color-text-secondary": tokens.color.text.secondary,
  "color-text-muted":     tokens.color.text.muted,
  "color-text-inverse":   tokens.color.text.inverse,
  "color-text-brand":     tokens.color.text.brand,

  "color-border-default": tokens.color.border.default,
  "color-border-strong":  tokens.color.border.strong,
  "color-border-focus":   tokens.color.border.focus,

  "radius-sm":   tokens.radius.sm,
  "radius-md":   tokens.radius.md,
  "radius-lg":   tokens.radius.lg,
  "radius-xl":   tokens.radius.xl,
  "radius-2xl":  tokens.radius["2xl"],
  "radius-full": tokens.radius.full,

  "shadow-sm":   tokens.shadow.sm,
  "shadow-md":   tokens.shadow.md,
  "shadow-lg":   tokens.shadow.lg,
  "shadow-xl":   tokens.shadow.xl,
  "shadow-card": tokens.shadow.card,

  "motion-duration-fast":   tokens.motion.duration.fast,
  "motion-duration-normal": tokens.motion.duration.normal,
  "motion-duration-slow":   tokens.motion.duration.slow,
  "motion-easing-default":  tokens.motion.easing.default,
  "motion-easing-spring":   tokens.motion.easing.spring,
  "motion-easing-out":      tokens.motion.easing.out,
}
