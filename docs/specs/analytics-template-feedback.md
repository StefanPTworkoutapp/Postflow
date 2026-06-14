# Spec: Analytics → Content Performance Visibility & Calendar Feedback Loop

**Status:** Partially built (backend exists, UI missing)
**Phase:** H6 (analytics visibility) + H2 (calendar integration)
**Priority:** High — users currently have no visibility into what performs best

---

## Problem

The system already computes template health scores and performance patterns per brand
(90-day rolling, updated weekly). This data drives Claude's generation context — but
users can never SEE it. They have no idea which of their post types work, which templates
perform, or whether the calendar is actually using top-performing formats.

---

## What exists today (do not rebuild)

| System | File | Status |
|--------|------|--------|
| `template_health` table | `health-scorer.ts` + `templatePulse.ts` | ✅ Scored every 6h |
| `performance_patterns` table | `computePerformancePatterns.ts` | ✅ Updated weekly |
| Template suggestions | `health-scorer.ts` | ✅ Auto-creates when score < 55 |
| Health injected into Claude | `getBrandContext.ts` lines 187–209 | ✅ Works |
| Calendar generation uses performance | `getBrandContext.ts` → calendar prompt | ✅ Works |
| Insights page | `/src/app/(app)/insights/page.tsx` | ✅ Exists but incomplete |

---

## What needs to be built

### 1. Template performance breakdown in Insights

**Location:** `/app/(app)/insights/page.tsx` — add a new section below the existing KPIs

**Display:**
```
Template Performance (last 90 days)
┌─────────────────────┬──────────┬────────┬─────────┐
│ Template            │ Posts    │ Avg Eng│ Trend   │
├─────────────────────┼──────────┼────────┼─────────┤
│ edu-bold            │ 12       │ 4.2%   │ ↑ rising│
│ carousel-myth       │ 8        │ 2.1%   │ → stable│
│ dark-statement      │ 3        │ 5.1%   │ ↑ rising│
└─────────────────────┴──────────┴────────┴─────────┘
```

Data source: `template_health` table filtered by `brand_id`.
Show top 5 by score. Show "Best for your brand" badge on highest score.

**Post type filter:**
Add filter chips above the existing KPI cards:
`[All] [Single Image] [Carousel] [Reel] [Story]`
Filters `post_analytics` rows by `post_type` column.

### 2. "Top performing format" dashboard widget

**Location:** `/app/(app)/dashboard/page.tsx` — add a small card in the existing grid

**Display:**
```
🏆 Best format this month
  edu-bold — 4.2% avg engagement
  📈 rising ↑  ·  Used 12 times
  [Use this format →]
```

Data source: query `template_health` for top 1 by score for the active brand.

### 3. Calendar uses performance data (verify + enforce)

**Current state:** `getBrandContext.ts` injects top/declining templates into the prompt.
The calendar generation prompt DOES receive this. Verify it actually biases toward
high-scoring templates in the returned `post_type` / `template_slug` fields.

**What to add:**
- In the calendar generation response schema, add `template_slug` as a required field
- The prompt should explicitly say: "Prefer these high-performing templates:
  {topTemplates} — Generate MORE posts of the types that are rising"
- After calendar generation: log a `template_suggestions` event for each scheduled slot

### 4. Performance-based calendar skew

When generating a monthly calendar, count the distribution:
- If `edu-bold` has score 72 (rising) and `carousel-myth` has score 38 (declining)
- Schedule 40% edu-bold, 20% carousel-myth (minimum floor so brand doesn't become one-note)
- The prompt must make this explicit: "Schedule at least {n} posts using {topTemplate}"

**Implementation:** Compute target counts server-side before generating the calendar,
inject them as hard constraints: "Week 1 must include exactly 2 edu-bold posts."

---

## Data contracts

```typescript
// From template_health table (already exists)
interface TemplateHealthRow {
  brand_id:         string
  platform:         string
  template_slug:    string
  score:            number       // 0–100
  trend:            "rising" | "stable" | "declining"
  engagement_rate:  number
  post_count:       number
  locked_by_user:   boolean
  updated_at:       string
}

// New: per-post-type analytics segment
interface PostTypeSegment {
  post_type:       string        // single_image | carousel | reel | story
  avg_engagement:  number
  post_count:      number
  top_template:    string
}
```

---

## Acceptance criteria

- [ ] Insights page shows template performance table (top 5, sorted by score)
- [ ] Post type filter chips work on insights page
- [ ] Dashboard shows "Top performing format" card
- [ ] Calendar generation explicitly prefers top-scoring templates
- [ ] Calendar distribution reflects performance scores (more of what works)
- [ ] No regression in existing analytics display
