# PostFlow — Task Tracker

Reconciled 2026-05-10. Weeks 1–6 are done. Active work starts at Phase A.
For full spec on each phase see `memory/implementation_plan.md`.

---

## PHASE A — Deploy Blockers 🔨 ACTIVE

**Goal:** Get production fully operational — billing, analytics, trends, and tone loop all live.
**Blocked by:** pending migrations + missing env vars.

### Migrations to apply (push to GitHub → Vercel preview → merge)
- [ ] `20260509000004_billing_tables.sql` — billing schema (required for Stripe/Mollie)
- [ ] `20260509000005_tone_suggestion_to_brands.sql` — tone_suggestion column (required for tone loop)

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
- [ ] `NEXT_PUBLIC_APP_URL`

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

**✅ Phase A complete when:** All env vars set, both migrations applied, above 6 checks pass.

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
