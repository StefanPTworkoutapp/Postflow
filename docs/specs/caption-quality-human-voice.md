# Spec: Caption Quality — Human Voice & Anti-AI Writing

**Status:** Foundation exists, 4 critical gaps in generation pipeline
**Phase:** Pre-H5 (fix now — quick win, high impact)
**Priority:** Critical — every caption generated is affected

---

## Problem

The onboarding collects rich brand voice data (example posts, tone extraction, do/don't lists,
signature phrases). But `generateCaption.ts` discards half of it. Results sound generic and
AI-written. Users notice.

---

## Current state in `generateCaption.ts`

### What IS injected ✅
- `do_not_use[]` — words/phrases to avoid
- `do_not_mention[]` — topic blocklist
- `personality_traits`, `tone_level`, `expertise_level`
- `writing_style` (sentence length, vocab, perspective, formatting)
- `signature_phrases` (weakly: "use naturally")
- Emoji policy + favorites
- Performance patterns (best days, top hashtags)
- Trends (this week's niche topics)

### What is NOT injected ❌
1. `do_use[]` — affirmative style patterns (e.g. "use rhetorical questions", "numbered lists")
2. Anti-AI instruction — no explicit guard against AI-tells
3. Raw example posts as few-shot samples — discarded after tone extraction
4. `signature_phrases` injection is too weak — no frequency or context guidance

---

## Fixes to implement

### Fix 1: Inject `do_use[]`

**File:** `src/lib/server/posts/generateCaption.ts`

Add to the tone profile block:

```
WRITING PATTERNS TO ACTIVELY USE:
${toneProfile.do_use.map(p => `- ${p}`).join('\n')}
```

Position: directly after the `do_not_use` block, before signature phrases.

### Fix 2: Anti-AI system instruction

Add a dedicated paragraph to the system prompt in `generateCaption.ts`:

```
WRITE AS A HUMAN, NOT AN AI:
This brand is a real person/business. Write as they would actually talk.
Avoid AI-writing tells:
- Never open with "In today's [adjective] world..."
- Never use "game-changer", "dive in", "elevate your", "unlock your potential"
- Never use em-dashes excessively (max 1 per caption)
- Never use hollow filler transitions ("Moreover", "Furthermore", "It's worth noting")
- Don't summarise what you're about to say — just say it
- Don't end with hollow questions ("What do you think? Drop a comment below!")
  unless the brand's do_use list includes this pattern
- Match the actual vocabulary level and informality of the example posts
```

### Fix 3: 1–2 few-shot example posts

Pull 1-2 posts from `brands.tone_examples[]` and include them as few-shot:

```
REFERENCE: Here are 2 real posts from this brand. Match this voice exactly:

[Post 1]: "${toneExamples[0]}"

[Post 2]: "${toneExamples[1] ?? ''}"

Do not copy these posts. Use them only to calibrate the voice.
```

**Selection:** Pick examples with the highest word count (most signal). Truncate at 400 chars each.

**Only include when:** `tone_examples.length > 0`. Skip silently if empty.

### Fix 4: Strengthen signature phrase injection

Replace current weak injection:
```
// BEFORE (current)
Signature phrases: ${phrases.join(', ')} — use naturally.

// AFTER
SIGNATURE PHRASES (brand's recurring language):
Use EXACTLY ONE of these per caption, woven in naturally — do not force all of them:
${toneProfile.signature_phrases.map(p => `- "${p}"`).join('\n')}
```

---

## Bug fix: `toneLearningLoop.ts` — tone_examples misuse

**File:** `src/inngest/jobs/toneLearningLoop.ts` line ~170

```typescript
// CURRENT (wrong — tone_examples are raw posts, not tone notes)
const currentTone = brand.tone_examples?.join("; ") ?? null

// FIX — use tone_profile summary instead
const currentTone = brand.tone_profile
  ? `Tone: ${brand.tone_profile.tone_level}/10 formality, traits: ${brand.tone_profile.personality_traits?.join(', ')}`
  : null
```

---

## Brand Voice Overview page (separate spec, referenced here)

The full brand voice UI lives in `docs/specs/brand-voice-overview.md`.
That spec covers:
- Where users can SEE the extracted do_use / do_not_use / examples
- Where they can EDIT/OVERRIDE the AI's extraction
- How the tone loop feeds back into this view

---

## Test protocol

After implementing fixes, run a caption generation for a test brand and verify:
1. Caption does not contain any of the anti-AI phrases listed above
2. At least one `do_use` pattern is present in the output
3. One signature phrase appears (if brand has them)
4. Voice matches the tone_examples (manual review)
5. No regression on brands with empty tone_examples

---

## Acceptance criteria

- [ ] `do_use[]` patterns injected into caption prompt
- [ ] Anti-AI instruction block added to system prompt in `generateCaption.ts`
- [ ] 1–2 tone_examples injected as few-shot samples (when available)
- [ ] Signature phrase instruction says "exactly one, woven in" not "use naturally"
- [ ] `toneLearningLoop` uses `tone_profile` summary instead of raw `tone_examples` for its feedback prompt
- [ ] No new TypeScript errors
- [ ] Caption quality manual review passes
