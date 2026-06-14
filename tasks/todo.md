# PostFlow — Task Tracker

Last updated: 2026-06-14

---

## ✅ DONE THIS SESSION

- [x] All OAuth connections fixed (`NEXT_PUBLIC_APP_URL` corrected to `postflowsocials.app`)
- [x] TikTok v2 flat token response fix + domain verification file
- [x] TikTok sandbox connected; production app submitted for review
- [x] LinkedIn OIDC real name working (OpenID Connect product added)
- [x] Mollie test + live API keys set in Vercel; webhook confirmed (per-payment URL)
- [x] Facebook + Instagram OAuth connected ✓
- [x] Stripe account created (MindYourBodyPT B.V., NL)
- [x] Stripe webhook configured (10 events, `postflowsocials.app/api/webhooks/stripe`)
- [x] All 12 Stripe env vars pushed to Vercel + `.env.local`
- [x] Stripe webhook handlers: paused, resumed, trial_will_end, checkout.session.expired
- [x] Stripe API version bumped to `2026-05-27.dahlia`
- [x] Terms of Service: KVK/BTW, EU withdrawal waiver, cancellation, Mollie/Stripe split
- [x] Privacy Policy: KVK/BTW, Mollie as processor, correct domain + contact email
- [x] **Step 1 DONE:** `clipAnalyzer` switched to `claude-haiku-4-5` (15× cheaper)
- [x] **Step 1 DONE:** `checkStorageLimit()` added to `limits.ts`
- [x] **Step 1 DONE:** Storage check wired into all 4 upload routes (HTTP 402 on breach)
- [x] **Step 1 DONE:** Calendar upload now has 50 MB per-file cap
- [x] **Step 1 DONE:** Storage usage bar in `/settings/billing` (amber ≥70%, red ≥90%)
- [x] **Bell DONE:** Storage warning popover on Bell icon in TopBar (amber dot ≥70%, red ≥90%)
- [x] **Bell DONE:** Dismissable (7 days for warning, 24h for critical); "Upgrade plan" CTA
- [x] **Bell DONE:** Storage percent computed in AppLayout and passed as props
- [x] `Popover` UI component created (`src/components/ui/popover.tsx`)
- [x] Spec written: `docs/specs/analytics-template-feedback.md`
- [x] Spec written: `docs/specs/template-preferences.md`
- [x] Spec written: `docs/specs/caption-quality-human-voice.md`
- [x] Spec written: `docs/specs/brand-voice-overview.md`
- [x] Spec written: `docs/specs/storage-addon.md`

---

================================================================
CONFIRMED DECISIONS (locked)
================================================================
- Video clip rendering (Shotstack) → POST-MVP flat add-on, NOT in subscriptions
- Pre-edited video scheduling via Buffer = MVP, no Shotstack needed
- Stripe prices stay as created: €49/€99/€149/€199/€299 monthly
- Brand limits: Starter=1, Pro=3, Studio=5, Business=10, Agency=unlimited
- Templates ARE already brand-dynamic. Engine is fine. Quality = design + intelligence tokens
- Analytics per brand already scoped correctly — just not VISIBLE to users
- BTW number: NL869239909B01 | KVK: 42003965
- Storage add-on: YES, build post-H5 (spec: docs/specs/storage-addon.md)
- Template slots per post type: Free=1, Starter=1, Pro=3, Studio=5, Business=5, Agency=5
- Template locking: Pro=1 lock, Studio/Business=2 locks, Agency=3 locks
================================================================

---

## STEP 2 — Env vars still missing in Vercel production

All of these are in `.env.local` already — just need to be pushed to Vercel:

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SERPAPI_KEY`
- [ ] `NEWSAPI_KEY`
- [ ] `INNGEST_SIGNING_KEY`
- [ ] `INNGEST_EVENT_KEY`
- [ ] `RESEND_API_KEY`
- [ ] `CALENDAR_LINK_SECRET`
- [ ] `BUFFER_WEBHOOK_SECRET`
- [ ] `SUPADATA_API_KEY`
- [ ] `META_APP_ID` (= `1295792886074969`)
- [ ] `META_APP_SECRET`
- [ ] `TIKTOK_CLIENT_KEY`
- [ ] `TIKTOK_CLIENT_SECRET`
- [ ] `LINKEDIN_CLIENT_ID`
- [ ] `LINKEDIN_CLIENT_SECRET`
- [ ] `POSTFLOW_ANTHROPIC_KEY`
- [ ] `CRON_SECRET`
- [ ] `MOLLIE_API_KEY` (live key)
- [ ] `MOLLIE_API_KEY_LIVE`

---

## STEP 3 — Migrations to apply to production

Apply via `supabase db push` after review:

- [ ] `20260509000004_billing_tables.sql` — billing schema (Stripe/Mollie tables)
- [ ] `20260509000005_tone_suggestion_to_brands.sql` — tone_suggestion column
- [ ] `20260510000001_brand_intelligence_tokens.sql` — intelligence_tokens + brand_token_events
- [ ] `20260512000001_inspiration_posts.sql` — inspiration_posts table
- [ ] `20260512000002_calibration_status.sql` — calibration_status CHECK constraint

After migrations: `supabase gen types typescript --linked --schema postflow 2>/dev/null > src/types/database.types.ts`

---

## STEP 4 — User actions required

- [ ] **Facebook OAuth redirect URIs** — Facebook Developer Portal → Facebook Login for Business → Valid OAuth Redirect URIs:
  - `https://postflowsocials.app/api/auth/facebook/callback`
  - `https://postflowsocials.app/api/auth/instagram/callback`
- [ ] **Vercel redeploy** — after env vars added, trigger redeploy
- [ ] **Stripe notification email** → `support@mindyourbodypt.nl`
- [ ] **Mollie notification email** → `support@mindyourbodypt.nl`

---

## STEP 5 — E2E test checklist

Run through this on `postflowsocials.app` after Steps 2–4:

**Billing:**
- [ ] `/settings/billing` → Upgrade → Stripe Starter checkout → plan shows "Starter"
- [ ] Stripe dashboard confirms subscription created
- [ ] Storage bar shows "0.00 GB of 10 GB used"
- [ ] Bell icon: no dot at 0% usage

**Connections:**
- [ ] Instagram / Facebook / LinkedIn / TikTok / Buffer all OAuth correctly

**Content flow:**
- [ ] Create post → caption generated → template renders → schedule to Buffer
- [ ] Post published → Buffer webhook → status "published"

**Analytics:**
- [ ] `/insights` loads without errors
- [ ] Data shows after 1+ published post

**Inngest:**
- [ ] All functions registered + crons visible

**Onboarding:**
- [ ] Fresh account → onboarding → calibration → dashboard

---

## PHASE H — Pre-H5 Quick Wins (do before H5)

### Caption quality fixes (spec: `docs/specs/caption-quality-human-voice.md`)
- [ ] Inject `do_use[]` patterns into `generateCaption.ts` (affirmative style rules)
- [ ] Add anti-AI instruction block to caption system prompt
- [ ] Inject 1–2 `tone_examples` as few-shot samples (when available)
- [ ] Strengthen signature_phrases: "exactly one, woven in" not "use naturally"
- [ ] Fix `toneLearningLoop.ts` line ~170: use `tone_profile` summary not raw `tone_examples`

---

## PHASE H2 — Universal Brand Management

(spec: `docs/specs/brand-voice-overview.md` for Voice tab)

- [ ] `/brands` list page — logo, name, health score, last post, switch/edit
- [ ] `/brands/[id]/edit` — tabs: Overview | Voice | Templates | Connections
- [ ] **Voice tab** — show/edit do_use, do_not_use, phrases, custom rules
  - [ ] Migration: `custom_do_rules` + `custom_dont_rules` + `voice_updated_at` on brands
  - [ ] PATCH `/api/brands/[id]/voice` — save edits, log to `brand_token_events`
  - [ ] POST `/api/brands/[id]/voice/refresh` — re-run tone extraction from examples
  - [ ] AI Update History — show last 20 `brand_token_events` in readable form
  - [ ] Plan gating: view = all, edit = Starter+, custom rules = Pro+
- [ ] Brand delete with impact warning + cascade
- [ ] TopBar: active brand name + color dot (left slot is currently empty `<div />`)
- [ ] Replace `window.location.reload()` on brand switch → `router.refresh()`

---

## PHASE H3 — Universal `<BrandSelector />` component

- [ ] Extract into `<BrandSelector variant="sidebar|topbar|inline|filter" />`
- [ ] Wire into TopBar, Calendar, Analytics, New Post flow, Connections page

---

## PHASE H4 — Multi-brand calendar

- [ ] "All brands" toggle — color-coded events by brand primary color
- [ ] Brand filter chips above calendar
- [ ] URL param `?brand=all|[id]` for bookmarking

---

## PHASE H5 — Template quality + multi-slot system

(spec: `docs/specs/template-preferences.md`)

- [ ] Migration: `brand_template_preferences` table (brand_id, post_type, template_slug, slot_index, locked)
- [ ] Update `plans.ts`: add `templateSlotsPerPostType` + `templateLockSlots` to PlanLimits
- [ ] `/src/lib/server/render/selectTemplate.ts` — rotation logic (round-robin from saved slots)
- [ ] Brand editor: Templates tab with per-post-type slot manager
  - [ ] Add/remove slots up to plan limit
  - [ ] Lock toggle (Pro+ only, server enforced)
  - [ ] Live preview on hover
  - [ ] Auto-swap: replace lowest-score unlocked slot on templatePulse
  - [ ] Upgrade prompt when at capacity
- [ ] Post Editor: show brand preferred templates at top of picker
- [ ] 3 new editorial templates (multi-photo grid, bold-statement, circular cutout)
- [ ] Wire `intelligence_tokens` (`text_overlay_style`, `carousel_text_overlay_density`) into `buildHtml()` (currently only in Shotstack)

---

## PHASE H6 — Analytics visibility

(spec: `docs/specs/analytics-template-feedback.md`)

- [ ] Insights page: template performance table (top 5 by score, score + trend)
- [ ] Insights page: post type filter chips (All / Single / Carousel / Reel / Story)
- [ ] Dashboard: "Top performing format" card (best template this month)
- [ ] Calendar generation: bias toward top-scoring templates (explicit slot counts)
- [ ] Calendar: `template_slug` required in generation response schema

---

## PHASE H7 — Storage add-on (post H5)

(spec: `docs/specs/storage-addon.md`)

- [ ] Create Stripe add-on products: +50 GB / +200 GB / +500 GB
- [ ] Migration: `storage_addon_gb` on subscriptions
- [ ] Update `checkStorageLimit()` to include addon_gb in total
- [ ] Webhook handler: update `storage_addon_gb` on subscription item changes
- [ ] Billing page: Storage Add-on section (below plan cards)
- [ ] Bell notification: show "Add +50 GB for €5" option at 90%

---

## PHASE H8 — Video add-on (post-MVP)

- [ ] `render_credits` table + Stripe add-on products (10/50/100 renders)
- [ ] Clip-forge gated behind credit balance (not plan tier)
- [ ] Render credit purchase in `/settings/billing`
- [ ] Prompt caching: `cache_control: ephemeral` on brand context block in all Claude calls

---

## BACKLOG

- [ ] **Brand setup (PostFlow)** — user provides ToV files → create PostFlow brand → set colors, logo, tone
- [ ] **Post rendering audit** — render all 9 templates → document quality → screenshot for reference
- [ ] **Pre-edited video scheduling** — verify MP4 upload → Buffer handoff passes video file; gate Pro+
- [ ] Inngest jobs for `story`, `linkedin_post`, `tiktok_video` token keys (currently empty arrays)
- [ ] Analytics → token nudge path (`signalType: "analytics"` exists but nothing calls it)

---

## COMPLETED PHASES (archive)

- ✅ Phase G — V1 Remaining Spec Items (2026-05-12)
- ✅ Phase F — V6 Spec Build (2026-05-12)
- ✅ Phase B — Brand Intelligence Foundation (2026-05-10)
- ✅ Phase C — Upload Hub (2026-05-10)
- ✅ Phase D — Carousel Template Redesign (2026-05-10)
- ✅ Weeks 1–6 — Foundation through Billing + Tone Loop
