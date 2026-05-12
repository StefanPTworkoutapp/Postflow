# PostFlow — V3 Implementation Plan

Created: 2026-05-12
Status: Backlog — not yet planned in detail
Prerequisite: V2 complete

Features in V3 are either:
- Expensive to RUN (cost scales with every user action, not just build time), OR
- Require V2 analytics data to be meaningful, OR
- Significant infrastructure additions not justified until revenue supports it

---

## V3A — Expensive-to-run AI features

### AI-generated slide images
**Why V3:** Uses image generation API (DALL-E 3 or equivalent). Charged per image generated,
not per month. At ~$0.04/image, a 7-slide carousel costs ~$0.28 every time a user generates one.
At scale this adds up fast and needs a clear plan-tier gate before building.

**When to build:** Once revenue from Pro/Business tiers covers the per-use cost comfortably,
and analytics show users are hitting the "no stock photo" problem frequently enough to justify it.

**Spec:**
- [ ] Image generation API selection (DALL-E 3 vs Midjourney API vs Stability AI — benchmark quality + cost)
- [ ] Plan gate: Business tier only (or add-on credits)
- [ ] `src/lib/server/media/image-generator.ts` — prompt builder from slide content
- [ ] `POST /api/media/generate-image` route — takes slide topic + brand style → returns image URL
- [ ] PostEditor: "Generate image" button per carousel slide (replaces stock image search for this use case)
- [ ] Cost tracking: log generation events to `postflow.ai_image_usage` table for billing reconciliation
- [ ] Fallback: if generation fails, fall back to stock image search (Unsplash, built in V2)

---

## V3B — Smart Upload → Post Intelligence (original MVP spec)

**Why V3:** Full spec is in `memory/features_mvp.md`. Requires V2 analytics pipeline to be
meaningful — it analyses uploaded content against what's actually performed well.

**Spec (from features_mvp.md):**
- [ ] Upload a photo/video → Claude Vision analyses it → scores content quality + brand fit
- [ ] Suggests which calendar slot it fits, which template, which caption angle
- [ ] Auto-creates a draft post with pre-filled caption from image analysis
- [ ] Wires into brand tokens: approved suggestions nudge `hook_style`, `caption_tone`, etc.

---

## V3C — Advanced scheduling infrastructure

### Per-user infrastructure (when multi-brand scales up)
- [ ] Multi-brand dashboard — manage multiple client brands from one login
- [ ] Brand switcher in sidebar
- [ ] Usage metering per brand (plan limits enforced per brand, not per account)

### Webhook reliability
- [ ] Buffer webhook retry queue — if PostFlow is down, catch up on missed status updates
- [ ] Dead letter queue for failed Inngest jobs — manual retry UI in admin dashboard

---

## V3 Completion criteria

TBD — define when V2 is live and revenue/usage data informs prioritisation.
