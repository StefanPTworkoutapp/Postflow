# PostFlow — Analytics Data-Flow Pattern

Last updated: 2026-06-14

This document defines the **canonical analytics roundtrip** used in PostFlow.
Every feature that collects platform signals and feeds them into AI generation
follows this exact pattern. Read this before building any analytics, feedback,
or AI-improvement feature.

---

## The one-line summary

> Platform signals flow through a normalised DB layer, get distilled into
> confidence-weighted brand tokens, and those tokens get injected into every
> Claude call — so the AI improves continuously without any user action.

---

## Full data-flow diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. SIGNAL SOURCES                                                       │
│                                                                         │
│   Buffer webhook         Instagram Graph API     LinkedIn API           │
│   /api/webhooks/buffer   (cron-fetched)          (cron-fetched)         │
│         │                       │                       │               │
│         └───────────────────────┴───────────────────────┘               │
│                                 │                                       │
│                                 ▼                                       │
│ 2. RAW STORAGE                                                          │
│                                                                         │
│   postflow.post_analytics                                               │
│   ┌─────────────────────────────────────────────────────┐              │
│   │ post_id · platform · impressions · reach · likes    │              │
│   │ comments · shares · saves · clicks · engagement_rate│              │
│   │ completion_rate · carousel_swipe_rate · fetched_at  │              │
│   └─────────────────────────────────────────────────────┘              │
│                                                                         │
│ 3. BASELINE STORAGE                                                     │
│                                                                         │
│   postflow.performance_patterns  (rolling 90-day brand avg per platform)│
│   ┌─────────────────────────────────────────────────────┐              │
│   │ brand_id · platform · avg_engagement_rate           │              │
│   │ avg_reach · avg_impressions · sample_count          │              │
│   └─────────────────────────────────────────────────────┘              │
│                                                                         │
│ 4. SIGNAL PROCESSING  (src/lib/server/analytics/process-analytics.ts)  │
│                                                                         │
│   processPostAnalytics(postId, platform, metrics)                       │
│     ├─ compare vs brand baseline (performance_patterns)                 │
│     ├─ compute engagement delta (above/at/below baseline)               │
│     ├─ detect format via detectFormat() (carousel, reel, story, text)   │
│     ├─ call nudgeToken() for each relevant token key                    │
│     └─ write verification row to postflow.analytics_processed           │
│                                                                         │
│   Signal weights (confidenceDelta):                                     │
│     analytics    = 0.03–0.05   (weak / continuous)                     │
│     feedback     = 0.08        (medium / explicit)                     │
│     calibration  = 0.20        (strong / one-time)                     │
│     inspiration  = 0.12        (medium-strong / curated)               │
│                                                                         │
│ 5. TOKEN UPDATE  (src/lib/server/brand/nudge-token.ts)                 │
│                                                                         │
│   nudgeToken(brandId, tokenKey, newValue, confidenceDelta, signalType)  │
│     ├─ reads brands.intelligence_tokens JSONB                           │
│     ├─ applies delta to token confidence (floor: 0.60 if locked)       │
│     ├─ updates brands.intelligence_tokens atomically                    │
│     └─ writes audit row to postflow.brand_token_events                  │
│                                                                         │
│   postflow.brand_token_events (immutable audit trail)                   │
│   ┌──────────────────────────────────────────────────────────┐         │
│   │ brand_id · token_key · old_value · new_value             │         │
│   │ confidence_delta · signal_type · source_post_id          │         │
│   │ created_at                                               │         │
│   └──────────────────────────────────────────────────────────┘         │
│                                                                         │
│ 6. TOKEN INJECTION  (src/lib/server/brand/getBrandContext.ts)           │
│                                                                         │
│   getBrandContext(brandId)                                              │
│     ├─ fetches brands row (incl. intelligence_tokens JSONB)             │
│     ├─ builds BrandContext struct (typed fields)                        │
│     └─ builds promptBlock string (injected verbatim into Claude system  │
│         prompt with cache_control: ephemeral for prompt caching)        │
│                                                                         │
│ 7. AI GENERATION  (every Claude call uses getBrandContext)              │
│                                                                         │
│   generateCaption()   generateCalendar()   clip-forge analysis          │
│   regenerate()        convert-format()     trend builder                │
│         │                    │                    │                     │
│         └────────────────────┴────────────────────┘                    │
│                              │                                          │
│                       Claude API call                                   │
│                     ┌──────────────────┐                               │
│                     │ system prompt:   │                               │
│                     │  brandContext +  │                               │
│                     │  intelligence    │                               │
│                     │  tokens          │                               │
│                     └──────────────────┘                               │
│                              │                                          │
│                      Better caption                                     │
│                      (aligned to actual brand performance)              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The three trigger paths into the pipeline

### Path A — Scheduled cron (primary)

```
Inngest daily-analytics-fetch  (cron: "0 6 * * *")
  │
  ├─ fetchAndStoreMetaAnalytics(brandId)
  │    └─ Instagram Graph API → post_analytics rows
  │
  ├─ fetchAndStoreLinkedInAnalytics(brandId)
  │    └─ LinkedIn API → post_analytics rows
  │
  └─ processPostAnalytics(postId, platform, metrics)
       └─ nudgeToken() for each signal
```

File: `src/inngest/jobs/dailyAnalyticsFetch.ts`

### Path B — Webhook (real-time)

```
Buffer publishes post
  │
  POST /api/webhooks/buffer
  │
  ├─ verify BUFFER_WEBHOOK_SECRET signature
  ├─ update posts.status = "published"
  └─ schedule analytics fetch after 24h delay
       └─ same processPostAnalytics path as cron
```

File: `src/app/api/webhooks/buffer/route.ts`

### Path C — Human feedback (explicit)

```
User taps FeedbackRow pill on a post
  │
  POST /api/posts/[id]/feedback
  │
  ├─ write row to postflow.tone_feedback
  └─ nudgeToken() immediately (delta: 0.08)
       ┌─ if 5+ same feedback_type accumulate →
       └─ Inngest tone-learning-loop (weekly Monday 07:00 UTC)
            └─ Claude generates tone_suggestion for Brand > Voice tab
```

Files: `src/app/api/posts/[id]/feedback/route.ts`
       `src/inngest/jobs/toneLearningLoop.ts`

---

## Key files — where to read, where to write

| Responsibility                       | File                                                             |
|--------------------------------------|------------------------------------------------------------------|
| Fetch Instagram analytics            | `src/lib/server/analytics/fetchMetaAnalytics.ts`                |
| Fetch LinkedIn analytics             | `src/lib/server/analytics/fetchLinkedInAnalytics.ts`            |
| Process post → token signals         | `src/lib/server/analytics/process-analytics.ts`                 |
| Update a brand token (ONLY function) | `src/lib/server/brand/nudge-token.ts`                           |
| Get brand context for Claude         | `src/lib/server/brand/getBrandContext.ts`                       |
| Format detection                     | `src/lib/server/brand/format-registry.ts`                       |
| Daily cron orchestrator              | `src/inngest/jobs/dailyAnalyticsFetch.ts`                       |
| Weekly tone learning                 | `src/inngest/jobs/toneLearningLoop.ts`                          |
| Template health scoring              | `src/inngest/jobs/templateHealthScorer.ts`                      |
| Supabase tables involved             | `postflow.post_analytics`, `postflow.performance_patterns`,      |
|                                      | `postflow.brands` (intelligence_tokens JSONB),                   |
|                                      | `postflow.brand_token_events`, `postflow.analytics_processed`,   |
|                                      | `postflow.tone_feedback`, `postflow.sync_runs`,                  |
|                                      | `postflow.analytics_sync_errors`                                 |

---

## The nudgeToken contract — the single write path

**Rule: `nudgeToken()` is the ONLY function allowed to write
`brands.intelligence_tokens`. Never UPDATE this column directly.**

```typescript
nudgeToken({
  brandId:         string,   // brands.id UUID
  tokenKey:        string,   // key in intelligence_tokens JSONB
  newValue:        string | number | string[],
  confidenceDelta: number,   // positive = reinforce; negative = weaken
  signalType:      "analytics" | "feedback" | "manual" | "reject"
                 | "calibration" | "inspiration",
  sourcePostId?:   string,   // post that triggered the signal (optional)
})
```

What it does every time, without exception:
1. Reads the current token from `brands.intelligence_tokens`
2. Applies `confidenceDelta` (respects calibration floor of 0.60)
3. Writes the new token back atomically
4. Writes an immutable audit row to `brand_token_events`

Never skip the audit row. Never patch tokens inline.

---

## Token confidence model

Confidence represents how certain the system is that the token reflects
the brand's actual style. Ranges from 0.0 (unknown) to 1.0 (certain).

| Event                          | Delta  | Notes                                    |
|--------------------------------|--------|------------------------------------------|
| Analytics: above-baseline post | +0.04  | Weak reinforce — needs many signals      |
| Analytics: at-baseline post    | +0.02  | Minimal reinforce                        |
| Analytics: below baseline      |   0    | No negative signal (too much noise)      |
| Explicit feedback (positive)   | +0.08  | 1 explicit > ~2 analytics events         |
| Explicit feedback (negative)   | −0.08  | Weakens current value                    |
| Tone-loop suggestion approved  | +0.12  | Pattern confirmed after 5+ feedbacks     |
| Calibration (onboarding)       | +0.20  | Strong — treated as ground truth         |
| Inspiration post accepted      | +0.12  | Curated example = strong signal          |

Calibration-locked tokens: confidence floor of 0.60 — analytics alone
cannot erode them; explicit feedback or manual override required.

---

## Template Health Engine (parallel analytics branch)

Template performance is a separate branch of the same pattern:

```
post_analytics (per-post) → aggregate by template_slug, platform, brand
                           → template_health_scores (updated every 6h)
                           → if score drops < 45 and delta > 10 →
                             generate TemplateSuggestion → shown in /insights
```

File: `src/inngest/jobs/templateHealthScorer.ts`
Tables: `postflow.template_health_scores`, `postflow.template_suggestions`

The health score is displayed via `HealthBar` and `TemplateSuggestionCard`
in the `/insights` page.

---

## How to add a new analytics signal

Follow these steps in order. Do not skip.

### 1. Define the signal source

- Where does the data come from? (webhook, API poll, user action)
- Is it per-post (goes into `post_analytics`) or per-brand aggregate?
- If per-post: which `platform` value does it use?

### 2. Store the raw data

- Per-post metrics → insert/upsert into `postflow.post_analytics`
- New metric not in existing columns → add a migration first, regenerate types
- Aggregates → store in a purpose-built table (see `performance_patterns`)

### 3. Call processPostAnalytics (or write an equivalent processor)

- For post-level signals: call `processPostAnalytics(postId, platform, metrics)` after the DB write
- For new signal types: add a processor in `src/lib/server/analytics/` with the same interface pattern

### 4. Map the signal to token keys

Inside the processor:
- Determine which token keys are relevant (tone, format, style, posting_time, etc.)
- Compute `newValue` (what the token should become)
- Call `nudgeToken()` once per relevant token

### 5. Wire the trigger

- Cron: add a step inside `dailyAnalyticsFetch.ts` using the Inngest step pattern
- Webhook: add a handler in the existing webhook route, then schedule `processPostAnalytics`
- User action: add an API route, write the `tone_feedback` row, call `nudgeToken`

### 6. Verify end-to-end

Check `postflow.brand_token_events` — new rows confirm the pipeline ran.
Check `postflow.analytics_processed` — confirm the processor wrote its verification row.
Trigger `getBrandContext(brandId)` and inspect the returned `promptBlock` — confirm the
new signal is reflected in the AI output.

---

## How to add a new generation feature that uses brand context

Every AI generation call must go through `getBrandContext`. No exceptions.

```typescript
// Correct pattern
import { getBrandContext } from "@/lib/server/brand/getBrandContext"

const ctx = await getBrandContext(brandId)

const response = await anthropic.messages.create({
  model: MODELS.fast,
  system: [
    {
      type: "text",
      text: ctx.promptBlock,                          // brand context as stable system block
      cache_control: { type: "ephemeral" },           // prompt caching
    },
    {
      type: "text",
      text: "Your feature-specific instructions here…",
    },
  ],
  messages: [{ role: "user", content: userPrompt }],
})

// Log AI usage after every call
await logAiUsage({ brandId, model: MODELS.fast, usage: response.usage, context: "your-feature" })
```

```typescript
// Never do this
const brand = await supabase.from("brands").select("*").eq("id", id).single()
const systemPrompt = `You are a social media manager for ${brand.data.name}…`
// This bypasses intelligence tokens and loses all analytics learning
```

---

## Observability — how to confirm the pipeline is running

| What to check                   | Where to look                                                   |
|---------------------------------|-----------------------------------------------------------------|
| Analytics fetched               | `postflow.sync_runs` (status, counts, errors)                  |
| Per-brand errors                | `postflow.analytics_sync_errors`                               |
| Token signals applied           | `postflow.brand_token_events` (one row per nudgeToken call)    |
| Processor ran for each post     | `postflow.analytics_processed`                                 |
| Current token state             | `postflow.brands.intelligence_tokens` JSONB                    |
| What Claude received            | `postflow.ai_usage_logs` (model, context, token counts)        |
| Template health                 | `postflow.template_health_scores`                              |
| Template suggestions generated  | `postflow.template_suggestions`                                |

The `/brand?tab=intelligence` page surfaces `brand_token_events` and
`analytics_processed` directly so users can see the learning in action.

The `/admin` page shows `sync_runs` and `analytics_sync_errors` for
operational monitoring.

---

## What this pattern is NOT for

- **Real-time analytics dashboard metrics** — read directly from
  `post_analytics` and `performance_patterns`, not from intelligence tokens
- **Billing / subscription logic** — separate pipeline entirely
- **Render job tracking** — `clip_forge_jobs` / `trend_concepts` have their
  own status tracking outside this pipeline

---

## Checklist when touching this pipeline

Before shipping any change to analytics, token learning, or caption generation:

- [ ] `nudgeToken()` is still the only write path to `intelligence_tokens`
- [ ] Every call to `nudgeToken()` has a `signalType` (never a hardcoded string)
- [ ] New `post_analytics` columns have a migration + types regenerated
- [ ] `getBrandContext()` returns the new signal in `promptBlock` if needed
- [ ] `ai_usage_logs` is written for every Claude call (via `logAiUsage`)
- [ ] `analytics_processed` has a verification row per post processed
- [ ] Inngest job handles per-brand errors individually (never let one brand break all)
- [ ] Tests cover the signal → token → prompt round trip
