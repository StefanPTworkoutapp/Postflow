# PostFlow — Task Tracker

Last updated: 2026-06-14 (session cleanup)

---

## ✅ DONE THIS SESSION

- [x] All OAuth connections fixed (`NEXT_PUBLIC_APP_URL` corrected to `postflowsocials.app`)
- [x] TikTok v2 flat token response fix
- [x] TikTok domain verification file served correctly
- [x] TikTok sandbox connected; production app submitted for review
- [x] LinkedIn OIDC real name working (OpenID Connect product added)
- [x] Mollie test + live API keys set in Vercel
- [x] Mollie webhook confirmed (per-payment URL, no dashboard webhook needed)
- [x] Facebook + Instagram OAuth connected ✓
- [x] Stripe account created (MindYourBodyPT B.V., NL)
- [x] Stripe webhook configured (8 events, `postflowsocials.app/api/webhooks/stripe`)
- [x] All 12 Stripe env vars pushed to Vercel + `.env.local`
- [x] Stripe webhook handlers added: paused, resumed, trial_will_end
- [x] Stripe API version bumped to `2026-05-27.dahlia`
- [x] Terms of Service updated: KVK/BTW, EU withdrawal waiver, cancellation, Mollie/Stripe split
- [x] Privacy Policy updated: KVK/BTW, Mollie as processor, correct domain + contact email

---

================================================================
CONFIRMED DECISIONS (locked)
================================================================
- Video clip rendering (Shotstack) → POST-MVP flat add-on, NOT in subscriptions
- Pre-edited video scheduling via Buffer = MVP, no Shotstack needed
- Stripe prices stay as created: €49/€99/€149/€199/€299 monthly
- Brand limits: Starter=1, Pro=3, Studio=5, Business=10, Agency=unlimited
- Templates ARE already brand-dynamic. Problem is design quality, not engine.
- Analytics per brand already scoped correctly. Needs to be VISIBLE to users.
- BTW number: NL869239909B01 | KVK: 42003965
================================================================

---

## STEP 1 — Code fixes before deploy ⚠️ DO FIRST

These must be committed and deployed before E2E testing. All are in the codebase.

- [ ] Switch clip analyzer: `claude-opus-4-5` → `claude-haiku-4-5` in clip-forge (15× cheaper, same quality)
- [ ] Add `checkStorageLimit()` to `src/lib/server/billing/limits.ts` — queries `SUM(file_size_mb)` vs plan limit
- [ ] Wire storage check into all 4 upload routes (media, clip-forge, stories, calendar)
- [ ] Fix `/api/calendar/[id]/upload-media` — missing per-file size check
- [ ] Storage usage bar in `/settings/billing` — "X GB of Y GB used"

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

Must be applied via `supabase db push` or GitHub → merge to main → Vercel preview:

- [ ] `20260509000004_billing_tables.sql` — billing schema (Stripe/Mollie tables)
- [ ] `20260509000005_tone_suggestion_to_brands.sql` — tone_suggestion column
- [ ] `20260510000001_brand_intelligence_tokens.sql` — intelligence_tokens + brand_token_events
- [ ] `20260512000001_inspiration_posts.sql` — inspiration_posts table
- [ ] `20260512000002_calibration_status.sql` — calibration_status CHECK constraint

After migrations: `supabase gen types typescript --linked --schema postflow 2>/dev/null > src/types/database.types.ts`

---

## STEP 4 — User actions required

- [ ] **Facebook OAuth redirect URIs** — Facebook Developer Portal → Facebook Login for Business → Settings → Valid OAuth Redirect URIs → add:
  - `https://postflowsocials.app/api/auth/facebook/callback`
  - `https://postflowsocials.app/api/auth/instagram/callback`
- [ ] **Vercel redeploy** — after env vars added, trigger redeploy so they take effect
- [ ] **Stripe notification email** — Stripe dashboard → Settings → Business details → set support email to `support@mindyourbodypt.nl`
- [ ] **Mollie notification email** — Mollie dashboard → account settings → notifications → set to `support@mindyourbodypt.nl`

---

## STEP 5 — E2E test checklist

Run through this in order on `postflowsocials.app`:

**Billing:**
- [ ] `/settings/billing` → click Upgrade → Stripe Starter checkout completes → plan shows "Starter"
- [ ] Stripe dashboard confirms subscription created
- [ ] Invoice PDF stored (check `invoices` table in Supabase)

**Connections:**
- [ ] Instagram → connect → OAuth completes → green banner
- [ ] Facebook → connect → OAuth completes
- [ ] LinkedIn → connect → shows real name (not "LinkedIn user")
- [ ] TikTok → connect → OAuth completes (sandbox)
- [ ] Buffer → connect → OAuth completes

**Content flow:**
- [ ] Create new post → AI generates caption → template renders → schedule to Buffer
- [ ] Buffer queue shows post
- [ ] Post published → Buffer webhook fires → PostFlow status updates to "published"

**Analytics:**
- [ ] `/analytics` loads without 500 errors
- [ ] Analytics data shows after at least 1 published post

**Inngest:**
- [ ] Inngest dashboard → all 6 functions registered + scheduled crons visible

**Onboarding:**
- [ ] Fresh account → onboarding wizard → Step 10 (calibration) → 3 sample posts → complete → reach dashboard

---

## PHASE H — Brand System + Template Quality 📋 AFTER E2E

**Goal:** Living brand organism. One source of truth. Every feature reads from it.
**Start after:** E2E test passes.

### H2 — Universal brand management (`/brands`)
- [ ] `/brands` list page — all brands: logo, name, health score, last post, platform icons, switch + edit buttons
- [ ] `/brands/[id]/edit` — name, logo, colors, niche, tone, template_style slider, preferred template — all in one place
- [ ] Brand delete with impact warning + cascade
- [ ] `preferred_template_slug` column on `brands` table (migration)
- [ ] Surface `template_style` slider in brand editor
- [ ] TopBar: active brand name + color dot (left slot is currently empty `<div />`)
- [ ] Replace `window.location.reload()` on brand switch → `router.refresh()`

### H3 — Universal `<BrandSelector />` component
- [ ] Extract into `<BrandSelector variant="sidebar|topbar|inline|filter" />`
- [ ] Wire into TopBar, Calendar, Analytics, New Post flow, Connections page

### H4 — Multi-brand calendar
- [ ] "All brands" toggle — color-coded events by brand primary color
- [ ] Brand filter chips above calendar
- [ ] Post cards show brand logo/color badge
- [ ] URL param `?brand=all|[id]` for bookmarking

### H5 — Template quality upgrade (editorial-level)
- [ ] 3 new editorial templates: multi-photo grid, circular cutout variant, bold-statement editorial
- [ ] `/brands/[id]/templates` — all templates live-rendered in THAT brand's visual identity
- [ ] AI template adjustment: text prompt → Claude adjusts style → saved per brand
- [ ] Secondary template config per brand (base template untouched, brand overlay on top)
- [ ] Template health scores visible in picker ("Best for your brand" / "Declining")

### H6 — Analytics visibility
- [ ] Dashboard widget: "Top performing format this month"
- [ ] Insights: engagement breakdown by post format (photo vs carousel vs reel)
- [ ] LinkedIn + Buffer: add `brand_tokens_snapshot` at analytics ingest

### H7 — Video add-on (post-MVP)
- [ ] `render_credits` table + Stripe add-on products (10/50/100 renders)
- [ ] Clip-forge gated behind credit balance (not plan tier)
- [ ] Render credit purchase in `/settings/billing`
- [ ] Prompt caching: `cache_control: ephemeral` on brand context block in all Claude calls

### H1 — Pre-edited video scheduling
- [ ] Verify MP4 upload → Buffer handoff passes video file (not just notification)
- [ ] Gate: Pro+ only

---

## BACKLOG — Brand setup + rendering audit

- [ ] **Brand setup (PostFlow)** — user provides ToV files → create PostFlow brand in app → set colors, logo, tone
- [ ] **Post rendering audit** — set up brand fully → render all 9 templates → document quality → screenshot for reference

---

## COMPLETED PHASES (archive)

- ✅ Phase G — V1 Remaining Spec Items (2026-05-12)
- ✅ Phase F — V6 Spec Build (2026-05-12)
- ✅ Phase B — Brand Intelligence Foundation (2026-05-10)
- ✅ Phase C — Upload Hub (2026-05-10)
- ✅ Phase D — Carousel Template Redesign (2026-05-10)
- ✅ Weeks 1–6 — Foundation through Billing + Tone Loop
