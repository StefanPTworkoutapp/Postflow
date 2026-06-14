# PostFlow — Component Library

Last updated: 2026-06-14

This document is the single reference for every shared UI component in
PostFlow. It lists each component's location, what it does, its props
interface, and where it is used. Read this before building anything that
touches the UI — do not duplicate what already exists.

---

## How the component tree is organised

```
src/components/
├── ui/            — primitive design-system atoms (buttons, cards, inputs…)
├── shared/        — cross-feature components (health bars, platform badges…)
├── layout/        — app shell (sidebar, topbar, brand switcher)
├── media/         — media selection and upload
├── dashboard/     — dashboard-specific widgets
├── onboarding/    — first-run tour
├── clip-forge/    — Smart Video Builder feature components
└── trend-forge/   — Trend Builder feature components
```

The rule: UI atoms live in `ui/`. Anything that knows about PostFlow
domain objects (posts, brands, templates) lives in `shared/` or in the
feature folder it belongs to. Never import from `clip-forge/` or
`trend-forge/` outside those features.

---

## `ui/` — Design-system atoms

All shadcn/ui primitives are re-exported from here. Import from
`@/components/ui/<name>` everywhere.

### `button.tsx`

Standard button. Uses the shadcn/ui `Button` component.

```tsx
<Button variant="default" | "ghost" | "outline" | "destructive" size="sm" | "default" | "lg">
  Label
</Button>
```

Used everywhere. No PostFlow-specific logic — pure Radix/shadcn primitive.

---

### `card.tsx`

Container card with optional `CardHeader`, `CardContent`, `CardFooter`.

```tsx
<Card className="…">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>…</CardContent>
</Card>
```

---

### `badge.tsx`

Pill-shaped label. Used for post status, plan tier, template slugs.

```tsx
<Badge className="bg-green-100 text-green-700 border-0">Active</Badge>
```

---

### `input.tsx` / `label.tsx`

Standard form controls. Always pair `Input` with a `Label` via `htmlFor`.

---

### `avatar.tsx`

Circular avatar with image fallback. Used in `TopBar` for the account
menu and in `BrandSwitcher` for brand initials.

```tsx
<Avatar>
  <AvatarImage src={url} />
  <AvatarFallback>AB</AvatarFallback>
</Avatar>
```

---

### `dropdown-menu.tsx`

Radix-based dropdown. Used in `TopBar` (account menu) and `BrandSwitcher`.

```tsx
<DropdownMenu>
  <DropdownMenuTrigger>…</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>…</DropdownMenuItem>
    <DropdownMenuSeparator />
  </DropdownMenuContent>
</DropdownMenu>
```

---

### `popover.tsx`

Radix-based popover. Used in `TopBar` for the storage warning bell panel.

```tsx
<Popover>
  <PopoverTrigger>…</PopoverTrigger>
  <PopoverContent align="end">…</PopoverContent>
</Popover>
```

---

### `separator.tsx`

Horizontal or vertical line. Used in settings pages.

---

### `tooltip.tsx`

Radix-based tooltip. Used in `Sidebar` for collapsed nav labels.

```tsx
<Tooltip>
  <TooltipTrigger>…</TooltipTrigger>
  <TooltipContent>Label</TooltipContent>
</Tooltip>
```

---

### `PageSkeleton.tsx`

Generic loading placeholder for pages fetching async data. Renders N
animated skeleton rows with a fade-out effect.

```tsx
<PageSkeleton rows={5} />   // default rows = 5
```

**When to use:** render this while an async server component loads its
data — NOT inside a `<Suspense>` boundary (see lessons.md for the
Next.js 16 stuck-Suspense issue). Instead, pass data as props and
conditionally render either the skeleton or the real content.

---

### `EmojiInput.tsx`

Emoji selector input. Renders a space-separated emoji string with a
popover picker powered by `@emoji-mart/react` (lazy-loaded).

```tsx
<EmojiInput
  value="💪 ✅ 🔥"
  onChange={(val) => …}
/>
```

Props:
| Prop        | Type                      | Description                          |
|-------------|---------------------------|--------------------------------------|
| `value`     | `string`                  | Space-separated emoji string         |
| `onChange`  | `(value: string) => void` | Called on each change                |
| `className` | `string?`                 | Extra Tailwind classes on container  |

Used in: brand voice settings (signature emojis field).

---

### `RankedGoalPicker.tsx`

Multi-select goal picker where the order of selection becomes the rank.
Clicking a selected goal deselects it and closes the gap.

```tsx
<RankedGoalPicker
  selected={["engagement", "leads"]}
  onChange={(ordered) => …}
/>
```

Props:
| Prop       | Type                       | Description                    |
|------------|----------------------------|--------------------------------|
| `selected` | `string[]`                 | Ordered goal values (rank 0=primary) |
| `onChange` | `(ordered: string[]) => void` | Called on change             |

Uses `GOALS` from `@/lib/shared/onboarding/types`. Used in: onboarding
wizard and brand goal settings.

---

## `shared/` — Cross-feature domain components

These know about PostFlow objects (posts, brands, templates) but are
used across multiple features.

---

### `FeedbackRow.tsx`

Inline feedback pill row for tone and content feedback. Stateless —
fires `onSelect`; the parent handles the API call.

```tsx
import { FeedbackRow, BASE_FEEDBACK_TAGS, REEL_FEEDBACK_TAGS } from "@/components/shared/FeedbackRow"

<FeedbackRow
  tags={BASE_FEEDBACK_TAGS}
  selected={feedbackGiven}        // controlled
  onSelect={(type) => …}
  disabled={isSaving}
  size="sm"                       // "sm" | "md"
/>
```

Pre-built tag sets (all importable from this file):

| Export                  | Use case                                 |
|-------------------------|------------------------------------------|
| `BASE_FEEDBACK_TAGS`    | Caption / post feedback (7 tags)         |
| `REEL_FEEDBACK_TAGS`    | Reel/video feedback (great hook, pacing) |

Every `type` string maps 1:1 to a `feedback_type` value in the
`tone_feedback` DB table. Do not invent new types — add them here first
and confirm the toneLearningLoop handles them.

Used in: post cards, render preview drawer, Trend Builder concept cards.

---

### `HealthBar.tsx`

Horizontal progress bar for health scores (0–100). Colour tier derived
from score: ≥75 = green, ≥45 = amber, <45 = red.

```tsx
<HealthBar score={82} />
<HealthBar score={42} size="sm" showLabel />
<HealthBar score={null} />   // renders nothing
```

Props:
| Prop        | Type              | Description                             |
|-------------|-------------------|-----------------------------------------|
| `score`     | `number \| null`  | 0–100 score; null = no render           |
| `showLabel` | `boolean?`        | Show text percentage next to bar        |
| `size`      | `"sm"\|"md"\|"lg"`| Bar height (default: `"md"`)            |
| `className` | `string?`         | Extra Tailwind classes                  |

Used in: `TemplateSuggestionCard`, `ConceptCard`, insights page, admin dashboard.

---

### `HealthScore.tsx`

Numeric health score badge. Companion to `HealthBar` — use when you
want a compact number pill instead of a bar.

```tsx
<HealthScore score={84} variant="pill" size="md" />
```

Used in: `TemplateSuggestionCard` (before/after score comparison).

---

### `PlatformBadge.tsx`

Platform identity pill/icon/dot. Exports `PLATFORM_META` with brand
colours for all 8 platforms.

```tsx
<PlatformBadge platform="instagram" />                    // pill (default)
<PlatformBadge platform="tiktok" variant="icon" />        // emoji circle
<PlatformBadge platform="linkedin" variant="dot" connected />  // tiny dot + connected indicator
```

Props:
| Prop        | Type                          | Description                             |
|-------------|-------------------------------|-----------------------------------------|
| `platform`  | `string`                      | Platform key (see `PLATFORM_META`)      |
| `variant`   | `"pill"\|"icon"\|"dot"`       | Render shape (default `"pill"`)         |
| `connected` | `boolean?`                    | Show green connected dot overlay        |
| `className` | `string?`                     | Extra Tailwind classes                  |

Supported platforms: `instagram`, `linkedin`, `facebook`, `tiktok`, `x`,
`threads`, `youtube`, `buffer`.

Used in: connections page, post cards, analytics, `TemplateSuggestionCard`.

---

### `TemplateSuggestionCard.tsx`

Displays a single template improvement suggestion from the Template
Health Engine. One-tap approve replaces `current_slug` with
`suggested_slug` via `/api/templates/suggestions/[id]`.

```tsx
<TemplateSuggestionCard
  suggestion={suggestion}          // TemplateSuggestion type
  onRespond={(id, action) => …}   // "approved" | "dismissed"
/>
```

Exports the `TemplateSuggestion` interface — import this type when
building anything that consumes template suggestions.

Used in: `/insights` page (Template Health section).

---

### `RenderStatusBar.tsx`

Compact inline progress bar for Puppeteer render states.

```tsx
<RenderStatusBar status="rendering" message="Slide 3 of 5…" progress={60} />
<RenderStatusBar status="done" />
<RenderStatusBar status="error" message="Render failed: timeout" />
<RenderStatusBar status="idle" />   // returns null (nothing shown)
```

Exports `RenderStatus = "idle" | "rendering" | "done" | "error"` —
import this type wherever you track render state.

Used in: `RenderQueueDrawer`, clip-forge render drawer, trend-forge
`RenderStatusBar` (feature variant wraps this).

---

### `RenderQueueDrawer.tsx`

Slide-out drawer listing all active and recent render jobs for the
current brand. Polls every 4 s while open.

Sources tracked:
- `clip_forge_jobs` (Smart Video Builder)
- `trend_concepts` (Trend Builder A/B renders)

```tsx
<RenderQueueDrawer open={open} onClose={() => setOpen(false)} />
```

Triggered from `TopBar` via the Layers icon button (render queue count
badge). Do not open this drawer from feature pages directly — use the
global TopBar trigger.

---

## `layout/` — App shell

These three components form the persistent app shell. Never import them
in feature pages.

---

### `Sidebar.tsx`

Left navigation sidebar. Renders collapsible nav sections with
section headings, icons, and active state. Uses `Tooltip` for collapsed
mode labels.

Nav sections (defined via `NAV_SECTIONS` constant in the file):

| Section       | Items                              |
|---------------|------------------------------------|
| Create        | Home, Schedule, Create             |
| Intelligence  | Brand, Insights                    |
| Tools         | Clip Builder, Trend Builder        |
| Account       | Connections, Settings              |

To add a nav item: edit `NAV_SECTIONS` in this file only. Do not
scatter nav links across features.

---

### `BrandSwitcher.tsx`

Dropdown for switching the active brand. Shows initials + name; routes
to `/api/brands/switch` on selection and refreshes the router.

```tsx
<BrandSwitcher
  brands={brands}               // BrandLite[]
  activeBrandId={brand.id}
/>
```

Rendered inside `Sidebar` at the bottom of the nav. Not used anywhere else.

---

### `TopBar.tsx`

Top navigation bar. Renders:
- Storage warning bell (popover) with dismiss logic (localStorage,
  7d/24h depending on severity tier)
- Render queue button (badge count, opens `RenderQueueDrawer`)
- New post button
- Account avatar dropdown (profile, sign out)

Storage warning thresholds: amber at ≥70% (dismiss 7d), red at ≥90%
(dismiss 24h). Reads usage from `/api/storage/usage`.

---

## `media/` — Media

### `MediaPicker.tsx`

Multi-select media item picker. Fetches the brand's uploaded files
from `/api/media` and renders a grid. Returns selected IDs via `onChange`.

```tsx
<MediaPicker
  selected={selectedIds}
  onChange={(ids) => …}
  max={5}                     // optional selection cap
/>
```

Props:
| Prop        | Type                        | Description                            |
|-------------|-----------------------------|----------------------------------------|
| `selected`  | `string[]`                  | Currently selected media IDs           |
| `onChange`  | `(ids: string[]) => void`   | Called on selection change             |
| `max`       | `number?`                   | Max selectable files                   |
| `className` | `string?`                   | Extra Tailwind classes                 |

Exports `MediaItem` interface for use in parent components.

Used in: post creation flow, carousel builder.

---

## `dashboard/`

### `WeeklyIdeas.tsx`

Displays 3 AI-generated post ideas for the current week. Caches results
in `localStorage` for the week (keyed by Monday's ISO date) to avoid
re-calling the API on every page load.

```tsx
<WeeklyIdeas brandId={brand.id} />
```

Calls `/api/posts/weekly-ideas` on first load each week. No props other
than `brandId`. Handles its own loading/error state.

Used in: `/dashboard` page only.

---

## `onboarding/`

### `OnboardingTour.tsx`

4-screen product walkthrough modal shown once after signup. Dismissal
tracked in `localStorage` under key `"postflow_tour_v1"`. Mounted in
`AppLayout` so it appears on any first-page route.

No props — fully self-contained. To change tour content: edit the
`STEPS` array inside this file.

Steps: Schedule, Create, Brand, Insights.

---

## `clip-forge/` — Smart Video Builder

Feature-scoped. Only import within `/create/clip-forge/` feature routes.

### `ClipDropzone.tsx`

Drag-and-drop multi-clip uploader. Accepts `.mp4`, `.mov`, `.webm` up
to 500 MB each, max 10 clips. Uploads via `/api/clip-forge/upload-url`,
extracts a frame screenshot for Claude Vision.

```tsx
<ClipDropzone onClipsReady={(clips: UploadedClip[]) => …} />
```

Exports `UploadedClip` type (path, duration, fileName, frameDataUri).

### `ConnectPrompt.tsx`

Prompt shown when the user hasn't connected a Buffer account yet.
Links to `/settings/connections`.

### `MusicPicker.tsx`

Dropdown or grid for selecting a music vibe for the video reel.
Returns a string vibe key.

### `SelectCard.tsx`

Reusable selectable card used in multi-step clip-forge wizard
(style, pacing, platform selection steps).

---

## `trend-forge/` — Trend Builder

Feature-scoped. Only import within `/create/trend-forge/` feature routes.

### `ConceptCard.tsx`

Displays a single trend-aligned video concept: title, trending reason,
format details, sound vibe, brand fit score bar, and a "Build this →"
CTA. Shows "Best match" badge on the highest-scoring card.

```tsx
<ConceptCard
  concept={concept}               // TrendConcept from lib/server/trends/trend-filter
  isBestMatch={rank === 0}
  onBuild={(concept) => …}
/>
```

### `RenderStatusBar.tsx`

Trend-forge-specific wrapper around `shared/RenderStatusBar`. Shows
render status for trend concept A/B image generation.

---

## Adding a new component — checklist

Before creating a new component:

1. **Check this doc** — does something similar already exist?
2. **Choose the right folder:**
   - Pure visual atom → `ui/`
   - Knows about brands/posts/templates, used in 2+ features → `shared/`
   - Feature-specific → `features/<name>/`
3. **Write the JSDoc header** — document every prop before the first import
4. **Export named types** if the parent needs them (e.g. `TemplateSuggestion`, `MediaItem`)
5. **Add an entry to this doc** immediately after creating the component
6. **One responsibility** — if the component does 3 things, split it

---

## Extending an existing component

- Add new props as optional with a default — never break existing call sites
- Update the props table in this doc
- Add a test if the new behavior has conditional logic
