# PostFlow — Decisions Log

Record significant architectural and product decisions here. Include the date,
the decision, the alternatives considered, and the reason. This file is the
source of truth for "why did we do it this way?"

---

## Format

```
## [YYYY-MM-DD] Short title

**Decision:** What was decided.
**Alternatives:** What else was considered.
**Reason:** Why this option was chosen.
**Impact:** What this affects or constrains going forward.
```

---

## [2026-05-04] Shared Supabase project with postflow schema

**Decision:** PostFlow uses the same Supabase project as the existing app,
isolated under a separate schema named `postflow`.

**Alternatives:** Spin up a new dedicated Supabase project ($25/mo extra).

**Reason:** Saves €25/month at MVP stage. Migration to a dedicated project is
planned at 5+ paying customers or 80% storage usage.

**Impact:** ALL queries must use `postflow` schema. Never use `public`. Supabase
client must be initialized with `db: { schema: 'postflow' }`. This is a hard
safety rule enforced in CLAUDE.md.

---

## [2026-05-04] Next.js 16 + React 19 (upgraded from 14)

**Decision:** Use Next.js 16 and React 19 (as bootstrapped by create-next-app).

**Alternatives:** Stay on Next.js 14 as originally specified in design doc.

**Reason:** The scaffold was generated with the latest stable versions. No
reason to downgrade; Next.js 16 + React 19 are production-stable.

**Impact:** Design doc references Next.js 14 — treat all references as 16.
App Router is still the pattern; no behavior changes for MVP scope.

---

## [2026-05-04] Direct upload pattern for media files

**Decision:** Media uploads go browser → Supabase/R2 directly via presigned URLs.
The API is notified after upload completes.

**Alternatives:** Route files through the Next.js API (Vercel).

**Reason:** Vercel has a 5MB body limit on API routes. Media files can be
hundreds of MBs. Direct upload bypasses Vercel entirely, is faster, and cheaper.

**Impact:** Upload UI must request a presigned URL first, then POST directly to
storage, then call our API to record metadata and trigger Inngest job.

---

## [2026-05-04] Hybrid storage: Supabase + Cloudflare R2

**Decision:** Photos and videos < 50MB go to Supabase Storage. Videos > 200MB
go to Cloudflare R2 after FFmpeg compression. Target is to compress all videos
to < 50MB so Supabase handles the majority.

**Alternatives:** All media to R2; all media to Supabase.

**Reason:** Supabase storage is already included in the $25/mo plan. R2 is
$0.015/GB/month with no egress fees — cheapest option for large files.
Compression-first strategy keeps most files in Supabase (free).

**Impact:** `media_uploads.storage_provider` must be checked before constructing
public URLs. Upload pipeline must branch based on compressed file size.

---

## [2026-05-05] Buffer: Personal Access Token instead of OAuth

**Decision:** Buffer integration uses a user-provided Personal Access Token
(pasted into Settings), not OAuth app flow.

**Alternatives:** Buffer OAuth (developer app registration).

**Reason:** Buffer stopped creating new developer apps. Their public GraphQL API
works with Personal Access Tokens on all plans including Free. Simpler UX — user
pastes one token, channels sync automatically on every Settings page load.

**Impact:** No OAuth redirect flow. Token stored in `postflow.social_accounts`.
Channel list syncs automatically on each Settings page load (diff-based: add new,
remove deleted, update changed). Buffer GraphQL requires organizationId from
`account { organizations { id } }` before any channel or post query.

---

## [2026-05-05] Calendar → Post creation flow

**Decision:** `content_calendar` entries are ideas/plans; `posts` are the actual
content. Clicking a calendar entry creates a linked `posts` record and navigates
to the PostEditor. Calendar entries are never directly editable as posts.

**Alternatives:** Calendar entries ARE posts (combined table); edit inline.

**Reason:** Clean separation of planning (calendar) from content (posts). The
`calendar_entry_id NOT NULL` FK on posts enforces this link. Every post must
have a calendar entry — even "New post" auto-creates one.

**Impact:** Two-step click flow: calendar chip → create-post API →
PostEditor. Once a post exists for an entry, the chip navigates directly. The
list view shows both "Create post" and "Open post" states.

---

## [2026-05-05] AI calendar generation: per-platform frequency overrides

**Decision:** The AI calendar generate modal shows per-platform stepper controls
(1–7×/week) with smart defaults (Instagram 4, LinkedIn 2, TikTok 5 etc.).
The user adjusts before generating. AI follows the chosen frequencies exactly.

**Alternatives:** Single global frequency slider; AI decides frequencies alone.

**Reason:** Best-practice defaults cover most cases. Some brands want different
cadences (e.g. starting at 3×/week on Instagram). User control matters but
defaults should be smart enough to not require adjustment.

**Impact:** `frequencyOverrides: Record<string, number>` sent with generate
request. Claude prompt says "POSTING FREQUENCY (chosen by user — follow exactly)".

---

## [2026-05-06] Media type system for calendar entries

**Decision:** Every AI-generated calendar entry gets a `required_media_type`
from a fixed set, and a short `media_brief` describing exactly what to create.

**Media types:**
- `photo` — personal photo the brand owner shoots themselves (most common).
  Used for: behind-the-scenes, portraits, before/after, clinic shots.
- `video` — personal video/reel the brand owner films themselves.
  Used for: exercise demos, talking to camera, Q&A, day-in-the-life.
- `carousel` — multiple slides uploaded by the owner; the app assembles them
  into a branded carousel using the brand template. Slide count stored in
  `required_media_count`.
- `stock` — visual content that must be sourced online (anatomy diagrams,
  medical illustrations, scientific charts). Used sparingly — only when
  a personal photo is genuinely impossible.
- `none` — text-only post. No visual needed. Used for LinkedIn/X/Threads.

**Alternatives:** "Canva" type (rejected — we build carousels in-app);
"design" type (rejected — too vague, confused users).

**Reason:** Gives the brand owner a clear, actionable brief per post. Carousel
posts are assembled by PostFlow using the brand template (not external tools).
Personal content defaults are prioritised — most Instagram/TikTok posts should
be photo or video.

**Impact:** `required_media_type`, `required_media_count`, and `media_brief`
saved on `content_calendar`. List view shows type badge + brief + upload slot
(photo/video/carousel get Upload button; stock gets Upload once sourced; none
gets no upload). Carousel upload shows `X/N uploaded` progress.

---

## [2026-05-06] Carousel assembly: in-app via brand template (not Canva)

**Decision:** Carousel posts are assembled entirely within PostFlow using the
brand's template. The user uploads the raw slide content (photos, clips);
the app renders each slide through the Puppeteer template pipeline and
packages them as an ordered carousel for Buffer.

**Alternatives:** Link to Canva (external); give user a design brief and let
them build it themselves.

**Reason:** Core value proposition — everything is done in PostFlow. Canva
defeats the purpose. Users upload content, the app handles design.

**Impact:** Template editor (Week 3/4) must support carousel templates with
variable slide count. Each slide is rendered individually by Puppeteer, then
assembled. `required_media_count` tells the system how many upload slots to show.
This is not yet built — currently the upload slots exist but assembly is pending
the template system.

---

## [2026-05-06] Reel assembly from clips: deferred to V2

**Decision:** Automatic reel assembly from multiple uploaded clips (stitching
clips + music + captions into a finished reel) is a V2 feature, not MVP.

**Alternatives:** Include in MVP using Shotstack or Creatomate API.

**Reason:** Technically feasible (Shotstack/Creatomate APIs: ~€0.10–0.30/render,
can stitch 2–3 clips + music + captions automatically). However, it requires the
template system to be complete first, adds cost per render, and increases
complexity. MVP focus is on photo + carousel posts.

**Impact:** V2 roadmap item. Once templates are done, add a "Create reel" flow:
user uploads 2–3 clips → selects template → Shotstack/Creatomate renders →
returned video is scheduled via Buffer. Budget: ~€0.20/reel render.

---

## [2026-05-07] Thumbnail generation: in-app Puppeteer, not Canva API

**Decision:** Smart thumbnail/intro card generation is built entirely in PostFlow
using Puppeteer + brand templates. Three variants generated per post, each with a
success probability score. No Canva API dependency.

**Alternatives:** Canva API (external dependency, usage cost, breaks brand template
consistency); fixed single template per brand.

**Reason:** Consistent with our carousel assembly decision. Everything stays in-app.
Success probability is derived from own post history (which thumbnail styles drove
most engagement for this brand on this platform). New brands start with industry
benchmarks until 10+ posts exist.

**Impact:** Template editor (Week 4) must support thumbnail variants. Puppeteer
renders each variant. Analytics pipeline (Week 5) must tag posts with thumbnail
style used so performance can be attributed back to the template.

---

## [2026-05-07] Competitor post tracking: not feasible, replaced by Niche Trend Intelligence

**Decision:** We do not track competitor posts. Instagram/TikTok APIs do not permit
fetching other accounts' posts or engagement data. Instead we build a "Niche Trend
Intelligence" layer using publicly accessible sources.

**Sources:**
- Google Trends API (free) — trending search topics by niche/category
- TikTok trending topics + hashtags (limited public endpoint)
- TikTok trending sounds (partial data accessible without auth)
- Reddit API — trending posts in relevant subreddits (r/physicaltherapy, r/fitness etc.)
- News API — health/fitness trending headlines for topic seeds

**What we deliver instead:**
- Weekly top 3 trending topics in the brand's niche
- Trending sounds for the platform + creator type (where available)
- Weekly email digest generated by Claude from pulled trend data

**Alternatives:** Third-party scrapers (Apify, Phantombuster — ToS grey area, extra
cost, fragile); manual competitor logging by user (too much friction).

**Reason:** Technically honest. Instagram ToS violation risk is real and not worth it.
Own post performance + public trend signals is a strong enough signal for content
recommendations.

**Impact:** `niche_trends` table stores weekly trend pulls. No `competitor_posts`
table. Trend data feeds Claude caption generation context and the weekly email.

---

## [2026-05-07] Success probability methodology

**Decision:** "Success probability" shown per recommended content type/hook is
calculated from the brand's own post history. New brands get industry benchmark
data until they have 10+ posts with analytics.

**Tiers:**
- 0–9 posts with analytics → show industry benchmarks (seeded, labelled "industry avg")
- 10–29 posts → mix of own data + benchmarks (weighted)
- 30+ posts → own data only, shown as "based on your X posts"

**Formula:** For a given combination of (platform + content_pillar + post_type):
  avg_engagement_rate of historical posts matching that combination.
  If fewer than 3 matching posts exist, blend with broader category average.

**Metric used:** engagement rate as primary; reach for brand_awareness goal;
  link clicks for conversion goal. Goal is set per brand in `brands.primary_goal`.

**Impact:** `performance_patterns` table stores rolling 90-day derived patterns per
brand + platform. Recalculated weekly by Inngest job. Claude caption prompt injected
with the top-performing patterns for the brand when generating.

---

## [2026-05-07] Weekly trend email aligned with analytics layer

**Decision:** The weekly email digest (trend report) is an extension of the
Niche Trend Intelligence system, not a separate feature. Same Inngest job that
pulls trend data also triggers the email.

**Flow:** Every Monday 06:00 UTC:
1. Inngest job pulls Google Trends + TikTok + Reddit for brand's niche
2. Fetches brand's own top post from last 7 days (from post_analytics)
3. Claude generates a short narrative: "Here's what's trending + what worked for you"
4. Email sent via Resend (transactional email provider)

**Content of email:**
- Your top performing post this week (metric depends on primary_goal)
- 3 trending topics in your niche (with suggested hook angles)
- Trending sounds this week (TikTok, where available)
- 3 recommended posts for next week (seeded into calendar if user clicks "Add")

**Impact:** Requires `niche_trends` table + Resend integration. Email is opt-in
(default on). User can disable in Settings > Notifications.

---

## [2026-05-09] AI pre-fills carousel slide content at generation time

**Decision:** Carousel slide content (headline + body per slide) is generated by Claude at calendar entry creation time, not by the user. Stored as `slide_content JSONB` on `content_calendar` (and copied to `posts` when post is created). User's only input is adding photos/videos to slides.
**Alternatives considered:** Manual fill-in (rejected — too much friction), post-creation AI fill (rejected — delays the flow).
**Impact:** Calendar generate route must produce structured slide_content for carousel entries. CarouselBuilder loads from saved slide_content, not blank.

---

## [2026-05-09] Calendar list is the media staging area for carousels

**Decision:** For carousel posts, the calendar list shows each slide slot with its photo/video requirement. User uploads media per slot from the list view. By the time they open the post, slides + media are both ready.
**Impact:** Calendar list view needs per-slide upload UI for carousel entries. slide_content must be readable from content_calendar.

---

## [2026-05-09] Template trend adaptation slider on Brand settings

**Decision:** Brand settings will include a slider with 3 positions: "Brand only" (all posts use brand templates) / "Brand + trends" (mostly brand templates, occasionally trend-aware variants) / "Follow trends" (templates adapt to current trends weekly via Inngest job).
**Implementation:** Week 5/6 feature. Trend analysis already planned. Slider value stored as `template_style` ENUM on brands table.
**Alternatives:** Not offering this (rejected — brands want to stay relevant without manual work).

---

## [2026-05-09] Core UX principle: Quality output, minimal client input

**Decision:** Every feature must follow the pattern: AI fills all content fields automatically → client reviews + optionally edits → client adds media → client hits render/publish. The PostEditor "post + preview + feedback + regenerate" pattern is the gold standard. All new features extend this pattern, never break it.
**Impact:** Carousel builder shows AI-filled slides. Template picker has a default (recommended per post type). Regenerate buttons available on every content section.

---

## [2026-05-09] UI/UX pattern library is the single source of truth for visual consistency

**Decision:** All UI patterns (layout, spacing, colours, loading states, error handling, status bars, expandable pickers, preview panels, type badges, etc.) are documented in `memory/ui_ux_patterns.md`. This file is the definitive standard — not tribal knowledge, not "do what PostEditor does", but an explicit written spec.

**Alternatives:** Rely on developers referencing existing components (rejected — leads to drift); use a Storybook (rejected — too much overhead for a solo build).

**Reason:** PostFlow's quality bar is "actually impressive". That requires consistency across every screen. The PostEditor and CarouselBuilder set the standard. Every future feature must match it exactly — same spacing, same loading patterns, same error handling, same dark mode behaviour.

**Impact:**
- Before building any new UI component or page: read `memory/ui_ux_patterns.md`
- Before marking any UI work done: run the checklist at the bottom of that file
- When a new pattern is invented (not in the doc): add it to the doc in the same session, before moving on
- The file is linked from MEMORY.md index so it's always found at session start

---

## [2026-05-13] Analytics feedback loop architecture — signal hierarchy and wiring rules

**Decision:** Every signal pipeline in PostFlow must be explicitly wired end-to-end: collect → nudgeToken() → getBrandContext() → Claude prompt → visible output. Partial wiring (collect-and-store without learning) is a bug, not a feature.

**Signal weight hierarchy (confidenceDelta values):**
| Signal type | Delta | Rationale |
|---|---|---|
| calibration | +0.20 | One-time, user explicitly chose |
| feedback (positive) | +0.08–0.15 | Explicit approval of AI output |
| reject (feedback) | -0.08 | Explicit user rejection |
| inspiration | +0.05–0.08 | Semi-explicit example selection |
| analytics (primary metric) | +0.04 | Strong implicit signal |
| analytics (secondary metric) | +0.03 | Weak implicit signal |

**Closed loops as of 2026-05-13:**
- ✅ Analytics → processPostAnalytics → nudgeToken (hook_style, pacing, music_energy, caption_tone, hashtag_strategy, carousel tokens)
- ✅ Analytics CTR → nudgeToken (caption_tone, hashtag_strategy, best_post_goal) — new
- ✅ Tone feedback (5+ of same type) → nudgeToken (caption_tone, best_post_goal) — new
- ✅ Template health + suggestions → getBrandContext promptBlock — new
- ✅ Style volatility preference → getBrandContext promptBlock — new
- ✅ Style volatility seeded at calibration time — new

**Still open loops (planned in V2):**
- ⬜ Predicted vs actual performance → token confidence recalibration
- ⬜ Niche benchmark initialization for new brands
- ⬜ Template feedback (per-post rate/reject a template) → template_health
- ⬜ Template feedback → nudgeToken on template_preference token
- ⬜ Post-level "CTA worked" signal → cta_effectiveness token
- ⬜ Scheduling time adherence → timing_compliance token

**Alternatives considered:** Queue all signals and batch-apply weekly (rejected — delays learning and reduces transparency). Apply all signals immediately regardless of type (rejected — calibration signals would be overridden by noisy analytics too quickly).

**Impact:** Every new signal feature must answer three questions before merge:
1. Does it call nudgeToken()?
2. Does getBrandContext().buildPromptBlock() include the resulting token?
3. Is the effect visible to the user in Brand Intelligence?

---

## [2026-05-13] Brand style volatility preference — steady / mixed / experimental

**Decision:** A `style_volatility_preference` token with values "steady" | "mixed" | "experimental" controls how much PostFlow experiments vs. reinforces brand identity across content.

**Behaviour per setting:**
- **steady** (80% proven, 20% experiments): Calibrated for corporate/professional brands, new accounts, or brands with a strong established identity. Template selection biases toward high health_score templates. Caption generation stays tightly on-brand.
- **mixed** (65% proven, 35% experiments): Default. Most brands benefit from this — enough consistency to build recognition, enough variation to find new high-performers.
- **experimental** (45% proven, 55% experiments): For brands actively testing what works or newer accounts wanting to find their voice faster.

**How it's set:**
1. Auto-derived at calibration: if user rejected most posts → "steady"; if approved trending/pattern-interrupt post → "experimental"; otherwise → "mixed"
2. User can override via Brand Intelligence page or Brand Settings (planned UI)
3. Can be nudged by analytics over time: if experimental posts consistently underperform → system suggests moving toward "mixed"

**How it's used:**
- `getBrandContext().buildPromptBlock()` injects a CONTENT STYLE BALANCE block describing the ratio and philosophy to Claude
- Template picker in PostEditor shows health badges — declining templates visually subdued
- Calendar generation (future): uses the ratio to plan hype/experimental posts at the configured % 

**Alternatives:** Binary "safe/experimental" toggle (rejected — too coarse); pure analytics-driven (rejected — some brands are deliberately conservative and that's a valid choice).

**Impact:** `style_volatility_preference` is now a first-class seeded token. Every new brand gets it at calibration. Shown in Brand Intelligence dashboard under "Style balance". Can be nudged like any other token.

---

## [2026-05-09] V2.0 Smart Upload → Post Intelligence: zero-decision UX

**Decision:** The V2 Smart Upload feature must follow the same zero-friction UX contract as the rest of PostFlow. User drops a file — everything else is automatic. PostEditor opens fully pre-filled. The user never sees aspect ratios, technical analysis outputs, or "choose your post type" decisions.

**What is automatic:**
- Post type (inferred from file shape + Claude Vision)
- Platform (inferred from aspect ratio + content)
- Caption + hashtags + CTA (Claude-generated)
- Template selection (auto-matched to post type)
- Hook text for reels (Claude picks best option, pre-filled)
- Trending sound suggestion (from niche_trends pull)
- Slide order + slide_content for carousels (AI-generated)
- Calendar entry creation or smart-match to existing entry

**What the user optionally can do:** edit caption, swap sound, reorder slides, pick different thumbnail frame, change scheduled date.

**Full spec:** `memory/features_mvp.md` under "V2.0 Feature: Smart Upload → Post Intelligence".

**Impact:** When building this feature, never add a "choose post type" step, never show raw analysis scores in the UI (internal only), never require a user decision before PostEditor opens.

## [2026-05-13] Token updates write through nudgeToken() for manual overrides too

**Decision:** The new `PATCH /api/brands/[id]/token` endpoint calls `nudgeToken()` with `signal_type: "manual"` and `confidence: 0.95` rather than directly patching `intelligence_tokens`. Even user-facing manual overrides go through the same audit trail.

**Alternatives:** Direct PATCH to `brands.intelligence_tokens` JSONB (simpler, no audit row).

**Reason:** Consistency. Every token change — analytics, feedback, calibration, and now manual — is auditable via `brand_token_events`. This also means Brand Intelligence can show "manual override" events in the feed, and a manual choice counts as a very high-confidence signal that won't be eroded by a few bad analytics points.

**Impact:** All client-facing token overrides must call this endpoint. Never write `intelligence_tokens` directly from the UI layer.

---

## [2026-05-13] Client portal uses token-based auth (no account creation)

**Decision:** Client portal invites are token-based hex strings (64 chars). Clients view the read-only calendar and submit approvals via `POST /api/portal/approve` — no account required, no login.

**Alternatives:** Create guest accounts (complex), require auth (friction), email magic link per action (annoying for clients).

**Reason:** Clients are external stakeholders who shouldn't need to create an account to leave feedback. The 64-byte token is unguessable; optional expiry limits exposure. Approval is lightweight (approve/flag), not a full workflow.

**Impact:** Portal links are shareable but secure-by-obscurity. If a link is compromised, the brand owner can rotate it by sending a new invite. Approvals must always validate the token before mutating post data.

---

## [2026-05-13] Admin diagnostics API + Copy for Claude pattern

**Decision:** Added `GET /api/admin/diagnostics` — a structured JSON endpoint that aggregates analytics pipeline health across all brands into a single response. The AdminDashboard shows a "Copy diagnostic report for Claude" button that calls this endpoint, formats the result as a readable text block, and writes it to the clipboard.

**Alternatives:** Just rely on the admin UI (visual only, can't paste into Claude); provide a PDF export; build an email report.

**Reason:** Stefan asked for a way to hand health data directly to Claude for analysis in a conversation. The endpoint is the single source of truth — the admin UI and Claude share the same data source, so the analysis is always consistent with what the dashboard shows. The formatted text block is deliberately concise (not raw JSON) so it fits in a conversation without overwhelming context.

**Impact:** When new analytics signals or tables are added, also update `/api/admin/diagnostics/route.ts` to surface them. The formatter lives in `AdminDashboard.tsx::formatDiagnosticsForClaude()` and should mirror any changes to the endpoint's response shape.

---

## [2026-05-13] Calendar week view shows entries at 9am slot (not true hourly positions)

**Decision:** The week view places all content_calendar entries at the 9am row, not at their actual scheduled_for time from the posts table.

**Alternatives:** Join posts.scheduled_for in the calendar GET API to get exact times.

**Reason:** The calendar GET endpoint currently only returns content_calendar entries with a posts join for `{ id, caption, status, platform }` — it doesn't return `posts.scheduled_for`. Adding this to the GET response is a small refactor but was out of scope for this sprint. The 9am placeholder is honest (it labels itself as such in the helper text) and can be improved later.

---

## [2026-07-14] P2b — dedicated render templates per platform + reel-cover vs tiktok-cover coexistence

**Decision:** Added three dedicated single_image render templates — `x-statement`, `linkedin-insight`, `tiktok-cover` — instead of continuing to render X/LinkedIn/TikTok single-image posts from the generic multi-platform pool (photo-overlay, edu-bold, quote-card, dark-statement, tip-numbered). `selectTemplate()`'s no-saved-slots fallback now checks a `PLATFORM_DEDICATED_SLUG` map first: for `single_image` posts on platform `x`/`linkedin`/`tiktok`, the dedicated slug is returned directly (not folded into the weighted rotation pool) — a platform-native look is the correct default, not just one option in the mix. A brand's saved/locked `brand_template_preferences` slot still always wins; this only changes what a brand with NO saved slots gets by default.

**reel-cover vs tiktok-cover coexistence:** These are deliberately two different templates for two different content types, not a duplicate:
- `reel-cover` (`type: "reel_cover"`, platforms `["instagram","tiktok"]`) — the first frame of an actual **uploaded video** reel. Dark vignette over the photo/video still-frame, "Watch this →" hook label.
- `tiktok-cover` (`type: "single_image"`, platforms `["tiktok"]`) — a from-scratch **graphic** for TikTok's photo-mode/single-image posts. Brand-colour gradient background (no photo dependency), huge hook headline in the upper third, chevron scroll-cue.

Both stay type-distinct on purpose: reel_cover-type templates are selected via `RENDER_SLUGS_BY_POST_TYPE["reel"/"reel_cover"]` (untouched by this change), single_image-type templates via the new dedicated-slug map. No new `TemplateDefinition.type` value was introduced — `tiktok-cover` reuses the existing `"single_image"` type, which also means it gets its 1080×1920 dims "for free" from `renderPost.ts`'s existing `PLATFORM_DIMS.tiktok` entry (no dimension-table changes needed).

**How existing templates get DB-seeded (found while wiring this):** `postflow.templates` rows are seeded via idempotent migration INSERTs (`INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM postflow.templates WHERE slug = '...')`), NOT via a script. The base 8 defaults shipped in `20260507000001_templates_table.sql`; `photo-overlay` was added later in `20260616000002_add_photo_overlay_template.sql` after being found registered in code but missing from the DB since launch. The three new templates follow the exact same idempotent pattern in `20260714000006_add_x_linkedin_tiktok_templates.sql` — written, NOT applied (per hard rule: SQL is written and reviewed, Stefan approves + pushes).

**Alternatives considered:** Fold the dedicated slugs into the existing rotation pool via niche-style weighting (rejected — would only bias toward the platform-native template some of the time, when it should always be the default absent an explicit brand choice). Give tiktok-cover its own new `TemplateDefinition.type` (rejected — an unnecessary new type value when "single_image" + platform-restricted already expresses "this is a single-image template, just for tiktok").

**Impact:** Brands with no saved `single_image` template slots for X/LinkedIn/TikTok now render natively for those platforms instead of a resized IG-style card. `docs/architecture` template registry docs (if any get created later) should list all 11 registered slugs, not just the original 8.

**Impact:** When improving the week view, update `GET /api/calendar` to include `posts.scheduled_for` in the join, then use that time to position each entry in the correct hour slot.

---

## [2026-07-14] P4 — calendar generation + carousel/variant renders moved to Inngest background jobs

**Decision:** Three previously-synchronous, slow-Claude/slow-Puppeteer HTTP routes are now enqueue-only, with the real work moved to Inngest functions:

- `POST /api/calendar/generate` — validates + inserts a `calendar_generation_jobs` row (brand_id, year, month, status, input, result, error) + sends `postflow/calendar.generate.requested`. `src/inngest/jobs/generateCalendarJob.ts` runs the actual Claude call + `content_calendar` insert via the extracted `src/lib/server/calendar/generateCalendarService.ts` (same prompt/logic as before, just callable from both a route and a job — never duplicated). `GenerateCalendarModal.tsx` polls `GET /api/calendar/generate/status?jobId=` every 3s and shows "Generating your calendar…"; on failure the user's platform/pillar/frequency selections are untouched in local state so Generate can be retried with zero re-entry.
- `POST /api/posts/[id]/render-carousel` and `POST /api/posts/[id]/render-variants` — validation (`assertCarouselValid`) stays synchronous in the route (bad input still 400s immediately); the route then inserts a `post_render_jobs` row (brand_id, post_id, job_type: 'carousel'|'variants', input, result, error) + sends the matching Inngest event. `renderCarouselJob.ts` / `renderVariantsJob.ts` call the extracted `carouselRenderService.ts` / `variantsRenderService.ts` (moved Puppeteer render + storage upload + `posts` row update out of the routes). `CarouselBuilder.tsx` and `PostEditor.tsx` now poll `GET /api/render-jobs/[jobId]` every ~2.5s instead of holding the fetch open.
- `POST /api/posts/[id]/render` (single image) is UNCHANGED and stays synchronous — one Puppeteer page is fast enough for a blocking request (the documented fast-path exception).
- `regenerate` (single calendar slot, Haiku) also stays synchronous — same fast-path exception.

**Migrations (written, NOT applied — needs Stefan's `supabase db push` approval):**
- `20260714000011_calendar_generation_jobs.sql`
- `20260714000012_post_render_jobs.sql`

Both are new tables, not in `database.types.ts` yet — routes/jobs use the same `nt()`/`newTables()` any-cast idiom as `dailyAnalyticsFetch.ts` until Stefan applies the migration and types are regenerated.

**Alternatives considered:** Reusing `clip_forge_jobs`/`trend_builder_jobs` tables directly (rejected — those carry clip-forge/trend-specific columns like `shotstack_render_id`, `render_progress` that don't apply here; a lean job-per-concern table is simpler to reason about and matches the existing one-table-per-job-type pattern already used for those two features).

**Impact:** `/api/inngest/route.ts` now declares `maxDuration = 120` (previously unset) since carousel/variant Puppeteer renders run synchronously inside an Inngest step invoked through that route — same ceiling the old blocking render routes declared.

---

## [2026-07-14] P4 — media compression thresholds tightened + "keep original quality" opt-out

**Decision:** `compress-image.ts` changed from "always resize to 1200px + always re-encode to JPEG" to "only resize when longest side > 2048px; PNGs stay PNG (transparency preserved), never recompressed if already within limits." `compress-video.ts` changed from "always transcode to 720p" to "only transcode (to 1080p now, was 720p) when the file is over ~80MB" (`COMPRESS_THRESHOLD_BYTES`). A new shared `src/lib/client/upload/prepare-media-file.ts` wraps both for components that build their own FormData and POST directly to a route (calendar upload-media, carousel slide-media, stories upload) rather than going through the full `upload-manager.ts` signed-URL pipeline. Every upload surface (`MediaUploader.tsx`, `CalendarView.tsx`, `CarouselBuilder.tsx`, `StoriesClient.tsx`) got a "Keep original quality" checkbox (per-upload, nothing persisted) and a subtle "Compressed X → Y" feedback line (`compressionFeedback()` in `lib/utils.ts`).

**Impact:** Existing callers of `compressImage`/`compressVideo` (MediaUploader, StoriesClient's raw upload) automatically get the new thresholds — no double recompression of already-small assets, no more silent PNG→JPEG transparency loss. Server-side Puppeteer renders (`renderPost.ts`) are exact-dimension PNGs and were never touched by this change, per spec.
