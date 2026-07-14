/**
 * Template registry — maps slug → TemplateDefinition.
 *
 * To add a new template:
 *   1. Create src/lib/server/render/templates/<slug>.ts
 *   2. Export `buildHtml` and `definition` from it
 *   3. Add it to the `allTemplates` array below
 */

export type { TemplateData, TemplateDefinition, BrandVars, SlideContent } from "./types"

import { definition as photoOverlay }  from "./photo-overlay"
import { definition as eduBold }       from "./edu-bold"
import { definition as quoteCard }     from "./quote-card"
import { definition as darkStatement } from "./dark-statement"
import { definition as tipNumbered }   from "./tip-numbered"
import { definition as carouselEdu }   from "./carousel-edu"
import { definition as carouselMyth }  from "./carousel-myth"
import { definition as reelCover }     from "./reel-cover"
import { definition as storyTeaser }   from "./story-teaser"
import { definition as xStatement }      from "./x-statement"
import { definition as linkedinInsight } from "./linkedin-insight"
import { definition as tiktokCover }     from "./tiktok-cover"
import type { TemplateDefinition }     from "./types"

/** All registered templates, ordered by sort_order matching the DB seed */
export const allTemplates: TemplateDefinition[] = [
  photoOverlay,   // ← default for photo posts (full-bleed photo + overlay)
  eduBold,
  quoteCard,
  darkStatement,
  tipNumbered,
  carouselEdu,
  carouselMyth,
  reelCover,
  storyTeaser,
  xStatement,       // ← dedicated X single-image card
  linkedinInsight,  // ← dedicated LinkedIn single-image card
  tiktokCover,      // ← dedicated TikTok photo-mode single-image card
]

/** O(1) lookup by slug */
const registry = new Map<string, TemplateDefinition>(
  allTemplates.map((t) => [t.slug, t])
)

/**
 * Returns the TemplateDefinition for the given slug.
 * Throws if the slug is unknown — callers should validate before calling.
 */
export function getTemplate(slug: string): TemplateDefinition {
  const tmpl = registry.get(slug)
  if (!tmpl) throw new Error(`Unknown template slug: "${slug}"`)
  return tmpl
}

/**
 * Returns templates available for a given platform.
 * platform = null returns all templates.
 */
export function getTemplatesForPlatform(platform: string | null): TemplateDefinition[] {
  if (!platform) return allTemplates
  return allTemplates.filter(
    (t) => t.platforms === null || t.platforms.includes(platform)
  )
}

/**
 * Returns only carousel-type templates.
 */
export function getCarouselTemplates(): TemplateDefinition[] {
  return allTemplates.filter((t) => t.type === "carousel")
}
