# PostFlow — Task Tracker

Reconciled 2026-05-12. Active: Phase G (V1 remaining spec items). Phase A = user-action deploy steps.
For full spec on each phase see `memory/implementation_plan.md`.

---

## PHASE A — Deploy Blockers 🔨 ACTIVE

**Goal:** Get production fully operational — billing, analytics, trends, tone loop, Instagram OAuth, and all Phase F features live.
**Blocked by:** pending migrations + missing env vars (user actions).

### Migrations to apply (push to GitHub → Vercel preview → merge)
- [ ] `20260509000004_billing_tables.sql` — billing schema (required for Stripe/Mollie)
- [ ] `20260509000005_tone_suggestion_to_brands.sql` — tone_suggestion column (required for tone loop)
- [ ] `20260510000001_brand_intelligence_tokens.sql` — brand intelligence tokens (applied locally, confirm on prod)
- [ ] `20260512000001_inspiration_posts.sql` — inspiration_posts table (Phase F5: Inspiration Link)
- [ ] `20260512000002_calibration_status.sql` — CHECK constraint on calibration_status (Phase F5: Onboarding)

### Env vars to set in Vercel production
Analytics / trends / email:
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SERPAPI_KEY`
- [ ] `NEWSAPI_KEY`
- [ ] `INNGEST_SIGNING_KEY`
- [ ] `INNGEST_EVENT_KEY`
- [ ] `RESEND_API_KEY`
- [ ] `CALENDAR_LINK_SECRET`
- [ ] `BUFFER_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_APP_URL` → must be `https://postflow-amber.vercel.app` (NOT localhost)
- [ ] `SUPADATA_API_KEY` — Inspiration Link scraping (Phase F5)

Instagram OAuth (Meta):
- [ ] `INSTAGRAM_APP_ID` → `2149364262528334`
- [ ] `INSTAGRAM_APP_SECRET` → from Meta Developer Suite
- [ ] Register `https://postflow-amber.vercel.app/api/auth/instagram/callback` in Meta Valid OAuth Redirect URIs
- [ ] Add Instagram account as Tester in Meta app → Roles → Instagram Testers

Billing:
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_STARTER_MONTHLY` + `STRIPE_PRICE_STARTER_ANNUAL`
- [ ] `STRIPE_PRICE_PRO_MONTHLY` + `STRIPE_PRICE_PRO_ANNUAL`
- [ ] `STRIPE_PRICE_BUSINESS_MONTHLY` + `STRIPE_PRICE_BUSINESS_ANNUAL`
- [ ] `MOLLIE_API_KEY`
- [ ] `MOLLIE_PLAN_STARTER` + `MOLLIE_PLAN_PRO` + `MOLLIE_PLAN_BUSINESS`

### Verification (after migrations + env vars applied)
- [ ] Stripe: go to `/settings/billing` → click upgrade → complete checkout → confirm plan updates
- [ ] Mollie: go to `/settings/billing` → choose iDEAL → complete → confirm plan updates
- [ ] Tone suggestion: submit 5 "too_formal" feedbacks on the same brand → confirm suggestion card appears in Brand > Voice
- [ ] Analytics: open `/analytics` → confirm page loads without 500 errors
- [ ] Inngest: open Inngest dashboard → confirm all 6 functions registered + scheduled
- [ ] Buffer webhook: publish a post via Buffer → confirm post status updates to "published" in PostFlow

Instagram OAuth verification:
- [ ] Connect Instagram at `/settings/connections` → completes OAuth → green "Instagram connected" banner
- [ ] Inspiration Link: paste an Instagram post URL → analysis runs → signals applied to brand tokens
- [ ] Onboarding calibration: complete wizard → Step 10 shows 3 sample posts → approve/adjust each → "Finish calibration" reaches dashboard

Preview URL fix:
- [ ] Vercel: ensure `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set for **Preview** environment (not just Production)

**✅ Phase A complete when:** All env vars set, all 5 migrations applied, all verification checks pass.

---

## PHASE G — V1 Remaining Spec Items ✅ COMPLETE (2026-05-12)

**Goal:** Complete every v1 spec item not yet built. Grouped by scope.

### G1 — Quick wins: standalone components + design token wiring ✅ COMPLETE (2026-05-12)
- [x] `globals.css` — `--pf-*` CSS vars already present and matching tokens (verified)
- [x] `src/components/shared/HealthBar.tsx` — standalone, score + size + showLabel, tier-colour logic
- [x] `src/components/shared/HealthScore.tsx` — badge/pill numeric score with tier colour
- [x] `src/components/shared/RenderQueueDrawer.tsx` — polling drawer, clip_forge + trend jobs
- [x] `src/app/api/render/queue/route.ts` — feeds RenderQueueDrawer with aggregated job list
- [x] `TemplatesClient.tsx` + `TemplateSuggestionCard.tsx` — now use shared HealthBar + HealthScore

### G2 — OAuth token refresh ✅ COMPLETE (2026-05-12)
- [x] `src/inngest/jobs/refreshTokens.ts` — every 6h, Instagram auto-refresh, others log+deactivate
- [x] Registered in `src/app/api/inngest/route.ts`

### G3 — ffmpeg.wasm upload pipeline ✅ COMPLETE (2026-05-12)
- [x] `next.config.ts` — COOP/COEP headers scoped to `/upload` (not global — avoids breaking OAuth)
- [x] `compress-video.ts` — ffmpeg.wasm 720p H.264 CRF26, MOV→MP4 transcoding
- [x] `compress-image.ts` — canvas 1200px JPEG 85%, HEIC→JPEG via heic2any
- [x] `chunked-upload.ts` — TUS resumable upload via Supabase client for >50MB
- [x] `upload-manager.ts` — compress→sign→upload→confirm with stage+progress callbacks
- [x] `MediaUploader.tsx` — integrated upload-manager, compression progress overlay, 200MB limit, HEIC support

### G4 — Whisper captions in clip-forge ✅ COMPLETE (2026-05-12)
- [x] `src/lib/server/clip-forge/whisper-captions.ts` — OpenAI Whisper API, verbose_json with segment timestamps
- [x] Wired into `/api/clip-forge/[id]/render` — auto-transcribes when no captions supplied + OPENAI_API_KEY set
- [x] Transcription summaries passed as `captionText` into ClipInputs → Shotstack Layer 4 overlays
- [x] Graceful fallback: skips transcription if OPENAI_API_KEY missing (no error, just no captions)

### G5 — Final V1 spec gaps ✅ COMPLETE (2026-05-12)
- [x] Buffer notification-publish fallback UI — `PostEditor.tsx` shows "Almost there" banner for Instagram/Facebook posts with media; `schedule/route.ts` returns `notificationPublish` flag
- [x] Instagram OAuth debug tooling — `/api/auth/instagram/debug` endpoint shows masked app ID, redirect URI, full auth URL preview; callback route now logs full tokenUrl + raw response body for Vercel log diagnosis

**Architectural debt (Amber — functionality exists, not separate module files):**
- nudge-analyzer.ts — inline in `/api/trend/[id]/nudge/route.ts` as `extractNudgeSignals()`
- version-builder.ts — inline via `getVersionTokens()` in `trend-filter.ts`
- concept-generator.ts — part of `trend-filter.ts` as `generateTrendConcepts()`
- useRenderStatus, useUploadManager, useBrandProfile, useTrendConcepts, useDualRender — state managed inline in client components (acceptable for V1)
- `/inspiration/analyse/page.tsx` — analysis result is inline in `InspirationClient.tsx` (acceptable for V1)

---

## PHASE F — V6 Spec Build ✅ COMPLETE (2026-05-12)

- [x] Smart Video Builder (clip-forge) — upload clips → Shotstack assembly → brand overlay
- [x] Trend Builder — Google Trends + NewsAPI → Claude concept cards → brand-fit score → accept/skip flow
- [x] Template Health Engine — usage analytics, performance scoring, archival
- [x] Meta webhook — GET challenge verification ✓, POST analytics ingest (comments/reactions)
- [x] Instagram Business Login OAuth — `/api/auth/instagram` → callback → token stored in `social_accounts`
- [x] `ConnectionsClient` — Direct connections section with Connect button + success/error banners
- [x] Stories & Reels page — 3-step wizard: upload → customise → schedule
- [x] Inspiration Link — Supadata scrape → Claude signal extraction → nudgeToken() per signal
- [x] Onboarding Step 10: First Post Calibration — 3 sample posts (A/B/C), approve/adjust/refine, confirm seeds 13 tokens
- [x] `TOTAL_STEPS` bumped to 10, Step9 calls `next()` → flows into Step10

---

## PHASE B — Brand Intelligence Foundation ✅ COMPLETE (2026-05-10)

- [x] Migration `20260510000001_brand_intelligence_tokens.sql` — intelligence_tokens column, brand_token_events table, extended tone_feedback CHECK
- [x] `getBrandContext.ts` built — queries brands + performance_patterns + niche_trends + intelligence_tokens, builds prompt block
- [x] All 4 Claude callers refactored: generateCaption, calendar/generate, convert-format, calendar/regenerate
- [x] Video/reel + carousel feedback tags added to PostEditor UI (conditional on selectedTemplate)
- [x] Dutch language support: content_language auto-detected in extractToneProfile, injected into all generation prompts
- [x] JSON fence-stripping added to extractToneProfile, generateSamplePost, generateCaption (robustJsonParse)
- [x] `npx tsc --noEmit` — zero errors ✓

---

## PHASE C — Upload Hub ✅ COMPLETE (2026-05-10)

- [x] `GET /api/media` — lists brand's media_uploads (newest first)
- [x] `DELETE /api/media/[id]` — removes DB record + storage file (RLS checked)
- [x] `GET /api/media/[id]/matches` — returns compatible upcoming calendar entries
- [x] `MediaGallery.tsx` — grid with filter tabs (All/Photos/Videos), quality badges, AI tags, calendar match assignment, delete
- [x] `tagMediaUpload` Inngest job — Claude Vision tagging + quality score on upload confirm
- [x] `npx tsc --noEmit` — zero errors ✓

---

## PHASE D — Carousel Template Redesign ✅ COMPLETE (2026-05-10)

- [x] `carousel-edu.ts` redesigned — dual-wave hook, media image-top content layout (38% band + gradient fade), dual-glow CTA
- [x] `carousel-myth.ts` redesigned — photo texture overlay at 0.12 opacity (myth) / 0.14 (reality), dual-glow CTA
- [x] `validate-carousel.ts` created — slide count check, per-slide headline/body truncation warnings (separate limits for media vs text layouts), `assertCarouselValid()` helper
- [x] `render-carousel/route.ts` — `assertCarouselValid(slideContent, templateSlug)` called after body parse
- [x] `renderPost.ts` bug fix — `resolvedInput.slideContent` (data URIs) correctly passed to buildTemplateData (was passing unresolved `input.slideContent`)
- [x] `Step3Identity.tsx` fix — color picker double-registration removed; native `<input type="color">` is sole registered element
- [x] `npx tsc --noEmit` + `npm run build` — zero errors, clean production build ✓

---

## PHASE E — Launch 🔨 ACTIVE

**Goal:** Both brands live on PostFlow. First post scheduled to Buffer.

### Onboarding (requires user action)
- [ ] Onboard PureProgressionX: complete onboarding wizard, connect Buffer, generate 2-week calendar
- [ ] Schedule 3 posts to Buffer from PureProgressionX
- [ ] Onboard MindyourBodyPT: same flow
- [ ] Monitor first week: check Buffer queue, post status updates, email reminders

### Blocked by (Phase A prerequisites)
- Migrations `20260509000004` (billing) + `20260509000005` (tone_suggestion) + `20260510000001` (intelligence_tokens) must be applied
- Vercel env vars (see Phase A list above) must be set

**✅ Launch complete when:** Both brands have posts in Buffer queue. No critical bugs.

---

## Completed: Weeks 1–6 ✅

### Weeks 1–3 — Foundation + Brand + Post Editor + Calendar + Buffer
All complete. See `memory/implementation_plan.md` for full list.

### Week 4 — Template Engine + Carousel + UX polish
- [x] 9 Puppeteer templates
- [x] Render pipeline (single, carousel, render-variants — shared browser)
- [x] Format conversion bidirectional (single↔carousel)
- [x] Template picker + variant selector
- [x] Calendar: platform pills, shooting frequency, delete/regenerate entry
- [x] Dashboard: clickable items
- [x] New post flow: 2-step, direct to PostEditor
- [x] Billing tables migration written
- [x] Onboarding tour
- [x] Presigned URL upload (bypass Vercel 5MB limit)

### Week 5 — Analytics + Trends + Email
- [x] Meta Graph API analytics ingest
- [x] LinkedIn Analytics ingest
- [x] `dailyAnalyticsFetch` Inngest cron
- [x] `weeklyPerformancePatterns` Inngest cron
- [x] Google Trends + News API trend fetch
- [x] `niche_trends` table + `performance_patterns` table
- [x] Weekly trend email (Resend + Claude narrative)
- [x] Analytics dashboard UI
- [x] Buffer webhook handlers
- [x] Post reminders (24h + 1h via Inngest sleepUntil)
- [x] Performance patterns + trends injected into caption generation

### Week 6 — Billing + Tone Loop
- [x] Stripe checkout + portal + webhooks
- [x] Mollie iDEAL/SEPA + mandate + recurring
- [x] Billing UI (`/settings/billing`)
- [x] Plan limits enforcement
- [x] Invoice table + VAT (21% Dutch BTW)
- [x] Tone learning loop Inngest job
- [x] Tone suggestion card in Brand > Voice
- [x] Brand PATCH route

---

## V2 Backlog

- [ ] Smart Upload → Post Intelligence (full spec in features_mvp.md)
- [ ] Reel assembly from clips (Shotstack/Creatomate)
- [ ] Stock image search (Unsplash API)
- [ ] AI-generated slide images (anatomy, infographics)
- [ ] Client portal (read-only calendar + approval flow)
- [ ] Multi-language caption generation
- [ ] Auto-schedule optimisation
- [ ] Prediction accuracy dashboard
