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
