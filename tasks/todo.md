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
- [x] `clipAnalyzer` switched to `claude-haiku-4-5` (15× cheaper)
- [x] `checkStorageLimit()` added to `limits.ts`; storage check wired into all 4 upload routes
- [x] Storage usage bar in `/settings/billing` (amber ≥70%, red ≥90%)
- [x] Bell storage warning (dismissable, 7d/24h, CTA to billing)
- [x] `Popover` UI component created
- [x] Specs written: analytics-template-feedback, template-preferences, caption-quality-human-voice, brand-voice-overview, storage-addon
- [x] **PHASE H1–H8** — all complete (see archive below)
- [x] **AUDIT COMPLETE** — analytics roundtrip ✅, rendering gaps ✅, security audit ✅, user flows ✅
- [x] **Security fixes** (committed 2026-06-14):
  - `ai_usage_logs` RLS enabled (migration `20260616000001`)
  - `CALENDAR_LINK_SECRET` hardcoded fallback removed — throws 500 if env var absent
  - Upload MIME type allowlist added (`image/*`, `video/*`, `application/pdf`)
- [x] **Brand identity gaps closed** (committed 2026-06-14):
  - `accent_color` wired through all render routes → `BrandVars.accentColor`
  - `tagline`, `website_url`, `target_age_range`, `geographic_location` added to `BrandContext`
    and injected into every Claude caption/calendar call via `buildPromptBlock`
- [x] **Architecture docs written**:
  - `docs/architecture/user-flows.md` — 14 complete user journeys
  - `docs/architecture/page-hierarchy.md` — all pages + ~80 API routes
- [x] **E2E browser sweep complete** (committed 2026-06-14):
  - Found and fixed root-cause Next.js 16 stuck-Suspense bug pattern:
    - `/settings/connections` — `useSearchParams()` in Suspense (never resolved)
    - `/brand?tab=intelligence` — `cookies()` inside async server component in Suspense (streaming deadlock)
    - `/schedule` — `CalendarView` used `useSearchParams()` in Suspense (never resolved)
    - `/insights?tab=trends` — `TrendClient` in unnecessary Suspense (never rendered)
  - Fix pattern: read all params/data at server page level, pass as props; eliminate client-side `useSearchParams()`
  - `photo-overlay` template seeded in DB (was in code but missing from DB since launch)
  - Dead code removed: `SettingsClient` Buffer OAuth params handling
  - All 8 pages tested clean: dashboard, brand, schedule, insights, create, connections, billing, admin

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
- [ ] `CALENDAR_LINK_SECRET`  ← CRITICAL (hardcoded fallback removed — must be set in prod)
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
- [ ] `20260615000001_brand_voice_custom_rules.sql` — custom_do_rules / custom_dont_rules columns
- [ ] `20260615000002_brand_template_preferences.sql` — template slot system table
- [ ] `20260615000003_storage_addon.sql` — storage_addon_gb column on subscriptions
- [ ] `20260615000004_render_credits.sql` — render_credit_transactions table
- [ ] `20260616000001_ai_usage_logs_rls.sql` — RLS on ai_usage_logs (SECURITY)

After migrations: `supabase gen types typescript --linked --schema postflow 2>/dev/null > src/types/database.types.ts`

---

## STEP 4 — User actions required

- [ ] **Facebook OAuth redirect URIs** — Facebook Developer Portal → Facebook Login for Business → Valid OAuth Redirect URIs:
  - `https://postflowsocials.app/api/auth/facebook/callback`
  - `https://postflowsocials.app/api/auth/instagram/callback`
- [ ] **Vercel: push all STEP 2 env vars** then trigger redeploy
- [ ] **Stripe notification email** → `support@mindyourbodypt.nl`
- [ ] **Mollie notification email** → `support@mindyourbodypt.nl`
- [ ] **Stripe add-on products** (H7/H8):
  - 3 recurring storage products: +50 GB (€5), +200 GB (€15), +500 GB (€30) — set price metadata `type=storage_addon` + `storage_gb=N`
  - 3 one-time render credit products: 10 renders (€9), 50 renders (€39), 100 renders (€69)
  - Set 6 new env vars: `STRIPE_ADDON_STORAGE_50_PRICE`, `STRIPE_ADDON_STORAGE_200_PRICE`, `STRIPE_ADDON_STORAGE_500_PRICE`, `STRIPE_CREDITS_10_PRICE`, `STRIPE_CREDITS_50_PRICE`, `STRIPE_CREDITS_100_PRICE`
  - Set 3 annual variants if wanted: `STRIPE_ADDON_STORAGE_50_ANNUAL`, `STRIPE_ADDON_STORAGE_200_ANNUAL`, `STRIPE_ADDON_STORAGE_500_ANNUAL`

---

## STEP 5 — E2E test checklist

Run through this on `postflowsocials.app` after Steps 2–4:

**Auth + Onboarding:**
- [ ] Fresh account signup → onboarding wizard → brand created → dashboard
- [ ] Login with Google works

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

---

## PHASE H — Pre-H5 Quick Wins ✅ DONE
## PHASE H2 — Universal Brand Management ✅ DONE
## PHASE H3 — BrandSelector (folded into H4/H6) ✅ DONE
## PHASE H4 — Multi-brand calendar ✅ DONE
## PHASE H5 — Template slot system ✅ DONE
## PHASE H6 — Analytics visibility ✅ DONE
## PHASE H7 — Storage add-on ✅ DONE
## PHASE H8 — Render credits + prompt caching ✅ DONE

---

## AUDIT FINDINGS SUMMARY (2026-06-14)

### ✅ Analytics roundtrip — WORKING
- Buffer webhook → cron sync → post_analytics → performance_patterns → getBrandContext → generateCaption (fully wired)
- Template health scored every 6h by Inngest → shown in /insights
- Only gap: 24h analytics lag (acceptable — cron-based sync)

### ✅ Render pipeline — WORKING
- 9 templates all registered and compiling
- Single image, carousel, variants, clip-forge all wired
- Stories: upload-only (no auto-render — by design for MVP)

### ✅ Security — FIXED
- RLS: ai_usage_logs now enabled; sync_runs/analytics_sync_errors/research_runs correctly service-role-only
- CALENDAR_LINK_SECRET: hardcoded fallback removed
- MIME validation: upload-url now enforces allowlist
- Stripe webhook: constructEvent() verified ✅
- Cross-brand isolation: brand ownership checks confirmed ✅
- No secret key leakage confirmed ✅
- Rate limiting: still missing (low priority — plan limits provide soft ceiling)

### ✅ Brand identity — FIXED
- accent_color: now flows from DB → render routes → BrandVars → all 9 templates
- tagline, website_url, target_age_range, geographic_location: now in BrandContext + every caption prompt

---

## BACKLOG

- [ ] **Brand setup (PostFlow)** — user provides ToV files → create PostFlow brand → set colors, logo, tone
- [ ] **Post rendering audit** — render all 9 templates → screenshot for quality reference
- [ ] **Pre-edited video scheduling** — verify MP4 upload → Buffer handoff passes video file; gate Pro+
- [ ] Inngest jobs for `story`, `linkedin_post`, `tiktok_video` token keys (currently empty arrays)
- [ ] Analytics → token nudge path (`signalType: "analytics"` exists but nothing calls it)
- [ ] Rate limiting on expensive routes (optional pre-launch hardening)

---

## COMPLETED PHASES (archive)

- ✅ Phase G — V1 Remaining Spec Items (2026-05-12)
- ✅ Phase F — V6 Spec Build (2026-05-12)
- ✅ Phase B — Brand Intelligence Foundation (2026-05-10)
- ✅ Phase C — Upload Hub (2026-05-10)
- ✅ Phase D — Carousel Template Redesign (2026-05-10)
- ✅ Weeks 1–6 — Foundation through Billing + Tone Loop
