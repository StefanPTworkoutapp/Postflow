# PostFlow — User Flow Graph

All key user journeys in the app. Each flow shows trigger → steps → outcome → next destination.

---

## 1. Onboarding (New User Signup)

**Trigger:** User visits `/signup` or navigates to `/login` → `/dashboard` with no brand yet → redirect to `/onboarding`

```
[Signup / Login]
      │
      ▼
[/auth/callback] ← Supabase OAuth / email confirm
      │
      ▼
[getOrCreateAccount()] ─── account row created in postflow.accounts
      │
      ├─ brands.length === 0 → redirect to /onboarding
      │
      ▼
[/onboarding — 10-step wizard]

  Step 1 · Business
    └── Name, industry, document import (optional)
        POST /api/ai/extract-from-document (if PDF uploaded)
        POST /api/ai/extract-brand-from-document (if brand doc)
        POST /api/onboarding/save → creates brands row

  Step 2 · Goals
    └── Ranked goal picker (grow followers, educate, convert, etc.)
        PATCH /api/onboarding/save

  Step 3 · Identity (skippable from here)
    └── Logo, colors (primary / secondary / accent), fonts
        PATCH /api/onboarding/save

  Step 4 · Audience
    └── Target audience description, geographic location
        PATCH /api/onboarding/save

  Step 5 · Voice
    └── Writing style examples, voice traits
        PATCH /api/onboarding/save

  Step 6 · Analysis (auto-runs)
    └── POST /api/ai/analyze-tone → reads examples → sets brand voice tokens

  Step 7 · Sample Post (validation)
    └── POST /api/ai/sample-post → generates example caption
        User approves or regenerates

  Step 8 · Socials
    └── Connect Buffer + social platforms
        Redirects to /api/auth/buffer, /api/auth/instagram, etc.

  Step 9 · Frequency
    └── Pick posting frequency (weekly / monthly) + AI tier (standard / economy)
        PATCH /api/onboarding/save

  Step 10 · Calibration
    └── POST /api/onboarding/calibrate → AI synthesises brand tokens
        POST /api/onboarding/calibrate/confirm → marks calibration_status = "done"
              │
              ▼
        router.push("/dashboard") → clearSavedState()

  [Skip option — steps 3–9]
    └── PATCH /api/onboarding/save { onboarding_skipped: true }
        → router.push("/create")
        → /create shows OnboardingSkippedBanner
```

**Outcome:** Brand created, voice tokens set, user lands on `/dashboard`

---

## 2. Create a Post (Manual)

**Trigger:** Dashboard "New post" button or `/posts/new`

```
[/posts/new — PostCreator — 2 steps]

  Step 1 · Template + Platform
    ├── Select platform (Instagram / LinkedIn / Facebook / TikTok / Threads / X)
    └── Select post type (filtered by platform)
        Templates: photo-overlay | edu-bold | quote-card | dark-statement |
                   tip-numbered | carousel-edu | carousel-myth | reel-cover | story-teaser

  Step 2 · Brief
    ├── Topic text area (required)
    ├── Schedule date (optional, defaults to today)
    └── Attach media from library (MediaPicker, optional)
        POST /api/media → pick from postflow.media_uploads
              │
              ▼
    "Create post →" → POST /api/posts
    Body: { platform, template_id, topic, scheduled_date, media_ids }
    Response: { post: { id } }
              │
              ▼
    router.push(/posts/[id])

[/posts/[id] — PostEditor]

  Auto-generation (on mount, if no caption yet)
    └── POST /api/posts/generate
        Body: { template_id, platform, topic, target_language }
        → Claude generates caption + hashtags + CTA
        → Sets caption / hashtags / CTA in editor state

  User actions in editor:
    ├── Edit caption / hashtags / CTA directly
    ├── Pick / swap template (template picker panel)
    │     └── ALL_TEMPLATES list (single_image / carousel / reel_cover / story)
    ├── Regenerate caption
    │     └── POST /api/posts/generate { topic, platform, previous_feedback }
    ├── Submit feedback
    │     └── POST /api/posts/[id]/feedback
    │           → triggers learning loop (nudges brand tokens)
    ├── Pick media (MediaPicker — library or stock search)
    │     └── GET /api/media/stock-search?q=...
    │         POST /api/media/stock-download (Unsplash TOS ping)
    │         PATCH /api/posts/[id] to store generated_image_url
    ├── Render image (Puppeteer → PNG)
    │     └── POST /api/posts/[id]/render
    │           → Returns generated_image_url
    ├── Render carousel
    │     └── POST /api/posts/[id]/render-carousel
    │           → Returns carousel_image_urls[]
    ├── Render template variants (A/B preview)
    │     └── POST /api/posts/[id]/render-variants
    ├── Convert format (e.g. single → carousel)
    │     └── POST /api/posts/[id]/convert-format
    ├── Save (PATCH /api/posts/[id])
    │     Status progression: draft → planned → ready → scheduled
    └── Schedule (send to Buffer)
          └── PATCH /api/posts/[id] { status: "scheduled" }
              POST /api/buffer/schedule { post_id }
              → Buffer queues post at scheduled_date/time
              → If Instagram/Facebook: "notification publish" required in Buffer mobile app
              → Outcome: scheduleMsg shown, status = "scheduled"
```

**Outcome:** Post saved and optionally scheduled to Buffer. User stays on `/posts/[id]`.

---

## 3. Create a Post (Calendar AI)

**Trigger:** `/schedule?tab=calendar` → "Generate month" button in CalendarView → GenerateCalendarModal

```
[/schedule?tab=calendar — CalendarView]

  User clicks "Generate month"
  └── GenerateCalendarModal opens

  Modal inputs:
    ├── Target month (year / month picker)
    ├── Platforms (multi-select)
    ├── Content pillars (multi-select, from brand goals)
    └── Frequency overrides (per-platform posts/week)

  "Generate" →
  POST /api/calendar/generate
  Body: { year, month, platforms, pillars, frequencyOverrides, shootingFrequency }
  → Claude (Haiku/Sonnet based on brand ai_tier) generates 15–60 CalendarSuggestion items
  → Each suggestion: { date, platform, topic, content_pillar, goal, post_type,
                        required_media_type, media_brief, template_slug, slide_content }
  → Upserts into postflow.content_calendar
  Response: { entries: CalendarSuggestion[] }
              │
              ▼
  CalendarView re-renders — entries shown as coloured chips on calendar grid

  Per-entry actions (click chip):
    ├── View / edit topic, date, platform
    ├── Regenerate this entry
    │     └── POST /api/calendar/[id]/regenerate
    ├── Upload media for entry
    │     └── POST /api/calendar/[id]/upload-media
    ├── Create post from entry
    │     └── POST /api/calendar/[id]/create-post
    │           → Creates posts row linked to calendar entry
    │           → Returns { post_id }
    │           → router.push(/posts/[post_id])
    └── Delete entry
          └── DELETE /api/calendar/[id]

  Also:
    POST /api/calendar/add  → manually add single entry
    PATCH /api/calendar/[id] → update topic / date / status
```

**Outcome:** Calendar filled with AI-planned posts for the month. Each entry links to a post for editing and scheduling.

---

## 4. Clip-Forge (Smart Video Builder)

**Trigger:** Sidebar → "Create" or `/create` (tab: clip-forge, which is the default)

```
[/create — CreateClient — 5 steps]

  Step 0 · Upload clips
    └── ClipDropzone: drag-and-drop video files
        For each clip:
          GET /api/clip-forge/upload-url → signed Supabase Storage URL
          PUT <signed_url> (direct S3 upload)
        Result: clips[] with { path, duration, frameDataUri }

  Step 1 · Goal + Platform
    ├── Goal: grow_followers | educate | showcase | entertain | drive_sales | build_community
    └── Platform: Instagram | TikTok | LinkedIn | Facebook | YouTube

  "Analyse clips →"
  POST /api/clip-forge/create
  Body: { goal, platform, clips[], hookText?, ctaText? }
  Flow inside route:
    1. Creates clip_forge_jobs row (status = 'analysing')
    2. Creates clip_forge_clips rows
    3. Generates signed read URLs for each clip
    4. Analyses each clip frame in parallel via Claude Vision
    5. Sorts clips by best_order score
    6. Selects 3 music track options from brand tokens (selectMusicTracks)
    7. Updates job status → 'pending_music'
  Response: { jobId, musicTracks[], sortedClips[], caption, hashtags }
              │
              ▼
  Step 2 · Music pick (MusicPicker)
    └── User picks one of 3 music tracks (or "no music")
        selectedMusic = track.full_url | null

  "Build my video →"
  POST /api/clip-forge/[id]/render
  Body: { musicUrl?, musicTitle? }
  Flow inside route:
    1. Checks render credit balance (getRenderCreditBalance)
    2. If no credits → returns 402 + { creditsRequired: true }
       ↳ User buys credits: POST /api/billing/addon/render-credits
    3. Dispatches Inngest event "clip-forge/render" via /api/inngest
    4. Inngest function: assembles clips → Shotstack → render job
    5. Updates clip_forge_jobs.status → 'rendering'
  Response: { jobId, status: 'rendering' }
              │
              ▼
  Step 3 · Building (progress bar)
    └── Polls GET /api/clip-forge/[id] every 3s
        { status, renderProgress, outputVideoUrl, outputCaption, outputHashtags }
        Until status === 'done' or 'error'
              │
              ▼
  Step 4 · Preview
    ├── Video player (outputVideoUrl)
    ├── Caption + hashtags display
    ├── Copy caption button
    ├── Approve (feedback "approve" → POST /api/clip-forge/[id]/feedback)
    └── Reject (feedback "reject" → POST /api/clip-forge/[id]/feedback)
        Both update clip_forge_jobs.client_approval
```

**Outcome:** Rendered video available for download or manual upload to social platforms. Caption ready to copy.

---

## 5. Trend Builder (Trend-Forge)

**Trigger:** `/insights?tab=trends` or `/trend`

```
[/insights?tab=trends — TrendClient — 5 steps]

  Step 0 · Upload clips
    └── Same ClipDropzone as clip-forge

  Step 1 · Pick platform
    └── Instagram | TikTok | LinkedIn | Facebook

  POST /api/trend/create
  Body: { clips[], platform }
  Flow:
    1. Creates trend_jobs row
    2. Analyses clips with Claude Vision
    3. Fetches niche_trends for brand (weekly signals)
    4. Filters + generates 3 TrendConcepts (concept_title, hook, caption, hashtags, music_cue)
  Response: { jobId, concepts: TrendConcept[] }
              │
              ▼
  Step 2 · Concepts
    └── 3 ConceptCards shown — user picks one
        POST /api/trend/[id]/pick { conceptIndex }

  "Build versions →"
  → Triggers parallel A/B Shotstack renders
    POST /api/trend/[id]/render (Inngest dispatch)
              │
              ▼
  Step 3 · Rendering (RenderStatusBar)
    └── Polls GET /api/trend/[id] every 3s
        { status, renderProgress, versionAUrl, versionBUrl }
              │
              ▼
  Step 4 · Preview (swipeable A vs B)
    ├── View Version A / Version B side-by-side
    ├── Pick version → POST /api/trend/[id]/pick { version: "A" | "B" }
    ├── Nudge (tweak): POST /api/trend/[id]/nudge { feedback }
    ├── Approve → POST /api/trend/[id]/feedback { signal: "approve" }
    └── Reject  → POST /api/trend/[id]/feedback { signal: "reject" }
```

**Outcome:** A/B video ready; chosen version available to download. Both approval signals feed back into brand tokens.

---

## 6. Publish via Buffer

**Trigger:** User clicks "Schedule →" in PostEditor

```
[PostEditor — handleSchedule()]

  1. PATCH /api/posts/[id] { status: "scheduled", ... }
     → post.status = "scheduled" in DB

  2. POST /api/buffer/schedule { post_id }
     → Reads post + brand social_accounts (buffer_profile_id)
     → Calls Buffer v1 API: POST /1/updates/create
     Body: { text: caption+hashtags, profile_ids[], scheduled_at, media: [image_url] }
     Response: { update: { id } }
     → Updates post.buffer_post_id

  3a. Auto-publish platforms (LinkedIn, X, TikTok)
       → scheduleMsg: "Sent to Buffer! Will auto-publish at scheduled time."

  3b. Notification-publish platforms (Instagram, Facebook)
       → notifyPublish = true → banner shown:
          "Buffer will push a notification to your phone at scheduled time."

  [Later — at scheduled_at time]
  Buffer publishes → fires webhook:

  POST /api/webhooks/buffer (or /api/buffer/webhook)
  Event: sent_update:success
    → Finds post by buffer_post_id
    → PATCH posts: status = "posted", posted_at = sent_at
    → PATCH content_calendar: status = "posted"

  Event: sent_update:failed
    → PATCH posts: status = "failed"
```

**Outcome:** Post is live on the social platform. Dashboard "Posted this month" counter increments.

---

## 7. Brand Management

**Trigger:** Sidebar brand switcher or `/brand`

### 7a. Switch active brand

```
[TopBar / BrandSwitcher]
  └── User clicks different brand chip
      POST /api/brands/active { brand_id }
      → Updates brands.is_active / session active brand
      → Page refreshes with new brand context
```

### 7b. Edit brand identity / voice / templates

```
[/brand?tab=brand — BrandEditor]

  Tabs: Identity | Audience | Voice | Goals | Templates | AI behaviour | Client sharing

  Identity tab:
    ├── Name, industry, tagline, website, logo upload
    │     Logo: GET /api/media/upload-url → direct S3 PUT → PATCH /api/brands/[id]
    └── Colors, fonts
          PATCH /api/brands/[id]

  Voice tab:
    ├── View current tone profile (tone_level, personality_traits, do_use, do_not_use)
    │     GET /api/brands/[id]/voice
    ├── Edit custom always-do / never-do rules
    │     PATCH /api/brands/[id]/voice
    ├── Refresh voice (AI re-synthesis)
    │     POST /api/brands/[id]/voice/refresh
    │       → Claude re-analyses voice examples + custom rules
    │       → Updates brand_intelligence_tokens
    └── Voice history (last 20 token events from brand_token_events)

  Templates tab:
    ├── View template health scores (from template_health table)
    │     GET /api/brands/[id]/templates
    ├── Get AI suggestions for underperforming templates
    │     GET /api/templates/suggestions/[id]
    └── View template health detail
          GET /api/templates/health/[id]

  Goals tab:
    └── Ranked goal picker → PATCH /api/brands/[id]

  AI behaviour tab:
    └── AI tier (standard / economy), style volatility → PATCH /api/brands/[id]

  Client sharing tab:
    ├── Send portal invite → POST /api/portal/invite { email, brand_id }
    ├── View active invites → GET /api/portal/invites
    └── Approve portal feedback → POST /api/portal/approve

[/brand?tab=intelligence — BrandIntelligenceContent]
  ↳ Redirect from /brand-intelligence
  └── Shows live brand token state, learning history, calibration status
```

### 7c. Brand calibration (periodic)

```
[Dashboard — calibrationDue banner]
  └── "Re-calibrate" → /onboarding → runs all 10 steps again

[/brand/calibration]
  └── POST /api/brand/calibrate → AI re-synthesises all brand tokens
      → calibration_status = "done"
```

**Outcome:** Brand identity, voice tokens, and template preferences updated. All future AI generation uses the new context.

---

## 8. Analytics Feedback Loop

**Trigger:** Post is published (via Buffer webhook) or manual sync

```
[Post published → Buffer webhook fires]
  POST /api/webhooks/buffer (sent_update:success)
  → post.status = "posted", posted_at recorded

  [Cron / manual — GET /api/analytics/sync]
    1. Finds all brands with connected Buffer accounts
    2. For each brand: fetches recent sent posts via Buffer GraphQL API
    3. Upserts analytics into post_analytics:
       { impressions, reach, likes, comments, shares, saves, engagement_rate }
    4. For each post with engagement data:
       ├── High engagement → nudgeToken("high_engagement", token_key, delta)
       ├── Best time data  → nudgeToken("best_time", ...)
       └── Template performance → updates template_health (health_score, trend)

  [On Insights page — /insights?tab=analytics]
    ├── SyncButton → POST /api/analytics/sync (manual trigger)
    └── Displays post_analytics rows with engagement charts

  [Brand intelligence loop]
    Inngest function: "analytics/process-post-signals"
      → Reads post_analytics for brand's recent posts
      → Feeds signals into nudgeToken() for:
           caption_tone, posting_time, content_pillar_performance
      → Updates brand_intelligence_tokens (intelligence_tokens JSONB column)
      → Logs to brand_token_events (token_key, signal_type, delta, old/new value)
      → calibration_status may be set to "due" if health drops significantly

  [Next post generation — POST /api/posts/generate]
    └── getBrandContext() reads intelligence_tokens
        → injects updated tone_level, personality_traits, do_use, do_not_use
        → Claude generates caption using evolved voice
```

**Outcome:** Brand voice tokens automatically drift toward what performs best. Template health scores update weekly.

---

## 9. Billing Upgrade

**Trigger:** `/settings/billing` → user clicks plan card CTA

```
[/settings/billing — BillingPage]

  Shows: current plan | storage usage | pricing cards | invoice history

  CTA: "Upgrade to Starter / Pro / Business"
  POST /api/billing/checkout { tier, interval, provider: "stripe" | "mollie" }

  Stripe flow:
    → createStripeCheckoutSession()
    → Response: { url } → browser redirect to Stripe hosted checkout
    → User completes payment on Stripe
    → Stripe redirects to /settings/billing?success=1
    → Stripe fires webhook: POST /api/webhooks/stripe
        Events handled:
          checkout.session.completed  → create/update subscriptions row, tier upgraded
          customer.subscription.updated → tier change / renewal
          customer.subscription.deleted → tier → "free"
          invoice.payment_succeeded    → upsert invoices row
          invoice.payment_failed       → status → "past_due"
          customer.subscription.trial_will_end → notification (email TBD)

  Mollie flow (Dutch customers):
    → createMollieCheckoutUrl()
    → Response: { url } → browser redirect to Mollie
    → POST /api/webhooks/mollie on payment event
        → same DB updates as Stripe

  Stripe portal (existing subscribers):
    → POST /api/billing/portal → Stripe Customer Portal session URL
    → Manage payment method, cancel, change plan

  Outcome: accounts.subscription_tier updated, getLimits() returns new caps
```

**Outcome:** Tier upgraded, new feature limits unlocked immediately (limits read from `getLimits(tier)` on every request).

---

## 10. Storage Add-On

**Trigger:** TopBar bell notification (storagePercent >= 90) or `/settings/billing` warning banner

```
[TopBar — bell icon]
  storagePercent >= 90 → orange bell badge
  Tooltip: "You're using X% of your Y GB storage. Add more or upgrade."
  Click → /settings/billing#storage

[/settings/billing — StorageAddonSection (paid plans only)]
  Shows: current addon GB, price per GB, selector
  └── "Add 10 GB" / "Add 50 GB" / "Add 100 GB"
      POST /api/billing/addon/storage { addOnGb }
      → Creates Stripe one-time payment intent (priceId for storage addon)
      → Response: { url } → Stripe checkout
      → On success: webhook updates subscriptions.storage_addon_gb += addOnGb
      → storageLimitGb increases immediately in AppLayout check
      → Bell badge clears once storagePercent drops below 90
```

**Outcome:** Storage limit raised. User can upload more media.

---

## 11. Render Credits

**Trigger:** Clip-forge render → route returns `{ creditsRequired: true }`

```
[CreateClient — Step 3 "Build video"]
  POST /api/clip-forge/[id]/render
  → getRenderCreditBalance(user.id) → 0 credits
  → Response 402: { error: "Insufficient render credits", creditsRequired: true }
  → Client shows credit purchase prompt

[/settings/billing — RenderCreditSection]
  Shows: current balance (render_credits table)
  └── "Buy 5 / 10 / 20 renders"
      POST /api/billing/addon/render-credits { pack: "5" | "10" | "20" }
      → Stripe one-time checkout
      → Webhook: stripe checkout.session.completed
          → Upserts render_credits row: credits_remaining += pack
      → Response: { url } → Stripe checkout
      → On success: credit balance updated in DB

[Next render attempt]
  → getRenderCreditBalance() > 0
  → Render proceeds
  → POST /api/clip-forge/[id]/render deducts 1 credit
```

**Outcome:** Credits added, render completes, balance decremented by 1 per render.

---

## 12. Inspiration Library

**Trigger:** Sidebar → Inspiration or `/inspiration`

```
[/inspiration — InspirationClient]

  Paste a social media URL (Instagram, TikTok, LinkedIn post URL)
  POST /api/inspiration/analyse { url, platform }
  → Scrapes/parses post (or user provides text manually)
  → Claude analyses: hook, tone, structure, observed_patterns
  → Saves to inspiration_posts table
  → Returns { id, explanation, observed_patterns, signals[] }

  Library shows saved analyses (up to 50)

  "Apply to brand" →
  POST /api/inspiration/apply { inspiration_id }
  → Reads analysis.signals
  → Calls nudgeToken() for each signal
  → Updates brand_intelligence_tokens
  → Sets inspiration_posts.applied = true
```

**Outcome:** Brand voice tokens updated with patterns from high-performing external posts.

---

## 13. Client Portal

**Trigger:** Brand editor (sharing tab) → "Invite client" → client receives email with link

```
[BrandEditor — Client sharing tab]
  POST /api/portal/invite { email, brand_id, expires_in_days? }
  → Creates portal_invites row with unique token + expiry
  → (Email delivery: external; link contains token)

[Client opens link: /portal/[token]]
  → No auth required (public page)
  → Resolves token → brand_id → scheduled posts (next 60 days)
  → PortalView shows posts with caption + image previews
  → Client can: Approve | Flag each post
      POST /api/portal/approve { post_id, status: "approved" | "flagged", note? }
      → Updates posts.client_approval_status + client_reviewed_at

[Brand owner sees feedback in PostEditor]
  └── client_approval_status badge shown on post
```

**Outcome:** Client reviews upcoming content without needing a PostFlow account.

---

## 14. Connections Setup

**Trigger:** Onboarding Step 8 or `/settings/connections`

```
[/settings/connections — ConnectionsClient]

  Wizard steps: Buffer → Instagram → Facebook → LinkedIn → TikTok

  Buffer OAuth:
    GET /api/auth/buffer → redirects to Buffer OAuth
    GET /api/auth/buffer/callback → exchanges code → stores access_token in social_accounts

  Instagram OAuth:
    GET /api/auth/instagram → Facebook OAuth (Instagram is Meta)
    GET /api/auth/instagram/callback → exchanges code → stores token
    GET /api/auth/instagram/debug → diagnostic info

  Facebook OAuth:
    GET /api/auth/facebook → Facebook OAuth
    GET /api/auth/facebook/callback

  LinkedIn OAuth:
    GET /api/auth/linkedin → LinkedIn OAuth
    GET /api/auth/linkedin/callback

  TikTok OAuth:
    GET /api/auth/tiktok → TikTok OAuth
    GET /api/auth/tiktok/callback

  View all connected accounts:
    GET /api/connections/list
    → Returns social_accounts[] with buffer_profile_id, handle, expiry

  Disconnect:
    DELETE /api/settings/social/[id]

  Meta webhook (for post status from Meta directly):
    POST /api/webhooks/meta
```

**Outcome:** Social accounts linked. Buffer scheduling and analytics sync enabled.
