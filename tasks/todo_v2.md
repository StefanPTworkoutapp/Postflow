# PostFlow — V2 Implementation Plan

Created: 2026-05-12
Status: Planning — not yet started
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
- [ ] `src/inngest/jobs/platformAnalyticsSync.ts` — nightly cron (`0 2 * * *`)
- [ ] Per brand: fetch post_analytics rows where `fetched_at` is recent
- [ ] Call `processPostAnalytics(post, brandId)` for each post
- [ ] Log run to `postflow.sync_runs`, errors to `postflow.analytics_sync_errors`
- [ ] Write verification row to `postflow.analytics_processed`
- [ ] Register in `src/app/api/inngest/route.ts`

### Instagram Graph API analytics
- [ ] `src/lib/server/analytics/fetchMetaAnalytics.ts` — extend existing file
- [ ] Pull: `impressions`, `reach`, `likes`, `comments`, `shares`, `saved`, `video_views`, `plays`
- [ ] Derive `completion_rate` = `plays / reach` (Reels only — requires video_views + reach)
- [ ] Store in `postflow.post_analytics` with `completion_rate` column
- [ ] Store `brand_tokens_snapshot` at fetch time (for accuracy tracking later)
- [ ] Wire into `dailyAnalyticsFetch` Inngest job

### LinkedIn analytics ingest
- [ ] `src/lib/server/analytics/fetchLinkedInAnalytics.ts` — extend existing file
- [ ] Pull: impressions, clicks, likes, comments, shares
- [ ] Derive `click_through_rate` = clicks / impressions
- [ ] Store in `postflow.post_analytics`

### processPostAnalytics() — fully wired
- [ ] `src/lib/server/analytics/process-analytics.ts` — complete implementation
- [ ] `deriveTokenSignals(post, benchmark)` — compares post performance to niche benchmark
- [ ] Calls `nudgeToken()` for each derived signal
- [ ] benchmark pulled from `postflow.niche_benchmarks` (or Claude estimate if no benchmark yet)
- [ ] Signals: completion_rate → pacing, save_rate → hook_style, engagement → caption_tone
- [ ] Signals only apply when ≥ 5 posts in niche (no premature learning)

### Brand Intelligence dashboard (/brand-intelligence)
- [ ] `src/app/(app)/brand-intelligence/page.tsx`
- [ ] Token confidence chart per token (bar/radial) — shows how certain PostFlow is
- [ ] Signal source breakdown (analytics / feedback / calibration / inspiration)
- [ ] "Stuck tokens" alert — tokens at default confidence after 30+ days
- [ ] Recent token activity feed (last 20 nudgeToken() events with source)
- [ ] Niche benchmark comparison: your brand vs niche average per metric

### Prediction accuracy tracking
- [ ] Schema: add `predicted_performance` JSONB to `postflow.posts` (brand token snapshot at schedule time)
- [ ] Schema: add `actual_performance` JSONB to `postflow.posts` (filled after analytics fetched)
- [ ] Accuracy score = how well token predictions matched actual analytics
- [ ] UI: accuracy trend chart in analytics page (predicted vs actual, last 30 days)

---

## V2B — Platform Expansion

**Goal:** Direct OAuth for TikTok, LinkedIn, Facebook. Epidemic Sound for licensed music.

### TikTok direct OAuth + analytics
- [ ] `src/app/api/auth/tiktok/route.ts` + `callback/route.ts`
- [ ] Follows same pattern as Instagram callback (graph API → token → upsert social_accounts)
- [ ] Scopes: `user.info.basic`, `video.list`, `video.insights`
- [ ] Wire analytics into `dailyAnalyticsFetch`
- [ ] Show "Connect" button in ConnectionsClient (remove "Coming soon")
- [ ] Env vars: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

### LinkedIn direct OAuth + analytics
- [ ] `src/app/api/auth/linkedin/route.ts` + `callback/route.ts`
- [ ] Scopes: `r_liteprofile`, `r_organization_social`, `rw_organization_admin`
- [ ] Wire analytics into `dailyAnalyticsFetch`
- [ ] Show "Connect" button in ConnectionsClient (remove "Coming soon")
- [ ] Env vars: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`

### Facebook direct OAuth
- [ ] `src/app/api/auth/facebook/route.ts` + `callback/route.ts`
- [ ] Reuses Facebook Login for Business (same app as Instagram, different scope)
- [ ] Scopes: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
- [ ] Show "Connect" button in ConnectionsClient (remove "Coming soon")

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
- [ ] `src/lib/server/media/unsplash.ts` — search + download via Unsplash API
- [ ] `GET /api/media/stock-search?q=&orientation=` route
- [ ] MediaPicker: add "Stock images" tab with search input
- [ ] PostEditor: stock images selectable alongside uploaded media
- [ ] Attribution: Unsplash requires photographer credit in image metadata
- [ ] Env vars: `UNSPLASH_ACCESS_KEY`

### Multi-language caption generation
- [ ] Language selector in PostEditor (NL / EN / DE / FR — expandable)
- [ ] `getBrandContext()` already injects `content_language` — extend with `target_language` override
- [ ] Auto-detect existing captions language for default
- [ ] Hashtag suggestions localised per language
- [ ] No new API cost — same Claude call with language instruction appended

---

## V2D — Business Features

**Goal:** Client-facing features that enable Stefan to use PostFlow with clients professionally.

### Client portal (read-only calendar + approval flow)
- [ ] Schema: `postflow.portal_invites` table — `(id, brand_id, email, token, role, created_at)`
- [ ] Migration: `20260600000001_portal_invites.sql`
- [ ] `GET /portal/[token]` — public page, no login required, read-only calendar
- [ ] Calendar shows scheduled posts with preview images; no edit access
- [ ] Client approval: thumbs up / thumbs down per post → fires `postflow/post.client_reviewed` event
- [ ] Approval status shown in PostEditor (approved / flagged / pending)
- [ ] Email invite: Resend template with portal link
- [ ] `POST /api/portal/invite` — generates token, sends email
- [ ] Plan gate: Pro+ only

### Auto-schedule optimisation
- [ ] `src/lib/server/scheduling/optimal-time.ts` — derives best posting time per platform
- [ ] Data source: `postflow.post_analytics` — group by `posted_at` hour × platform × metric
- [ ] Requires ≥ 20 posts with analytics before showing recommendations (fallback: niche benchmark)
- [ ] PostEditor: "Best time" chip next to schedule date picker
- [ ] Calendar generation: `generateCalendar` uses optimal times when available
- [ ] Weekly report email: include "your best posting window this week"

### Calendar: week view
- [ ] `CalendarView.tsx` — add week tab alongside existing month tab
- [ ] 7-column grid, hourly rows (6am–10pm)
- [ ] Posts shown as cards in their time slot
- [ ] Drag to reschedule within week (same PATCH /api/calendar endpoint)

### Calendar: kanban view
- [ ] Add kanban tab alongside month + week
- [ ] Columns: Planned → Drafting → Ready → Scheduled → Posted
- [ ] Cards draggable between columns (updates `posts.status`)
- [ ] Filter by platform (pill chips above board)

---

## V2E — System Improvements

**Goal:** Reliability, modularity, and re-calibration triggers.

### Periodic re-calibration prompt
- [ ] Inngest job: `src/inngest/jobs/recalibrationCheck.ts` — weekly cron
- [ ] Trigger conditions: `calibration_done_at` > 90 days ago, OR health_score < 45 on 2+ platforms
- [ ] Sets `brands.calibration_status = 'due'` when triggered
- [ ] Dashboard banner: appears when `calibration_status === 'due'`
- [ ] Banner links to `/onboarding` Step 10 (re-runs calibration only, not full wizard)
- [ ] After re-calibration: resets `calibration_done_at`, status = 'complete'

### Modular refactor (architectural debt from V1)
- [ ] `src/lib/server/ai/nudge-analyzer.ts` — extract `extractNudgeSignals()` from nudge route
- [ ] `src/lib/server/trends/version-builder.ts` — extract `buildVersionSpec()` from trend render route
- [ ] `src/lib/server/ai/concept-generator.ts` — extract concept generation from trend-filter.ts
- [ ] `src/hooks/useRenderStatus.ts` — Supabase Realtime per job (replace polling in CreateClient)
- [ ] `src/hooks/useTrendConcepts.ts` — concept loading state (extract from TrendClient)
- [ ] Add unit tests for nudge-analyzer, version-builder, concept-generator

---

## V2 Completion criteria

**V2 is complete when:**
- [ ] `platformAnalyticsSync` Inngest job running and writing to `analytics_processed`
- [ ] At least 1 brand has ≥ 20 posts with analytics and shows non-default token confidence
- [ ] Brand Intelligence dashboard shows live token confidence changes
- [ ] TikTok + LinkedIn OAuth connected and analytics flowing
- [ ] Client portal live and tested with at least 1 invite sent
- [ ] `npx tsc --noEmit` clean
- [ ] All new Inngest jobs registered + visible in Inngest dashboard

---

## Excluded from V2 — pushed to V3 (expensive to RUN)

| Feature | Reason pushed | Est. cost per use |
|---|---|---|
| AI-generated slide images | DALL-E 3 / image gen API — charged per image, scales with every carousel generation | ~$0.04/image → ~$0.25–0.32 per carousel |

Note: Reel assembly was considered for V3 but kept in V2 because it uses the existing
Shotstack account already paying per render — no new cost category, just a more capable render spec.
