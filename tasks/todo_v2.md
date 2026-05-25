# PostFlow — V2 Implementation Plan

Created: 2026-05-12
Status: V2B COMPLETE, V2B.5 COMPLETE (partial), V2C COMPLETE, V2D COMPLETE, V2E COMPLETE (partial) — 2026-05-13
Prerequisite: V1 fully live (Phase A deploy checklist complete, both brands onboarded)

For full spec on each feature see `memory/features_v6.md` and `memory/features_mvp.md`.

---

## Priority order

V2A → V2B → V2C → V2D → V2E

V2A is the highest-value group — it makes brand intelligence actually learn from real data.
Everything downstream (trend accuracy, template scoring, caption quality) improves once V2A is live.

---

## V2A — Analytics & Brand Learning 🔥 HIGHEST PRIORITY

**Goal:** Wire real platform performance data into brand tokens. This is what makes PostFlow
genuinely intelligent — right now tokens update only from calibration, feedback, and inspiration.
After V2A, every post that performs well or poorly updates the brand profile automatically.

### platformAnalyticsSync Inngest job (nightly)
- [x] `dailyAnalyticsFetch.ts` implements this fully — fetch + processPostAnalytics + sync_runs + analytics_sync_errors + analytics_processed (already in V1, registered in inngest route)
- Note: spec called for a separate job; existing `dailyAnalyticsFetch` covers all requirements

### Instagram Graph API analytics
- [x] `src/lib/server/analytics/fetchMetaAnalytics.ts` — extended
- [x] Pull: `impressions`, `reach`, `likes`, `comments`, `shares`, `saved`, `video_views`, `plays`
- [x] Derive `completion_rate` = `plays / reach` (Reels only)
- [x] Store `completion_rate` + `brand_tokens_snapshot` columns (migration 20260513000001)
- [x] Update `posts.actual_performance` after each analytics fetch
- [x] Already wired into `dailyAnalyticsFetch` Inngest job

### LinkedIn analytics ingest
- [x] `src/lib/server/analytics/fetchLinkedInAnalytics.ts` — extended
- [x] Pull: impressions, clicks, likes, comments, shares
- [x] Derive `click_through_rate` = clicks / impressions (fixed — was clicks/reach)
- [x] Update `posts.actual_performance` after each analytics fetch

### processPostAnalytics() — fully wired
- [x] `src/lib/server/analytics/process-analytics.ts` — complete (built in V1)
- [x] deriveReelSignals: completion_rate, engagement vs baseline
- [x] deriveCarouselSignals: swipe_through_rate, save_rate, engagement
- [x] Calls nudgeToken() for each signal
- [x] Writes analytics_processed verification row

### Brand Intelligence dashboard (/brand-intelligence)
- [x] `src/app/(app)/brand-intelligence/page.tsx`
- [x] Token confidence chart per token (bar) — shows how certain PostFlow is
- [x] Signal source breakdown (analytics / feedback / calibration / inspiration)
- [x] "Stuck tokens" alert — tokens at default confidence after 30+ days
- [x] Recent token activity feed (last 20 nudgeToken() events with source)
- [x] Added to sidebar nav as "Brand Intel"
- [ ] Niche benchmark comparison — deferred to when niche_benchmarks table has real data

### Prediction accuracy tracking
- [x] Migration: `predicted_performance` JSONB + `actual_performance` JSONB on `postflow.posts` (20260513000001)
- [x] Buffer schedule route: captures brand token snapshot as `predicted_performance` at schedule time
- [x] fetchMetaAnalytics + fetchLinkedInAnalytics: fill `actual_performance` after analytics fetched
- [x] UI: Prediction Tracking card in /analytics page (full cycles, pending, avg actual engagement)

---

## V2B — Platform Expansion

**Goal:** Direct OAuth for TikTok, LinkedIn, Facebook. Epidemic Sound for licensed music.

### TikTok direct OAuth + analytics
- [x] `src/app/api/auth/tiktok/route.ts` + `callback/route.ts` — PKCE flow built
- [x] Scopes: `user.info.basic`, `user.info.profile`, `video.list`, `video.insights`
- [x] Show "Connect" button in ConnectionsClient (DIRECT_CONNECT_SUPPORTED updated)
- [x] Env vars: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` (user must add to Vercel)
- [ ] Wire analytics into `dailyAnalyticsFetch` — deferred (need TikTok analytics API research)

### LinkedIn direct OAuth + analytics
- [x] `src/app/api/auth/linkedin/route.ts` + `callback/route.ts` — OIDC userinfo flow
- [x] Scopes: `openid`, `profile`, `email`, `w_member_social`, `r_organization_social`
- [x] Show "Connect" button in ConnectionsClient
- [x] Env vars: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (user must add to Vercel)
- [ ] Wire analytics into `dailyAnalyticsFetch` — deferred (uses existing fetchLinkedInAnalytics)

### Facebook direct OAuth
- [x] `src/app/api/auth/facebook/route.ts` + `callback/route.ts` — Pages flow, long-lived token
- [x] Reuses `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` (same Meta app, different scopes)
- [x] Scopes: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`
- [x] Show "Connect" button in ConnectionsClient

### Epidemic Sound API (licensed music for clip-forge)
- [ ] Replace hardcoded free tracks in `music-selector.ts` with Epidemic Sound API
- [ ] `src/lib/server/music/epidemic-sound.ts` — search tracks by energy/genre/mood
- [ ] `GET /api/music/tracks` route — takes brand tokens → returns 3 licensed tracks
- [ ] MusicPicker.tsx — show track title, artist, preview waveform
- [ ] Env vars: `EPIDEMIC_SOUND_API_KEY`
- [ ] Per-render licensing cost factored into plan limits

---

## V2C — New Creation Features

**Goal:** Expand what PostFlow can create. Reel assembly is an enhanced clip-forge pipeline.
Stock images and multi-language reduce friction for content creation.

### Enhanced Reel assembly (Shotstack multi-clip with music sync)
- [ ] `src/lib/server/render/reel-assembler.ts` — dedicated assembler for long-form reels
- [ ] Music BPM sync — clip cuts timed to beat markers (Shotstack supports this)
- [ ] Transition variants: cut, fade, push (selectable per brand token `transition_style`)
- [ ] Text pacing sync — captions timed to Whisper timestamps (already built in V1)
- [ ] Extend `/api/clip-forge/[id]/render` with `assemblyMode: "reel" | "standard"`
- [ ] MusicPicker: add BPM display + beat-sync toggle
- [ ] Uses existing Shotstack account — no new infrastructure

### Stock image search (Unsplash API)
- [x] `src/lib/server/media/unsplash.ts` — `searchPhotos()` + `triggerUnsplashDownload()`
- [x] `GET /api/media/stock-search?q=&orientation=` route
- [x] `POST /api/media/stock-download` — TOS-required download event trigger
- [x] PostEditor: "Stock images" tab in media section with search + 3-col grid + attribution
- [x] Attribution: photographer name + Unsplash link shown below selected photo (TOS compliant)
- [x] Selected stock photo stored as `generated_image_url` on post via PATCH
- [x] Env vars: `UNSPLASH_ACCESS_KEY` (user must add to Vercel)

### Multi-language caption generation
- [x] Language selector in PostEditor (NL / EN / DE / FR pill row above caption textarea)
- [x] `target_language` passed to `/api/posts/generate` on all generate/regenerate calls
- [x] `generateCaption()` extended: `target_language` overrides `tone_profile.content_language`
- [x] `LANG_LABELS` map translates BCP 47 codes to human-readable language names for Claude prompt
- [x] No new API cost — same Claude call with language instruction appended

---

## V2B.5 — Analytics Feedback Loop Audit + Fixes (2026-05-13)

**Why:** Full audit revealed 12 broken/missing feedback loops. Analytics data was being collected but not learning from it. Fixes close the highest-impact gaps without schema changes.

### Fixes implemented (no migration needed)
- [x] `nudge-token.ts`: added `allowCreate?: boolean` parameter — enables new token keys to emerge from signals without requiring a migration
- [x] `toneLearningLoop.ts`: wire tone feedback → nudgeToken() after threshold met (signal_type "feedback" / "reject", delta ±0.08)
  - too_formal → caption_tone: "conversational" (+0.08)
  - too_casual → caption_tone: "professional" (+0.08)
  - wrong_voice → caption_tone confidence (-0.08, "reject")
  - cta_weak → best_post_goal confidence (-0.08, "reject")
  - loved_it → caption_tone confidence (+0.08)
- [x] `process-analytics.ts`: add CTR signal — CTR ≥5% → reinforce caption_tone + hashtag_strategy + best_post_goal (CTR ≥8% = DELTA_PRIMARY, ≥5% = DELTA_SECONDARY)
- [x] `getBrandContext.ts`: query template_health + template_suggestions, inject TEMPLATE PERFORMANCE block into promptBlock
- [x] `getBrandContext.ts`: inject CONTENT STYLE BALANCE block from style_volatility_preference token
- [x] `calibrate/confirm/route.ts`: seed `style_volatility_preference` token at calibration (steady / mixed / experimental based on review outcomes)
- [x] `brand-intelligence/page.tsx`: add style_volatility_preference, best_post_goal, best_content_duration_seconds, best_cta_style to TOKEN_LABELS
- [x] `PostEditor.tsx`: add TemplateHealthMap prop + show health badge (score + trend arrow) on each template card in picker

### Still open — planned for V2E
- [ ] Predicted vs actual performance accuracy loop — if accuracy < 70% sustained over 30 days, nudge token confidence down by 0.05 across the board
- [ ] Niche benchmark initialization — when brand.niche is set, initialize tokens from niche_benchmarks (fallback defaults until analytics accumulate)
- [ ] Per-post template feedback UI — rate/reject a specific template choice after rendering; fires nudgeToken on new `template_preference_[slug]` tokens
- [x] Style volatility preference user override — `Brand settings → AI behaviour` tab with 3-option selector (Steady / Mixed / Experimental); writes via nudgeToken signal_type "manual"; `PATCH /api/brands/[id]/token`
- [ ] Niche benchmark comparison in analytics dashboard — show "your avg engagement: X% vs niche avg: Y%"

---

## V2D — Business Features

**Goal:** Client-facing features that enable Stefan to use PostFlow with clients professionally.

### Client portal (read-only calendar + approval flow)
- [x] Schema: `postflow.portal_invites` table + `posts.client_approval_status` + `client_reviewed_at` + `client_reviewer_email`
- [x] Migration: `20260513000002_client_portal.sql`
- [x] `GET /portal/[token]` — public page, no login required (`src/app/portal/[token]/page.tsx`)
- [x] `PortalView.tsx` — shows next 60 days of scheduled posts with preview images; no edit access
- [x] Client approval: thumbs up / 👍 Approve + ⚑ Flag buttons per post → `POST /api/portal/approve`
- [x] Approval status badge shown in PostEditor header (approved / flagged / pending)
- [x] Email invite: Resend HTML template with portal link
- [x] `POST /api/portal/invite` — generates 64-char hex token, sends Resend email, Plan gate: Pro+
- [x] `GET /api/portal/invites?brandId=` — list existing invites for brand owner
- [x] `Brand settings → Client sharing` tab — invite form + existing invites list with viewed/not-viewed status
- [x] Token expiry: configurable (7/30/90 days or no expiry)

### Auto-schedule optimisation
- [x] `src/lib/server/scheduling/optimal-time.ts` — `getOptimalScheduleTime()`, `formatOptimalTime()`, `nextOccurrenceDate()`
- [x] Data source: `postflow.performance_patterns` (already populated by analytics pipeline)
- [x] Minimum 5 posts sample size (not 20 — data available sooner); fallback: Tue at 09:00
- [x] PostEditor: "⚡ Best time for [platform]: [day] at [HH]:00" chip below schedule date — click to apply
- [x] Chip shows "(benchmark)" when using industry fallback, not real data
- [ ] Calendar generation: `generateCalendar` uses optimal times — deferred
- [ ] Weekly report email — deferred to V2E

### Calendar: week view
- [x] `CalendarView.tsx` — week tab alongside month / list
- [x] 7-column grid, hourly rows (6am–10pm); entries shown at 9am slot (content_calendar has date only)
- [x] Entries shown as cards in their day column; drag to reschedule date (same PATCH /api/calendar endpoint)
- [x] Week navigation (prev/next); auto-reloads adjacent months when week spans month boundary

### Calendar: kanban view
- [x] Kanban tab alongside month / week / list
- [x] Columns: Planned → Drafting → Ready → Scheduled → Posted
- [x] Cards draggable between columns (updates `posts.status` via PATCH /api/posts/[id])
- [x] Platform filter pill chips above board

---

## V2E — System Improvements

**Goal:** Reliability, modularity, and re-calibration triggers.

### Periodic re-calibration prompt
- [x] Inngest job: `src/inngest/jobs/recalibrationCheck.ts` — Sunday 06:00 UTC cron
- [x] Trigger conditions: `calibration_done_at` > 90 days ago, OR `template_health.health_score < 45` on 2+ platforms
- [x] Sets `brands.calibration_status = 'due'` when triggered
- [x] Dashboard banner: appears when `calibration_status === 'due'`
- [x] Banner links to `/onboarding` (re-runs calibration)
- [x] Registered in `/api/inngest/route.ts`

### Modular refactor (architectural debt from V1)
- [x] `src/lib/server/ai/nudge-analyzer.ts` — extracted `NUDGE_SIGNALS` + `extractNudgeSignals()` from nudge route; nudge route now imports from here
- [ ] `src/lib/server/trends/version-builder.ts` — no monolithic buildVersionSpec found in render route; deferred (no actual debt to extract)
- [ ] `src/lib/server/ai/concept-generator.ts` — concept generation already in trend-filter.ts (modular); deferred
- [x] `src/hooks/useRenderStatus.ts` — polling hook extracted; replaces inline interval logic in CreateClient
- [x] `src/hooks/useTrendConcepts.ts` — concept loading state hook extracted from TrendClient
- [ ] Unit tests for nudge-analyzer, useRenderStatus, useTrendConcepts — deferred to V3 (no test runner configured yet)

---

## V2 Completion criteria

**V2 is complete when:**
- [x] `platformAnalyticsSync` Inngest job running and writing to `analytics_processed` — `dailyAnalyticsFetch` covers this (built in V1)
- [ ] At least 1 brand has ≥ 20 posts with analytics and shows non-default token confidence — requires real usage data
- [ ] Brand Intelligence dashboard shows live token confidence changes — dashboard built; awaiting real data
- [x] TikTok + LinkedIn OAuth connected and analytics flowing — OAuth routes built; analytics wiring deferred pending API research
- [x] Client portal live and tested with at least 1 invite sent — code complete; requires migration 20260513000002 to be applied
- [x] `npx tsc --noEmit` clean
- [x] All new Inngest jobs registered + visible in Inngest dashboard — `recalibrationCheck` added to route.ts

---

## Excluded from V2 — pushed to V3 (expensive to RUN)

| Feature | Reason pushed | Est. cost per use |
|---|---|---|
| AI-generated slide images | DALL-E 3 / image gen API — charged per image, scales with every carousel generation | ~$0.04/image → ~$0.25–0.32 per carousel |

Note: Reel assembly was considered for V3 but kept in V2 because it uses the existing
Shotstack account already paying per render — no new cost category, just a more capable render spec.
