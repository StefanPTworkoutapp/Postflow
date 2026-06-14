# PostFlow — Lessons Log

Record mistakes, corrections, and non-obvious patterns here. The goal is to
prevent the same mistake from recurring across sessions. Each lesson should
include the pattern to apply going forward, not just the one-off fix.

---

## Format

```
## [YYYY-MM-DD] Short title

**What happened:** Brief description of the mistake or correction.
**Root cause:** Why it happened.
**Rule going forward:** The pattern to apply to prevent recurrence.
```

---

## [2026-05-04] Next.js 16 renamed middleware.ts → proxy.ts

**What happened:** Created `src/middleware.ts` following Next.js 13/14/15 conventions. Next.js 16 deprecated `middleware` in favour of `proxy`. The dev server logged a deprecation warning pointing to the proxy docs.

**Root cause:** Training data and @supabase/ssr docs reference `middleware.ts`. Next.js 16 is newer than most documentation.

**Rule going forward:** Always read `node_modules/next/dist/docs/` before writing any convention-based files (middleware, layouts, route handlers). In Next.js 16: `src/proxy.ts`, exported function named `proxy`. API is otherwise identical — same `NextRequest`, `NextResponse`, `config.matcher`.

---

## [2026-05-05] Supabase .single() throws on 0 rows — use .maybeSingle()

**What happened:** API route used `.single()` on a query that could return 0 rows (post not yet created). Supabase throws "JSON object requested, multiple (or no) rows returned" which surfaced as a 500 "Cannot coerce result to single JSON object".

**Root cause:** `.single()` asserts exactly 1 row. `.maybeSingle()` returns null when 0 rows.

**Rule going forward:** Use `.maybeSingle()` for any lookup where the record might not exist. Only use `.single()` after an `.insert().select()` where exactly one row is guaranteed.

---

## [2026-05-05] AI prompt values must exactly match DB CHECK constraints

**What happened:** Calendar generate route told Claude to use `goal: "reach"` and `post_type: "text"` — both values not in the DB CHECK constraints (`('engagement','conversion','brand_awareness','lead_generation')` and `('carousel','single_image','reel','story','text_only')`). Inserts silently failed or threw constraint errors.

**Root cause:** The prompt was written independently from the schema.

**Rule going forward:** Before writing any Claude prompt that produces values going into a DB column with a CHECK constraint, copy the exact allowed values from the migration file into the prompt. Always cross-check AI output fields against the schema.

---

## [2026-05-05] Next.js 16 dynamic route params are Promises — must be awaited

**What happened:** API route destructured `{ params }` directly without awaiting. Next.js 16 wraps dynamic params in a Promise; accessing `params.id` without `await params` returns undefined.

**Root cause:** Next.js 14/15 params were synchronous objects. Next.js 16 changed this.

**Rule going forward:** All route handlers with dynamic segments must use `const { id } = await params`. Same applies to page components: `const { id } = await params` in `async` server components.

---

## [2026-05-05] Buffer GraphQL requires organizationId for every operation

**What happened:** Querying `channels` without `organizationId` returned "Field 'channels' argument 'input' required". Creating posts without it failed similarly.

**Root cause:** Buffer's new public GraphQL API (as opposed to the old REST API) requires organization context for all workspace-scoped operations.

**Rule going forward:** Always call `getOrganizationId(accessToken)` first, then use the result in subsequent `channels(input: { organizationId })` and `createPost(input: { organizationId, ... })` calls. Cache the org ID within a single request to avoid double round-trips.

---

## [2026-05-05] Puppeteer: never use waitUntil: "networkidle0" with external font links

**What happened:** Branded card renderer timed out (8s) because the HTML template had a Google Fonts `<link>` tag. `networkidle0` waits for all network activity to stop — external font requests never resolve in a Puppeteer sandbox.

**Root cause:** Template included Google Fonts CDN link. `networkidle0` is too strict.

**Rule going forward:** 
1. Never use Google Fonts or any external CDN in Puppeteer-rendered HTML. Use system font stacks only.
2. Always use `waitUntil: "domcontentloaded"` for Puppeteer page loads.
3. Set timeout to 30000ms (not 8000ms).

---

## [2026-05-06] Supabase generated types lag migrations until regenerated

**What happened:** Added `media_urls TEXT[]` column to `content_calendar` via migration. TypeScript immediately errored because generated types don't know about the new column — Supabase reports a `SelectQueryError<"column 'media_urls' does not exist">` at type level.

**Root cause:** `src/types/database.types.ts` is generated from the schema at a point in time. Until `supabase gen types typescript --local` is re-run after applying the migration, all references to new columns fail type-checking.

**Rule going forward:** 
1. When adding a column via migration (before it's applied + types regenerated), cast the affected query to `as any` with a comment: `// cast until types regenerated after migration`.
2. After the migration is applied: run `supabase gen types typescript --local > src/types/database.types.ts` immediately and remove the casts.
3. Never hand-edit `database.types.ts` — always regenerate.

---

## [2026-05-06] Calendar entry and post are separate — calendar_entry_id is NOT NULL

**What happened:** Attempted to create a post via `/posts/new` without linking it to a calendar entry. The insert failed because `calendar_entry_id UUID NOT NULL` on the posts table.

**Root cause:** The schema enforces the planning → content separation at DB level. Every post must belong to a calendar entry, even standalone "new post" flows.

**Rule going forward:** There are two creation paths, both go through a calendar entry:
1. Calendar-first: click calendar entry → `POST /api/calendar/[id]/create-post` → navigate to PostEditor.
2. Direct new post: `POST /api/posts` auto-creates a calendar entry first, then the post.
Never insert into `posts` without a valid `calendar_entry_id`.

---

## [2026-05-06] revalidatePath is required after server-side mutations in Next.js 16

**What happened:** After saving Buffer token + syncing channels, the Settings page still showed "not connected" on refresh. The data was saved correctly in DB but the server component rendered stale cached data.

**Root cause:** Next.js App Router caches server component renders. Mutations via API routes don't automatically bust the cache.

**Rule going forward:** After any API route that mutates data consumed by a server component, call `revalidatePath("/the-page")` from `next/cache` before returning the response. For settings: `revalidatePath("/settings")`. For posts: `revalidatePath("/posts")` etc.

---

## [2026-05-07] Update planning docs when product decisions are made in conversation

**What happened:** Several product decisions (carousel = in-app assembly, media type system, reel assembly as V2, weekly trend email) existed only in conversation output. They were not recorded in `tasks/decisions.md`, `memory/features_mvp.md`, or `memory/implementation_plan.md` until the user explicitly asked.

**Root cause:** Implementation work was happening faster than documentation was being updated.

**Rule going forward:** After any session where a product decision is made (not just a technical one), immediately update:
- `tasks/decisions.md` — the decision + alternatives + reason + impact
- `memory/features_mvp.md` — the feature spec change
- `memory/implementation_plan.md` — the week/phase it affects
Do this before moving to the next implementation task, not at the end of the session.

---

## [2026-05-09] Carousel slide content should be AI-generated at calendar creation time

**What happened:** Built CarouselBuilder with empty fields for manual input. User correctly identified that ALL content fields should be pre-filled by AI — users only add media.
**Root cause:** Built UI before considering the full data flow from calendar generation through to PostEditor.
**Rule going forward:** For any structured content feature (carousel slides, story frames, etc.), design the AI generation step first, then build the UI to display + edit what AI produced. Never build empty input forms for content AI can generate.

---

## [2026-05-09] Follow the PostEditor UX pattern for all new content features

**What happened:** New features risk breaking the clean "post + preview + regenerate" flow.
**Root cause:** Each feature built independently without checking it fits the existing UX pattern.
**Rule going forward:** Every new content input section must have: (1) AI-generated default, (2) visible preview, (3) regenerate/edit option. This is the PostFlow UX contract. Never add a blank form where AI could fill it.

---

## [2026-05-09] Read ui_ux_patterns.md before building any new UI

**What happened:** New features risk reinventing patterns already established in PostEditor and CarouselBuilder — different spacing, different loading states, different error handling, different dark mode behaviour.

**Root cause:** Patterns existed in code but not in writing. Each session started cold without the visual standard explicitly loaded.

**Rule going forward:** Before writing any UI component or page, read `memory/ui_ux_patterns.md`. It contains the complete standard: layout, spacing, colours, typography, loading states, error patterns, status bars, expandable pickers, preview panels, type badges, dark mode rules, and a pre-ship checklist. There is no excuse for inconsistency — the spec is written.

---

## [2026-05-09] New UI patterns must be documented immediately when invented

**What happened:** The CarouselBuilder introduced new patterns (colour-coded slide cards, dashed-border add buttons, per-slot upload, thumbnail strip) that weren't captured anywhere. Future features would have to read source code to understand the pattern.

**Root cause:** Pattern documentation was treated as optional or deferred.

**Rule going forward:** When building a new UI pattern that doesn't exist in `memory/ui_ux_patterns.md`, add it to the doc in the same session before moving to the next task. The doc must always be current. This is not optional — it's how PostFlow stays consistent at scale.

---

## [2026-05-09] The UX contract is: AI fills everything, user only adds media

**What happened:** Features were being built with empty input forms before the AI pre-fill data flow was designed. This put the burden on the user to write content that AI should generate.

**Root cause:** UI was built before the data flow was fully designed.

**Rule going forward:** For any feature where the user could logically be asked to fill in text, AI fills it first. Design the AI generation step before building the UI. The correct order is: (1) define what AI generates, (2) build the API that generates it, (3) build the UI that displays + edits the result. Never start with a blank form.

---

## [2026-05-10] Multi-step wizard with a disconnected handoff feels broken

**What happened:** PostCreator had 3 steps (Template → Brief → Edit & Save). Step 3 saved and redirected to PostEditor. Users experienced this as a form → a pause → a completely different page with no back navigation. The user called this a "disconnect" and said it was blocking format regeneration.

**Root cause:** The wizard and PostEditor were built independently. The handoff wasn't designed.

**Rule going forward:** Multi-step flows have two options — (a) keep everything in one page with step state, or (b) redirect to the destination but add a visible "← Back to [step name]" link with the original parameters preserved in the URL. PostEditor now shows "← Change brief" for non-calendar posts. Any multi-step flow must have working back navigation at every step.

---

## [2026-05-10] Dashboard and list views must be fully navigable — no dead-end cards

**What happened:** The dashboard "upcoming posts" and "needs attention" sections were non-interactive `<div>` elements. Clicking them did nothing. Users expect list items to be clickable.

**Root cause:** The data query didn't include the linked `posts(id)`, so no `href` could be constructed. The dead card was never noticed because the lack of data masked the UX problem.

**Rule going forward:** Before building any list view, define the `href` for each item type. For PostFlow: calendar entries with a linked post → `/posts/:id`; entries without → `/calendar?open=:entryId`. Always include the FK needed to construct the href in the initial data query. The `?open=` param auto-triggers entry expansion in CalendarView via `useSearchParams` + `useEffect` on mount.

---

## [2026-05-10] Template format switch must preserve and convert content

**What happened:** Switching templates in PostEditor only swapped the visual style — the caption was discarded when switching to carousel, and slide content was lost when switching back to single-image.

**Root cause:** Template picker just called `setSelectedTemplate(slug)` with no content transformation.

**Rule going forward:** Any format switch (single ↔ carousel) must trigger content conversion via `/api/posts/[id]/convert-format`. Single→carousel: Claude haiku structures caption into slides. Carousel→single: Claude haiku flattens slides into a caption. Single→single: no AI call, just `template_slug` update. Never silently discard content on format switch.

---

## [2026-05-10] Parallel Puppeteer instances cause OOM — use shared browser + sequential pages

**What happened:** The render-variants route launched 3 parallel `renderPostCard()` calls. Each opened its own Chromium process. Under memory pressure, processes crashed mid-render, returning an empty HTTP response. `JSON.parse("")` threw "Unexpected end of JSON input".

**Root cause:** Each call used `puppeteer.launch()` independently. 3 simultaneous launches × ~150MB each = OOM on the server.

**Rule going forward:** For batch rendering: (1) launch one browser, (2) render each template sequentially via `browser.newPage()` / `page.close()`, (3) close browser after all renders complete. See `renderMultiplePostCards()` in `src/lib/server/render/renderPost.ts`. Also always wrap `res.json()` in try/catch on the caller side — a crashed renderer returns an empty body, not a JSON error.

---

## [2026-05-10] Puppeteer can't load external URLs as CSS background-image — use base64

**What happened:** Photo-overlay template used `background-image: url("${mediaUrl}")` with a Supabase HTTPS URL. Puppeteer rendered a blank card — no photo appeared.

**Root cause:** Puppeteer sandboxes CSS background-image external requests. They silently fail.

**Rule going forward:** Fetch any image that must appear in a Puppeteer template and convert it server-side to a base64 data URI: `data:image/jpeg;base64,${buffer.toString("base64")}`. Never pass external URLs directly into Puppeteer-rendered CSS or HTML. This applies to every asset: photos, logos, icons.

---

## [2026-05-10] Inngest dev server requires INNGEST_DEV=1, not just the production signing key

**What happened:** Set `INNGEST_SIGNING_KEY=signkey-prod-*` in `.env.local`. The local Inngest Dev Server sends sync (PUT) requests without that signature — resulting in 400/401 errors and "Signature validation failed" in logs. All 6 functions appeared unregistered.

**Root cause:** `signkey-prod-*` prefix forces strict signature validation even in dev. The local dev server uses its own internal signing — it doesn't match a production key.

**Rule going forward:**
- `.env.local` must have `INNGEST_DEV=1` — this disables signature validation for local dev server sync.
- `INNGEST_SIGNING_KEY` goes in Vercel production env vars ONLY — never in `.env.local`.
- `INNGEST_EVENT_KEY` is fine in `.env.local` (it's not a security boundary for local dev).
- Verify connection: `curl localhost:3000/api/inngest` should return `{"function_count":N,"mode":"dev","has_signing_key":false}`.

---

## [2026-05-10] Spec patches must apply PostFlow naming conventions before integrating

**What happened:** Received a spec patch that used `brand_profiles` (non-existent table), `userId` in brand context functions (should be `brandId`), `supabase/functions/` (should be Inngest jobs), and `trend_signals` (should be `niche_trends`). Five conflicts required resolution before the patch could be integrated.

**Root cause:** Spec patches are written generically and don't know PostFlow's specific conventions.

**Rule going forward:** Before integrating any spec patch into features_v6.md, scan for these five patterns and correct them:
1. `brand_profiles` → `postflow.brands` + `intelligence_tokens` column
2. `userId` in brand functions → `brandId` (brands.id UUID)
3. `supabase/functions/` → `src/inngest/jobs/`
4. `trend_signals` → `postflow.niche_trends`
5. Any new `signal_type` values → extend the CHECK constraint in brand_token_events migration
Document resolutions in the PATCH CONFLICT RESOLUTIONS section of the DECISIONS LOG.

---

## [2026-05-10] nudgeToken() is the ONLY way to update brand tokens

**What happened:** (Pre-emptive lesson from spec design.) Brand token update logic is easy to duplicate — routes and jobs each tempted to write directly to `brands.intelligence_tokens`.

**Root cause:** JSONB column updates look simple (`UPDATE brands SET intelligence_tokens = ...`). The audit trail requirement is easy to forget.

**Rule going forward:** Every brand token update — without exception — goes through `nudgeToken(brandId, tokenKey, newValue, delta, signalType)` in `src/lib/server/brand/nudge-token.ts`. This function: enforces confidence floor, applies value shift rules, writes to `brands.intelligence_tokens`, AND writes the audit row to `brand_token_events`. Direct SQL updates to `intelligence_tokens` are forbidden in application code.

---

## [2026-05-13] Collecting data ≠ learning from it — close every feedback loop explicitly

**What happened:** Full audit revealed PostFlow was collecting analytics, tone feedback, and template performance data but NONE of it was feeding back into the token system except implicit analytics signals. Tone feedback generated suggestions but never called nudgeToken(). Template health was stored but never reached caption generation. CTR was tracked but ignored by processAnalytics. The system looked complete but was only half-wired.

**Root cause:** Features were built one at a time. Each step (collect → store → display) felt done. The final loop back into the learning system was assumed to happen "later" and never did.

**Rule going forward:** For every signal we collect, ask three questions before calling it done:
1. **Does this update intelligence_tokens via nudgeToken()?** If not, it's data, not learning.
2. **Does the caption generation prompt (getBrandContext → buildPromptBlock) include this signal?** If not, Claude can't use it.
3. **Is there a UI path where the user can SEE the learning effect?** If not, they can't validate it.
All three must be yes before a signal pipeline is complete. Write this as a checklist in the spec for every new analytics or feedback feature.

---

## [2026-05-13] Explicit feedback (user actions) should outweigh implicit signals (analytics)

**What happened:** toneLearningLoop generated a Claude suggestion when feedback threshold was met, but never called nudgeToken(). This meant a user explicitly rejecting 5 posts as "too_formal" (very strong, deliberate signal) had zero effect on the token system, while one post performing 10% above analytics baseline (much weaker signal) would nudge tokens by 0.04.

**Root cause:** The architecture treated analytics and feedback as equal in effect. They are not — explicit feedback is far more reliable than implicit performance metrics.

**Rule going forward:** Signal weight hierarchy (by confidenceDelta):
- `calibration` → 0.20 (one-time, user explicitly chose this)
- `feedback` → 0.08–0.15 (explicit user rejection or approval of AI output)
- `reject` → -0.08 (explicit user signal that something isn't working)
- `inspiration` → 0.05–0.08 (semi-explicit, user chose an example)
- `analytics` → 0.03–0.04 (implicit, continuous, noisy)
- `manual` → variable (admin override)
Never let implicit signals accumulate faster than explicit ones. A single "wrong_voice" feedback should outweigh ~3 analytics reinforcements.

---

## [2026-05-13] Template performance is invisible to the AI unless explicitly injected into context

**What happened:** template_health table was being populated correctly by templatePulse job. But getBrandContext() never read it — so every caption generated had zero knowledge of which templates were performing. A user could pick a declining template and get the same caption quality as from a rising one.

**Root cause:** Template health was built as a display feature (dashboard widget) not as a generation input. The connection to getBrandContext was missing.

**Rule going forward:** Any data that should influence generated content MUST be explicitly added to getBrandContext().buildPromptBlock(). The test is: "If I add this data to the DB, does the next caption generation see it?" If not, wire it in. Template health, niche benchmarks, template suggestions, and style_volatility_preference all affect content strategy — all must be in the prompt block.

---

## [2026-05-18] Every new AI feature must be registered in src/lib/ai/models.ts

**What happened:** 19 AI calls across the codebase each hardcoded their own model string. There was no central place to understand what was running, no way to swap a model without hunting files, and no tier-based cost control.

**Root cause:** Each feature was built in isolation without a shared model registry.

**Rule going forward:** When adding ANY new AI/Claude call to the codebase:
1. **Add the model constant to `src/lib/ai/models.ts` first** — give it a descriptive key under `MODELS` (fixed) or `TIERED` (varies by brand tier).
2. **Classify it:** user-facing real-time call (tiered) or background/one-time call (fixed)?
   - Fixed: background Inngest jobs, one-time onboarding steps → add under `MODELS`.
   - Tiered: called on every user action (captions, calendar) → add to both `TIERED.standard` and `TIERED.economy`.
3. **Reference the constant in the implementation** — never hardcode a model string outside `models.ts`.
4. **Add a comment** explaining what the call does and why that model was chosen.

`src/lib/ai/models.ts` is the authoritative catalogue of every AI call in the app. Reading it should give a one-page summary of the app's full AI usage and cost structure. Keep it that way.

---

## [2026-05-10] UI/UX consistency requires a living spec + a read-before-build habit

**What happened:** Multiple features across a single session had divergent patterns: emoji-only platform display, non-navigable list items, missing dark mode variants, disconnected multi-step flows. Each was built without reading the established spec.

**Root cause:** `memory/ui_ux_patterns.md` existed but wasn't being read before starting UI tasks.

**Rule going forward:**
1. **Read `memory/ui_ux_patterns.md` before building any UI.** Not after — before.
2. **Document new patterns immediately** in `ui_ux_patterns.md` with exact Tailwind class names, in the same session they were invented.
3. **Audit existing pages before touching them** — classify Green / Amber / Red using the checklist in `ui_ux_patterns.md`. Fix Amber/Red violations before adding new features to the page.

## [2026-06-14] Next.js 16 stuck-Suspense: never use Suspense for client components that call useSearchParams(), or async server components that call cookies()

**What happened:** Four pages were stuck showing Suspense fallbacks (or blank content) permanently:
- `/settings/connections` — `useSearchParams()` in a `"use client"` component inside `<Suspense>`
- `/brand?tab=intelligence` — async server component calling `cookies()` inside `<Suspense>`
- `/schedule` — `CalendarView` (client component) using `useSearchParams()` inside `<Suspense>`
- `/insights?tab=trends` — pure client component `TrendClient` wrapped unnecessarily in `<Suspense>`

In all cases, the Suspense fallback was shown on SSR and never replaced after hydration. No JS errors, no error boundary triggered — it simply never resolved.

**Root cause:** In Next.js 16 + React 19, there are two broken patterns:
1. `useSearchParams()` inside a client component that is wrapped in a server-side `<Suspense>` boundary causes the Suspense to never resolve on the client (the fallback persists indefinitely).
2. An async server component that calls `cookies()` inside a `<Suspense>` boundary causes a streaming deadlock — the stream never sends the replacement HTML.

**Rule going forward:**
- NEVER wrap client components that use `useSearchParams()` in `<Suspense>`.
  Instead: read the param in the parent server page (`await searchParams`), pass as a prop.
- NEVER put async server components that call `cookies()` or `headers()` inside `<Suspense>`.
  Instead: fetch all data in the page-level server component, pass data as props to child components.
- Only use `<Suspense>` for: (a) client components that use `React.lazy()` / `dynamic()`, or (b) async server components that do NOT call Request-time APIs (`cookies`, `headers`).
- When debugging a stuck Suspense: check `document.querySelectorAll('template').length` — a non-zero count means at least one Suspense is not resolving. Also check for 0 streaming `$RC` scripts in the page source.
