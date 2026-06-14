# PostFlow — Page Hierarchy

Every route in the app, organised as a tree. Auth required column: **yes** = requires Supabase session; **no** = public; **admin** = restricted to hardcoded admin email.

Redirect-only pages are noted with →. API routes list HTTP method, auth, and purpose.

---

## App Pages (Authenticated — `src/app/(app)/`)

All pages under `(app)/` share `AppLayout`:
- Checks Supabase session → redirects to `/login` if missing
- Calls `getOrCreateAccount()` → ensures `postflow.accounts` row exists
- Checks `brands.length === 0` → redirects to `/onboarding` (except while on `/onboarding`)
- Renders Sidebar + TopBar with storage bell + brand switcher

```
(app)/
├── layout.tsx                    Auth: yes   AppLayout shell (sidebar + topbar)
│
├── dashboard/
│   └── page.tsx                  Auth: yes   Home dashboard — stats, action items,
│                                             upcoming week, setup checklist, weekly ideas
│                                             Calls: postflow.posts, content_calendar,
│                                                    template_health, media_uploads (direct DB)
│
├── onboarding/
│   ├── layout.tsx                Auth: yes   Bare layout (no sidebar) for wizard
│   └── page.tsx                  Auth: yes   10-step brand setup wizard
│       (OnboardingWizard.tsx)
│       Steps:
│         Step 1  — Business name + industry + doc import
│         Step 2  — Goals (ranked)
│         Step 3  — Identity (logo, colors, fonts)
│         Step 4  — Audience description
│         Step 5  — Voice examples
│         Step 6  — AI tone analysis (auto-runs)
│         Step 7  — Sample post validation
│         Step 8  — Connect social accounts
│         Step 9  — Posting frequency + AI tier
│         Step 10 — Final calibration
│       Calls: /api/onboarding/save, /api/ai/extract-from-document,
│              /api/ai/analyze-tone, /api/ai/sample-post,
│              /api/onboarding/calibrate, /api/onboarding/calibrate/confirm
│
│   └── steps/ (10 step components — no independent routes)
│         Step1Business.tsx … Step10Calibration.tsx
│
├── brand/
│   ├── page.tsx                  Auth: yes   Brand settings hub (tabbed)
│   │   Tabs: ?tab=brand (default) | ?tab=intelligence
│   │   ?tab=brand     → BrandEditor with sub-tabs:
│   │                    Identity | Audience | Voice | Goals | Templates | AI behaviour | Client sharing
│   │   ?tab=intelligence → BrandIntelligenceContent (token viewer + learning history)
│   │   Calls: /api/brands/[id], /api/brands/[id]/voice, /api/brands/[id]/voice/refresh,
│   │          /api/brands/[id]/templates, /api/templates/health/[id],
│   │          /api/templates/suggestions/[id], /api/portal/invite, /api/portal/invites
│   │
│   └── calibration/
│       └── page.tsx              Auth: yes   Standalone re-calibration page
│           Calls: /api/brand/calibrate
│
├── brands/
│   ├── page.tsx                  Auth: yes   Brand list (multi-brand users)
│   │                                         Links to /brand?tab=identity and /brand?tab=voice
│   │                                         Calls: postflow.brands (direct DB)
│   └── new/
│       └── page.tsx              Auth: yes   Add new brand wizard (AddBrandWizard)
│           (AddBrandWizard.tsx)              Calls: /api/brands (POST), /api/onboarding/save
│
├── brand-intelligence/
│   └── page.tsx                  Auth: yes   → Redirects to /brand?tab=intelligence
│
├── create/
│   └── page.tsx                  Auth: yes   Smart Video Builder (clip-forge) wizard — 5 steps
│       (CreateClient.tsx)
│       Steps:
│         Step 0 — Upload clips (ClipDropzone)
│         Step 1 — Goal + Platform selection
│         Step 2 — Music picker (after AI analysis)
│         Step 3 — Rendering progress bar
│         Step 4 — Preview + approve/reject + copy caption
│       Also shows tab bar: clip-forge | templates | stories (other tabs redirect)
│       Calls: /api/clip-forge/upload-url, /api/clip-forge/create,
│              /api/clip-forge/[id]/render, /api/clip-forge/[id] (poll),
│              /api/clip-forge/[id]/feedback
│
├── posts/
│   ├── page.tsx                  Auth: yes   → Redirects to /schedule?tab=posts
│   ├── new/
│   │   └── page.tsx              Auth: yes   Create new post — 2-step wizard
│   │       (PostCreator.tsx)                 Step 1: platform + template type
│   │                                         Step 2: topic + date + media attach
│   │                                         Calls: /api/posts (POST), /api/media
│   └── [id]/
│       └── page.tsx              Auth: yes   Post editor + AI caption generator
│           (PostEditor.tsx)
│           Features:
│             - Auto-generate caption on load (if no caption yet)
│             - Edit caption / hashtags / CTA
│             - Template picker (9 templates, type badges)
│             - Regenerate with feedback
│             - Media picker (library + Unsplash stock search)
│             - Image render (Puppeteer PNG)
│             - Carousel render (multi-slide PNG array)
│             - A/B template variant render
│             - Format convert (single ↔ carousel)
│             - Status progression (draft → planned → ready → scheduled)
│             - Schedule to Buffer (auto-publish or notification-publish)
│             - Delete post
│             - Language selector (BCP-47, affects caption language)
│             - Optimal schedule time suggestion
│             - Client approval status badge
│           Calls: /api/posts/generate, /api/posts/[id] (GET/PATCH/DELETE),
│                  /api/posts/[id]/render, /api/posts/[id]/render-carousel,
│                  /api/posts/[id]/render-variants, /api/posts/[id]/convert-format,
│                  /api/posts/[id]/feedback, /api/posts/[id]/slide-media,
│                  /api/buffer/schedule, /api/media, /api/media/stock-search,
│                  /api/media/stock-download, /api/brands/[id]/token
│
├── schedule/
│   └── page.tsx                  Auth: yes   Merged calendar + posts + upload page (tabbed)
│       Tabs: ?tab=calendar (default) | ?tab=posts | ?tab=upload
│       ?tab=calendar:
│         - Month grid (CalendarView.tsx)
│         - Brand filter chips (multi-brand users: ?brand=all | ?brand=[id])
│         - Per-entry actions: create post, regenerate, upload media, delete
│         - "Generate month" modal (GenerateCalendarModal.tsx)
│         Calls: /api/calendar/generate, /api/calendar/[id]/create-post,
│                /api/calendar/[id]/regenerate, /api/calendar/[id]/upload-media,
│                /api/calendar/[id] (PATCH/DELETE), /api/calendar/add
│       ?tab=posts:
│         - Posts list (all posts for active brand)
│         - Status badges (draft / ready / scheduled / posted / failed)
│         - Click → /posts/[id]
│         Calls: postflow.posts (direct DB)
│       ?tab=upload:
│         - UploadTabContent — MediaUploader + MediaGallery
│         Calls: /api/media/upload-url, /api/media (GET/POST),
│                /api/media/[id] (PATCH/DELETE), /api/media/confirm
│
├── calendar/
│   └── page.tsx                  Auth: yes   → Redirects to /schedule?tab=calendar
│
├── upload/
│   └── page.tsx                  Auth: yes   → Redirects to /schedule?tab=upload
│
├── insights/
│   └── page.tsx                  Auth: yes   Merged analytics + trend builder (tabbed)
│       Tabs: ?tab=analytics (default) | ?tab=trends
│       ?tab=analytics:
│         - Post performance table (impressions, reach, engagement_rate, likes, etc.)
│         - Platform breakdown
│         - Template health scores
│         - Optimal posting times
│         - SyncButton → POST /api/analytics/sync
│         Calls: postflow.posts + post_analytics + template_health (direct DB)
│       ?tab=trends:
│         - TrendClient (same 5-step wizard as /trend)
│         Calls: /api/trend/create, /api/trend/[id], /api/trend/[id]/pick,
│                /api/trend/[id]/render, /api/trend/[id]/nudge, /api/trend/[id]/feedback,
│                /api/clip-forge/upload-url
│
├── analytics/
│   └── page.tsx                  Auth: yes   → Redirects to /insights?tab=analytics
│
├── trend/
│   ├── page.tsx                  Auth: yes   Trend Builder page (standalone)
│   │   (TrendClient.tsx)                     Same 5-step wizard as /insights?tab=trends
│   │   Steps:
│   │     Step 0 — Upload clips
│   │     Step 1 — Platform pick
│   │     Step 2 — Concept cards (AI-generated, pick 1 of 3)
│   │     Step 3 — Rendering (parallel A/B Shotstack)
│   │     Step 4 — Preview (swipeable A vs B, pick, nudge, approve/reject)
│   └── TrendClient.tsx           (client component — no independent route)
│
├── inspiration/
│   └── page.tsx                  Auth: yes   Inspiration Library
│       (InspirationClient.tsx)               - Paste social post URL → AI analyses patterns
│                                             - Library of saved analyses (up to 50)
│                                             - "Apply to brand" → nudges brand tokens
│                                             Calls: /api/inspiration/analyse,
│                                                    /api/inspiration/apply,
│                                                    postflow.inspiration_posts (direct DB)
│
├── templates/
│   └── page.tsx                  Auth: yes   → Redirects to /create?tab=templates
│
├── stories/
│   └── page.tsx                  Auth: yes   → Redirects to /create?tab=stories
│
├── settings/
│   ├── page.tsx                  Auth: yes   General settings (account info)
│   │   (SettingsClient.tsx)                  - Name, email, timezone
│   │                                         - Buffer setup guide
│   │                                         Calls: /api/settings/account
│   ├── billing/
│   │   └── page.tsx              Auth: yes   Billing & plan management
│   │       Components:
│   │         BillingActions.tsx  — Stripe / Mollie checkout CTA buttons
│   │         StorageAddonSection.tsx — buy extra storage GB
│   │         RenderCreditSection.tsx — buy render credit packs
│   │       Shows: current plan, storage usage, pricing cards, invoice history
│   │       Calls: /api/billing/checkout, /api/billing/portal,
│   │              /api/billing/addon/storage, /api/billing/addon/render-credits,
│   │              postflow.accounts + subscriptions + invoices (direct DB)
│   └── connections/
│       └── page.tsx              Auth: yes   Social connections wizard
│           (ConnectionsClient.tsx)            Platforms: Buffer | Instagram | Facebook | LinkedIn | TikTok
│                                             Calls: /api/connections/list,
│                                                    /api/auth/buffer, /api/auth/instagram,
│                                                    /api/auth/facebook, /api/auth/linkedin,
│                                                    /api/auth/tiktok,
│                                                    /api/settings/social, /api/settings/social/[id]
│
└── admin/
    └── page.tsx                  Auth: admin  Internal admin dashboard (Stefan only)
        (AdminDashboard.tsx)                   Shows: analytics sync health, AI usage by brand/model/feature,
                                               brand token activity, niche trends, research runs
                                               Calls: postflow.sync_runs, research_runs, brand_token_events,
                                                      niche_trends, analytics_processed, ai_usage_logs,
                                                      brands (direct DB via service client)
```

---

## Auth Pages (`src/app/(auth)/`)

No sidebar. Minimal card layout.

```
(auth)/
├── layout.tsx                    Auth: no    Centered card layout for auth forms
├── login/
│   └── page.tsx                  Auth: no    Email/password login + Google OAuth
│                                             Calls: supabase.auth.signInWithPassword()
│                                                    supabase.auth.signInWithOAuth({ provider: "google" })
│                                             On success → /dashboard
└── signup/
    └── page.tsx                  Auth: no    New account registration
                                              Calls: supabase.auth.signUp()
                                              On success → /onboarding (via AppLayout redirect)
```

---

## Auth Callback

```
auth/
└── callback/
    └── route.ts                  Auth: no    Supabase auth code exchange
                                              GET /auth/callback?code=... → exchanges code for session
                                              → redirect to /dashboard
```

---

## Marketing Pages (`src/app/(marketing)/`)

```
(marketing)/
├── join/
│   └── page.tsx                  Auth: no    Public waitlist / early access landing
├── privacy/
│   └── page.tsx                  Auth: no    Privacy policy
└── terms/
    └── page.tsx                  Auth: no    Terms of service
```

---

## Client Portal (Public)

```
portal/
└── [token]/
    └── page.tsx                  Auth: no    Public client review portal
        (PortalView.tsx)                      - No login required
                                              - Resolves invite token → brand + scheduled posts
                                              - Expired token → error page
                                              - Client can: Approve | Flag each post
                                              Calls: postflow.portal_invites, brands, posts (via service client)
                                                     POST /api/portal/approve
```

---

## Root Page

```
app/
└── page.tsx                      Auth: no    Root landing (redirects to /login or /dashboard)
```

---

## API Routes (`src/app/api/`)

### Posts

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET/POST | `/api/posts` | yes | List posts for brand / create new post |
| GET/PATCH/DELETE | `/api/posts/[id]` | yes | Get, update, or delete a post |
| POST | `/api/posts/generate` | yes | Generate caption + hashtags + CTA via Claude |
| POST | `/api/posts/[id]/render` | yes | Render Puppeteer PNG for single-image template |
| POST | `/api/posts/[id]/render-carousel` | yes | Render all carousel slides as PNG array |
| POST | `/api/posts/[id]/render-variants` | yes | Render A/B template variants for comparison |
| POST | `/api/posts/[id]/convert-format` | yes | Convert post between single/carousel formats |
| POST | `/api/posts/[id]/feedback` | yes | Submit tone/quality feedback → nudges brand tokens |
| PATCH | `/api/posts/[id]/slide-media` | yes | Assign media to specific carousel slide |

### Calendar

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/calendar` | yes | List calendar entries for month/brand |
| POST | `/api/calendar/add` | yes | Manually add a single calendar entry |
| POST | `/api/calendar/generate` | yes | AI-generate a full month of calendar entries |
| GET/PATCH/DELETE | `/api/calendar/[id]` | yes | Get, update, or delete a calendar entry |
| POST | `/api/calendar/[id]/create-post` | yes | Create a post row from a calendar entry |
| POST | `/api/calendar/[id]/regenerate` | yes | AI-regenerate topic/brief for one entry |
| POST | `/api/calendar/[id]/upload-media` | yes | Attach uploaded media to a calendar entry |

### Brands

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET/POST | `/api/brands` | yes | List user's brands / create new brand |
| GET/PATCH/DELETE | `/api/brands/[id]` | yes | Get, update, or delete a brand |
| GET/PATCH | `/api/brands/[id]/voice` | yes | Get or update brand voice profile + custom rules |
| POST | `/api/brands/[id]/voice/refresh` | yes | AI re-synthesis of brand voice tokens |
| GET | `/api/brands/[id]/templates` | yes | Get template health scores for brand |
| GET | `/api/brands/[id]/token` | yes | Get brand intelligence token snapshot |
| POST | `/api/brands/active` | yes | Set active brand for session |

### AI Utilities

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/ai/analyze-tone` | yes | Analyse writing examples → extract tone profile |
| POST | `/api/ai/extract-from-document` | yes | Extract brand info from PDF/document |
| POST | `/api/ai/extract-brand-from-document` | yes | Deep brand extraction (logos, colors, voice) |
| POST | `/api/ai/extract-from-images` | yes | Extract info from uploaded images (Claude Vision) |
| POST | `/api/ai/sample-post` | yes | Generate sample post for onboarding Step 7 |

### Onboarding

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| PATCH | `/api/onboarding/save` | yes | Upsert brand data at each wizard step |
| POST | `/api/onboarding/calibrate` | yes | AI final calibration → synthesise brand tokens |
| POST | `/api/onboarding/calibrate/confirm` | yes | Mark calibration complete |
| POST | `/api/brand/calibrate` | yes | Re-calibration trigger (post-onboarding) |

### Media

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET/POST | `/api/media` | yes | List brand media / create media record |
| GET | `/api/media/upload-url` | yes | Get signed Supabase Storage upload URL |
| POST | `/api/media/confirm` | yes | Confirm upload completed, finalise record |
| GET/PATCH/DELETE | `/api/media/[id]` | yes | Get, update, or delete media item |
| GET | `/api/media/[id]/matches` | yes | Find calendar entries this media matches |
| GET | `/api/media/stock-search` | yes | Search Unsplash stock photos |
| POST | `/api/media/stock-download` | yes | Ping Unsplash download endpoint (TOS requirement) |

### Clip-Forge (Smart Video Builder)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/clip-forge/upload-url` | yes | Get signed upload URL for video clip |
| POST | `/api/clip-forge/create` | yes | Create job, analyse clips, select music |
| GET | `/api/clip-forge/[id]` | yes | Poll job status + render progress |
| POST | `/api/clip-forge/[id]/render` | yes | Start Shotstack render (checks + deducts credits) |
| POST | `/api/clip-forge/[id]/feedback` | yes | Approve/reject rendered video |

### Trend Builder (Trend-Forge)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/trend/create` | yes | Create trend job, analyse clips, generate 3 concepts |
| GET | `/api/trend/[id]` | yes | Poll trend job status |
| POST | `/api/trend/[id]/pick` | yes | Pick a concept or final version (A or B) |
| POST | `/api/trend/[id]/render` | yes | Trigger parallel A/B Shotstack renders |
| POST | `/api/trend/[id]/nudge` | yes | Submit tweak feedback before re-render |
| POST | `/api/trend/[id]/feedback` | yes | Approve/reject trend video |

### Buffer & Social

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/buffer/schedule` | yes | Push post to Buffer for scheduling |
| POST | `/api/buffer/webhook` | yes | Legacy Buffer webhook endpoint |
| GET | `/api/auth/buffer` | yes | Start Buffer OAuth flow |
| GET | `/api/auth/buffer/callback` | no | Buffer OAuth callback → store token |
| GET | `/api/auth/instagram` | yes | Start Instagram/Meta OAuth flow |
| GET | `/api/auth/instagram/callback` | no | Instagram OAuth callback |
| GET | `/api/auth/instagram/debug` | yes | Instagram connection diagnostics |
| GET | `/api/auth/facebook` | yes | Start Facebook OAuth flow |
| GET | `/api/auth/facebook/callback` | no | Facebook OAuth callback |
| GET | `/api/auth/linkedin` | yes | Start LinkedIn OAuth flow |
| GET | `/api/auth/linkedin/callback` | no | LinkedIn OAuth callback |
| GET | `/api/auth/tiktok` | yes | Start TikTok OAuth flow |
| GET | `/api/auth/tiktok/callback` | no | TikTok OAuth callback |
| GET | `/api/connections/list` | yes | List all connected social accounts |

### Analytics

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST/GET | `/api/analytics/sync` | yes/cron | Sync Buffer analytics → post_analytics + nudge tokens |

### Billing

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/billing/checkout` | yes | Create Stripe or Mollie checkout session |
| POST | `/api/billing/portal` | yes | Create Stripe customer portal session URL |
| POST | `/api/billing/addon/storage` | yes | Purchase extra storage GB (Stripe one-time) |
| POST | `/api/billing/addon/render-credits` | yes | Purchase render credit pack (Stripe one-time) |

### Settings

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET/PATCH | `/api/settings/account` | yes | Get or update account name/email/timezone |
| GET/PATCH | `/api/settings/buffer` | yes | Get or update Buffer access token |
| GET/POST | `/api/settings/social` | yes | List or add social account |
| DELETE | `/api/settings/social/[id]` | yes | Disconnect a social account |

### Webhooks (Inbound — no user auth, HMAC-verified)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/webhooks/stripe` | hmac | Handle Stripe events (subscription updates, invoices) |
| POST | `/api/webhooks/mollie` | hmac | Handle Mollie payment events |
| POST | `/api/webhooks/buffer` | hmac | Handle Buffer post-sent events → update post status |
| POST | `/api/webhooks/meta` | hmac | Handle Meta/Instagram webhook events |

### Templates

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/templates/health/[id]` | yes | Get template health detail for one template |
| GET | `/api/templates/suggestions/[id]` | yes | AI suggestions for underperforming template |

### Client Portal

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/portal/invite` | yes | Send portal invite link (creates portal_invites row) |
| GET | `/api/portal/invites` | yes | List active portal invites for brand |
| POST | `/api/portal/approve` | no | Client approves or flags a post (token-authenticated) |

### Inspiration

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/inspiration/analyse` | yes | Analyse external post URL → extract patterns |
| POST | `/api/inspiration/apply` | yes | Apply inspiration signals → nudge brand tokens |

### Stories

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/stories/create` | yes | Create story (vertical video/image post) |
| GET | `/api/stories/upload-url` | yes | Get signed upload URL for story media |

### Dashboard

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/dashboard/weekly-ideas` | yes | AI-generate 5 weekly content ideas for brand |

### Render Queue

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/render/queue` | yes | Queue a render job (generic, used by Inngest) |

### Inngest

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET/POST/PUT | `/api/inngest` | inngest | Inngest event handler endpoint |
|              |                |         | Functions: clip-forge/render, trend/render, analytics/process-post-signals |

### Admin

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/admin/diagnostics` | admin | System health diagnostics for admin |

---

## Key Redirects Summary

| From | To |
|------|----|
| `/` | `/login` or `/dashboard` |
| `/calendar` | `/schedule?tab=calendar` |
| `/upload` | `/schedule?tab=upload` |
| `/analytics` | `/insights?tab=analytics` |
| `/brand-intelligence` | `/brand?tab=intelligence` |
| `/templates` | `/create?tab=templates` |
| `/stories` | `/create?tab=stories` |
| `/posts` | `/schedule?tab=posts` |
| No brands found (app layout) | `/onboarding` |
| Not logged in (app layout) | `/login` |
| Admin page (non-admin user) | `/dashboard` |
| `/brands` with 0 brands | `/onboarding` |
