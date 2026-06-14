# Spec: Brand Voice Overview — Live AI Profile + User Control

**Status:** Not built (onboarding collects data, but no permanent UI to view/edit it)
**Phase:** H2 (brand editor) + H4 improvement
**Priority:** High — brands can't see or correct what AI thinks about their voice

---

## Problem

The AI extracts a detailed tone profile from onboarding (do_use, do_not_use, personality
traits, signature phrases, writing style). This profile drives EVERY caption generated.
But users have no way to:
- See what the AI extracted
- Correct wrong extractions
- Add new rules they want respected
- See when the tone loop updates their profile

This creates a black box: the brand thinks AI is writing in their voice, but has no
visibility or control. If extraction was wrong, every caption is wrong.

---

## Solution: Brand Voice tab in brand editor

**URL:** `/brands/[id]/edit?tab=voice`  
(Part of Phase H2 brand editor at `/brands/[id]/edit`)

---

## Layout

```
┌─ Brand: MindYourBody PT ─────────────────────────────────────────────────┐
│  [Overview] [Voice ← active] [Templates] [Connections]                   │
│                                                                            │
│  ┌─ AI Voice Profile ────────────────────────────────────────────────────┐│
│  │ Last updated: 3 days ago by tone learning loop    [Refresh manually]  ││
│  │                                                                        ││
│  │ Tone level: [████████░░] 8/10 — Formal-leaning                        ││
│  │ Personality: [professional] [educational] [empowering]                 ││
│  │ Expertise: Advanced                                                    ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│  ┌─ What AI uses ───────────────────────────────────────────────────────┐ │
│  │  ✅ DO use                     ❌ DON'T use                           │ │
│  │  • Rhetorical questions        • "Easy"                              │ │
│  │  • Numbered lists              • "Just"                              │ │
│  │  • Client success stories      • "Simple"                            │ │
│  │  [+ Add rule]  [Edit]          [+ Add rule]  [Edit]                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌─ Signature phrases ─────────────────────────────────────────────────┐ │
│  │  "Move with intention"   "Train smart, not hard"   [+ Add]  [Edit]  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌─ Example posts (AI training samples) ──────────────────────────────┐  │
│  │  3 posts on file                      [View]  [Add more]  [Clear]  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─ Your custom rules ─────────────────────────────────────────────────┐ │
│  │ Things AI must ALWAYS do:                                            │ │
│  │ [textarea: "Always mention the free trial in promotional posts"]     │ │
│  │                                                                      │ │
│  │ Things AI must NEVER do:                                             │ │
│  │ [textarea: "Never compare us to competitors by name"]               │ │
│  │                                          [Save changes]              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌─ AI Update History ─────────────────────────────────────────────────┐ │
│  │  Jun 10 — Tone loop nudged: caption_tone → more conversational      │ │
│  │  Jun 3  — You edited: added "Never use competitor names"            │ │
│  │  May 28 — Initial extraction from 4 example posts                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data model

### Existing fields used (already on `brands` table)
- `tone_profile` JSONB — contains `do_use`, `do_not_use`, `personality_traits`, `tone_level`, `signature_phrases`, `writing_style`
- `tone_examples` TEXT[] — raw example posts
- `intelligence_tokens` JSONB — AI-learned token values (tone, style, etc.)

### New fields needed on `brands` table

```sql
ALTER TABLE postflow.brands
  ADD COLUMN custom_do_rules     TEXT,    -- freeform: "always do X"
  ADD COLUMN custom_dont_rules   TEXT,    -- freeform: "never do Y"
  ADD COLUMN voice_updated_at    TIMESTAMPTZ;
```

### New migration: `20260615000001_brand_voice_custom_rules.sql`

---

## How custom rules flow into generation

In `generateCaption.ts`, after the tone profile block:

```
${brand.custom_do_rules ? `BRAND CUSTOM RULES — ALWAYS:\n${brand.custom_do_rules}` : ''}
${brand.custom_dont_rules ? `BRAND CUSTOM RULES — NEVER:\n${brand.custom_dont_rules}` : ''}
```

These are injected as absolute constraints, overriding any inferred behaviour.

---

## Editing the AI profile

When a user edits do_use / do_not_use / signature phrases / tone level:
1. Save changes directly to `brands.tone_profile` JSONB
2. Log a `brand_token_events` row with `signal_type: "manual"` + the change description
3. Show confirmation: "Your voice profile has been updated. New posts will use these rules."

When user clicks "Refresh manually" (triggers a fresh tone extraction):
1. Call `/api/ai/analyze-tone` with existing `tone_examples`
2. Re-run `extractToneProfile`
3. Merge result into existing profile (don't overwrite manual edits to do_use/do_not_use)
4. Log the refresh event

---

## AI Update History

Source: `brand_token_events` table (already exists).
Query: `brand_id = x ORDER BY created_at DESC LIMIT 20`
Filter: show only `signal_type IN ('manual', 'calibration', 'feedback')`
Display: human-readable descriptions per `token_key` change.

```typescript
// Human-readable label per token_key
const TOKEN_LABELS: Record<string, string> = {
  caption_tone:     "Caption tone",
  carousel_hook_style: "Carousel opening style",
  // etc.
}
```

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/brands/[id]/voice` | Return full voice profile + history |
| PATCH | `/api/brands/[id]/voice` | Update do_use, do_not_use, phrases, custom rules |
| POST | `/api/brands/[id]/voice/refresh` | Re-run tone extraction from existing examples |

---

## Plans gating

| Feature | Plans |
|---------|-------|
| View voice profile | All plans |
| Edit do_use / do_not_use | Starter+ |
| Custom do/don't rules textarea | Pro+ |
| Manual refresh | Starter+ |
| AI Update History | Pro+ |

---

## Acceptance criteria

- [ ] Migration adds `custom_do_rules` + `custom_dont_rules` to brands
- [ ] `/brands/[id]/edit?tab=voice` page renders with all sections
- [ ] do_use / do_not_use are editable (add/remove items)
- [ ] Signature phrases are editable
- [ ] Custom rules textarea saves to DB and injects into generation
- [ ] "Refresh manually" re-runs extraction and merges (not overwrites)
- [ ] AI Update History shows last 20 token events in readable form
- [ ] All edits log to `brand_token_events` with signal_type "manual"
- [ ] Plan gating enforced server-side on PATCH routes
