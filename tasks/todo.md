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

## PHASE B — Brand Intelligence Foundation ⏳

**Goal:** Every Claude call uses a unified `getBrandContext()` function. No more ad-hoc assembly.
**Why now:** Without this, format conversions and calendar regeneration run without brand context — captions aren't brand-aware.

### Migration
- [ ] Write `20260510000001_brand_intelligence_tokens.sql`
  - `ALTER TABLE postflow.brands ADD COLUMN IF NOT EXISTS intelligence_tokens JSONB DEFAULT '{}'`
  - `CREATE TABLE postflow.brand_token_events (...)` — see memory/brand_intelligence.md for schema
  - Add new feedback tags to `tone_feedback` CHECK constraint: `great_hook`, `bad_music`, `too_fast`, `too_slow`, `wrong_length`, `doesnt_fit_brand`
- [ ] Review + apply migration

### Library
- [ ] Build `src/lib/server/brand/getBrandContext.ts`
  - Input: `brandId: string`
  - Output: `Promise<string>` — ready-to-inject prompt block
  - Sources: `brands.*` + `performance_patterns` + `niche_trends` + `intelligence_tokens`
  - **No caller ever assembles brand context inline after this exists**

### Refactor all callers (no new behaviour — pure refactor)
- [ ] `src/lib/server/posts/generateCaption.ts` — replace manual assembly with `getBrandContext()`
- [ ] `src/app/api/calendar/generate/route.ts` — replace inline assembly with `getBrandContext()`
- [ ] `src/app/api/posts/[id]/convert-format/route.ts` — ADD `getBrandContext()` (currently none)
- [ ] `src/app/api/calendar/[id]/regenerate/route.ts` — ADD `getBrandContext()` (currently none)

### Feedback tags UI
- [ ] PostEditor: add new video/hook tags to tone feedback section
  - Show `great_hook`, `too_fast`, `too_slow`, `wrong_length`, `doesnt_fit_brand` only when `post.platform` is tiktok or `template_slug` includes "reel"
  - Keep existing 5 tags for all posts

### Code quality check (run after Phase B)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Search codebase for `tone_profile?.summary` and `performance_patterns` inline — must be 0 results in routes after refactor
- [ ] Confirm `getBrandContext` is the only place brand prompt is assembled

### Verification
- [ ] Generate a caption → check server log includes "BRAND INTELLIGENCE" block with token data
- [ ] Regenerate a calendar entry → confirm it respects brand tone (not generic)
- [ ] Switch a post from single-image to carousel → confirm slides reflect brand voice
- [ ] Submit "great_hook" feedback → confirm saves to `tone_feedback` table without constraint error

**✅ Phase B complete when:** Zero inline brand assembly in any route. All 4 callers use `getBrandContext()`. New feedback tags save correctly.

---

## PHASE C — Upload Hub Polish ⏳

**Goal:** `/upload` is a real media library, not just a one-shot upload tool.

### Gallery view
- [ ] `MediaUploader`: fetch existing uploads from `GET /api/media` on mount
- [ ] Show "Your library" grid below drop zone — same card style as new uploads
- [ ] Filter tabs: All / Photos / Videos
- [ ] Delete button per item (call `DELETE /api/media/:id` — write this route)

### Smart post matching
- [ ] After confirm, call Claude haiku with: upload filename + file type + existing calendar entry topics (next 30 days)
- [ ] Return top 1–3 suggested calendar entries
- [ ] Show as small pill on each uploaded card: "📅 Suggested: Lower back pain post (Jun 12)"
- [ ] Click pill → navigates to `/calendar?open=[entryId]` and attaches media

### AI tagging
- [ ] Add `tags JSONB` + `quality_score INT` columns to `media_uploads` via migration
- [ ] Inngest function `analyzeMediaUpload`: triggered by `media/uploaded` event from confirm route
  - Call Claude Vision (claude-3-5-sonnet) with image
  - Classify: content type, quality score (0–100), 3–5 keyword tags
  - Write back to `media_uploads`
- [ ] Upload card: show quality badge after analysis completes (poll or optimistic update)
  - 🟢 75+ / 🟡 40–74 / 🔴 <40

### Code quality check
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Confirm delete route has RLS check (brand_id ownership)
- [ ] Confirm Inngest job has error handling if Vision call fails

### Verification
- [ ] Upload a photo → refresh page → confirm it still appears in library
- [ ] Upload 5 photos → confirm quality badges appear within 30s (Inngest job fires)
- [ ] Confirm "Suggested entry" chip appears on a photo that matches a calendar entry topic
- [ ] Delete a photo → confirm removed from library + storage

**✅ Phase C complete when:** Library persists across page loads. Quality badges appear. Delete works. Smart match suggests entries for majority of uploads.

---

## PHASE D — Carousel Template Redesign ⏳

**Goal:** Carousel slides are visually polished and use the attached per-slide media.

### Template redesign — carousel-edu.ts
- [ ] Hook slide: full brand-color background, large centered headline (max 12 words), small logo bottom-right
- [ ] Content slides: left 60% text (headline + 1–2 sentence body), right 40% media if available OR brand-color gradient block
- [ ] CTA slide: brand color, bold CTA text, @handle bottom

### Template redesign — carousel-myth.ts
- [ ] Hook slide: bold statement, dark background
- [ ] Myth slides: red-tinted left bar + ❌ icon + myth text in white
- [ ] Reality slides: green-tinted left bar + ✅ icon + truth text
- [ ] CTA slide: brand color

### Media injection in render pipeline
- [ ] `renderCarousel` route: check `slide.mediaUrl` per slide — if present, fetch as base64 (same pattern as `photo-overlay`)
- [ ] Pass base64 to template HTML as `data:image/...;base64,...`
- [ ] Fallback: if no mediaUrl, use brand color block
- [ ] CarouselBuilder: confirm `slide.mediaUrl` is included in render payload (check existing slide state shape)

### Code quality check
- [ ] Render 5-slide carousel with mixed media/no-media slides — confirm no crashes
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Confirm base64 fetch has timeout + error fallback (don't break render on 404 media)

### Verification
- [ ] Create carousel post → attach photo to slide 2 → click Render → confirm slide 2 shows photo
- [ ] Create carousel post → no photos → click Render → confirm all slides render (brand color fallback)
- [ ] Download rendered PNGs → confirm they look professional / shareable
- [ ] Myth carousel: render → confirm myth slides are red-tinted, reality slides are green-tinted

**✅ Phase D complete when:** Both carousel templates look polished. Media-attached slides show the photo. Empty slides use brand color gracefully. Stefan would share these.

---

## PHASE E — Launch ⏳

**Goal:** Both brands live on PostFlow. First post scheduled to Buffer.

### QA pass
- [ ] Full flow: new post → generate caption → render card → schedule to Buffer
- [ ] Full flow: generate calendar → create post from entry → schedule
- [ ] Analytics: confirm data fetches for connected platforms
- [ ] Billing: test plan upgrade + downgrade
- [ ] Bug fixes found during QA

### Onboarding
- [ ] Onboard PureProgressionX: complete onboarding wizard, connect Buffer, generate 2-week calendar
- [ ] Schedule 3 posts to Buffer from PureProgressionX
- [ ] Onboard MindyourBodyPT: same flow
- [ ] Monitor first week: check Buffer queue, post status updates, email reminders

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
