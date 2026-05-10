<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

<!-- BEGIN:postflow-workflow -->
# Workflow & Quality Rules

These rules govern HOW you work, not WHAT you build. All technical and
architectural decisions live in the existing project memory — defer to
those. This file only sets the process for planning, verifying, and
self-correcting, plus database safety.

================================================================
0. QUALITY STANDARD (APPLIES TO ALL WORK)
================================================================

Remember when implementing: The marginal cost of completeness is near zero
with AI. Do the whole thing. Do it right. Do it with tests. Do it with
documentation. Do it so well that you are genuinely impressed — not politely
satisfied, actually impressed.

Never offer to 'table this for later' when the permanent solve is within
reach. Never leave a dangling thread when tying it off takes five more
minutes. Never present a workaround when the real fix exists.

The standard isn't 'good enough' — it's 'holy shit, that's done.' Search
before building. Test before shipping. Ship the complete thing. When you ask
for something, the answer is the finished product, not a plan to build it.

Time is not an excuse. Fatigue is not an excuse. Complexity is not an excuse.

WHAT THIS MEANS:
- Code ships with tests (unit, integration, or e2e as appropriate)
- Documentation is complete and clear, not skeletal
- Edge cases are handled, not noted for "later"
- Error handling is thorough, not minimal
- No TODOs, FIXMEs, or "we'll polish this later" in shipped code
- Every feature is production-ready on delivery
- If something feels incomplete, it is — fix it before marking done

================================================================
0.5. COMMIT, PUSH, AND MERGE: DUAL REVIEW
1.  PLAN MODE DEFAULT
================================================================
- Enter plan mode for ANY non-trivial task (3+ steps or any
  architectural decision).
- Write detailed specs upfront to reduce ambiguity.
- Use plan mode for verification steps too, not just building.
- If something goes sideways: STOP and re-plan immediately. Do not
  keep pushing through.

================================================================
2. SUBAGENT STRATEGY
================================================================
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents.
- One task per subagent for focused execution.

================================================================
3. SELF-IMPROVEMENT LOOP
================================================================
- After ANY correction from the user: update `tasks/lessons.md` with
  the pattern (not just the one-off fix).
- Write rules for yourself that prevent the same mistake from recurring.
- Ruthlessly iterate on these lessons until the mistake rate drops.
- Review lessons at session start for the relevant area of the project.

================================================================
4. VERIFICATION BEFORE DONE (LOCALHOST TESTING REQUIRED)
================================================================
- Never mark a task complete without proving it works locally.
- Test against localhost only — no git preview branches.
- Run the full test suite locally before marking work complete.
- Diff behavior between the working version and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Check logs, confirm the output matches what was expected.

TESTING CHECKLIST:
✓ Code changes tested on localhost
✓ Test suite passes (npm test, pytest, etc.)
✓ No console errors or warnings
✓ Manual verification of feature behavior
✓ Edge cases tested (empty states, errors, boundary conditions)

================================================================
5. EXPANSION-READY DESIGN
================================================================

Build for expansion: assume features will be extended, modified, and added
to later. Quality doesn't degrade when the codebase grows — it's by design.

WHEN BUILDING ANY FEATURE:
- Is it modular? Can someone add a variant without touching core logic?
- Are dependencies clear? Does changing this break 5 other things?
- Is it testable? Can new variations be tested without a rewrite?
- Is it documented? Will someone else understand how to extend it in 6 months?
- Can it be reused? Does it abstract the pattern or hardcode the solution?

EXPANSION-READY CHECKLIST:
✓ Components/functions have single responsibility (one reason to change)
✓ Dependencies are injected, not hardcoded (easy to swap/extend)
✓ Tests exist for the core behavior (new variants can add their own tests)
✓ Documentation explains *why*, not just *what* (helps future changes)
✓ No tight coupling between unrelated features (changes don't cascade)
✓ Interfaces/contracts are explicit (clear boundaries for extensions)
✓ Edge cases are handled in the abstraction (not per-variant)

THIS MEANS:
- When you add Feature A, it's built so Feature B (not yet known) can reuse it
- Refactoring for expansion doesn't break what's already shipped
- Quality gets BETTER as you add features, not worse

================================================================
5.1. MODULAR CODE ARCHITECTURE (CODE MUST BE MODULAR)
================================================================

ALL code is built as modular units. No feature is monolithic. No logic is
duplicated. No business logic lives in UI layers.

CORE RULE: If you can't move it, rename it, or replace it without changing
10+ other files, it's not modular enough. Refactor before shipping.

MODULAR CODE PATTERN:

✓ GOOD (modular):
  src/lib/posts/
    ├── captionGenerator.ts   (calls Claude, returns caption)
    ├── imageRenderer.ts      (Puppeteer → PNG pipeline)
    ├── platformAdapter.ts    (adapts one post to multiple platforms)
    └── __tests__/
        ├── captionGenerator.test.ts
        ├── imageRenderer.test.ts
        └── platformAdapter.test.ts

  Each module:
  - Has ONE responsibility
  - Exports a clean interface (function/class: inputs → outputs)
  - Has zero knowledge of the caller (UI, API route, etc.)
  - Can be tested in isolation
  - Can be replaced without caller changes

✗ BAD (monolithic):
  src/app/api/posts/generate/route.ts (500+ lines of tangled logic)
  - Calls Claude directly
  - Runs Puppeteer inline
  - Writes to DB
  - Calls Buffer API
  — Hard to test, hard to reuse, impossible to change safely

MODULAR CHECKLIST FOR EVERY FEATURE:
✓ Business logic extracted to `src/lib/` (NOT in app/ or components/)
✓ Each module has a single, clear responsibility
✓ Dependencies are passed in (not hardcoded imports of singletons)
✓ Tests exist for each module in isolation
✓ Interfaces are explicit (TypeScript types, not implicit assumptions)
✓ No circular dependencies between modules
✓ UI components call lib functions, not the reverse
✓ API routes use lib functions, don't contain business logic

================================================================
5.2. DATA MODELING & SCHEMA ALIGNMENT
================================================================

Data modeling is foundational. Bad schema design cascades into every layer
of the app. Before writing ANY code, verify:

1. THE SCHEMA EXISTS AND IS CORRECT
   - Regenerate types after any migration:
     `supabase gen types typescript --local > src/types/database.types.ts`
   - Check: Do your TypeScript types match the actual schema?
   - If not: Update schema FIRST, then code
   - Never write code that assumes a schema that doesn't exist yet

2. DATA FLOW IS MAPPED
   - Where does data come FROM? (user input, API, DB query)
   - Where does it GO? (DB, cache, response, another service)
   - What TRANSFORMS happen in between?

3. CONSISTENCY ACROSS LAYERS
   - Database schema → TypeScript types (generated) → API contracts → component props
   - If any layer differs, you have a bug waiting to happen.

SCHEMA-FIRST WORKFLOW:
  1. Define database schema (tables, columns, types, relationships)
  2. Write migration file to `supabase/migrations/`
  3. Run: `supabase gen types typescript --local > src/types/database.types.ts`
  4. Verify generated TypeScript matches needs
  5. Write API types, then UI types — aligned to generated types
  6. Only then: write implementation code

DATA ALIGNMENT CHECKLIST:
✓ Schema exists in a migration file and is reviewed
✓ TypeScript types generated from schema
✓ API request/response types match generated types
✓ Component props align with API contracts
✓ No ad-hoc type definitions that contradict the schema
✓ Tests validate the full data flow: input → DB → response → UI

COMMON MISTAKES TO AVOID:
✗ Writing code, then creating schema to match (backwards)
✗ Hardcoding TypeScript types instead of generating from schema
✗ API response shape differs from database shape
✗ Schema changes without regenerating TypeScript types (silent bugs)

WHEN SCHEMA CHANGES:
  1. Update migration file
  2. `supabase gen types typescript --local > src/types/database.types.ts`
  3. TypeScript compilation shows every broken reference — fix each one
  4. Tests catch any logic gaps
  5. Deploy with confidence

================================================================
5.3. FEATURE ARCHITECTURE STANDARD
================================================================

Every feature must be built as a modular unit, not as a single route or
component with hidden business logic.

STANDARD DIRECTORY STRUCTURE:

  src/app/...                    → Route/page layer only. No business logic.
  src/app/api/...                → Thin API layer. Validate → call lib → return.
  src/features/<feature>/        → Feature UI, hooks, local presentation helpers.
  src/lib/server/<feature>/      → Server-side business logic, DB writes, permissions.
  src/lib/shared/<feature>/      → Shared enums, DTOs, Zod schemas, pure helpers.
  src/types/database.types.ts    → Generated Supabase types (do not hand-edit).
  docs/features/<feature>/       → Feature spec, QA notes, decision log.

GREEN / AMBER / RED CLASSIFICATION:
- Green: modular, typed, tested, schema-aligned, low regression risk.
- Amber: works but has coupling or missing tests; improve when touched.
- Red: risky, schema-unclear, weak tests, or business logic in UI/API.

For every meaningful feature change, state:
- Current classification
- Target classification
- What was intentionally NOT refactored and why

================================================================
5.4. DATA STRUCTURE & ANALYTICS ARCHITECTURE
================================================================

Before adding any feature that collects data, define:

1. SOURCE DATA — what does the user enter? What does the system generate?
2. RAW STORAGE — which table, is it append-only, does it have enough context?
3. SNAPSHOT STORAGE — if the content/schedule can change, store the performed snapshot
4. DERIVED METRICS — define separately from raw storage; never compute in UI only
5. TESTABILITY — every derived metric must have fixture-based tests with edge cases
6. ANALYTICS CONTRACT — required tables, snapshot fields, metric functions, output shape

NO UI-ONLY METRICS:
- If a metric matters for AI, recommendations, or insights, it must live in
  server-side logic with test coverage — not only in React.

================================================================
5.5. FEATURE AUDIT BEFORE STRUCTURAL REFACTOR
================================================================

Do not systematically refactor the whole app without an audit.

When introducing a new workflow or modularity standard:
  1. Investigate and map the current feature
  2. Classify Green / Amber / Red
  3. Identify the smallest safe improvement
  4. Add/update tests
  5. Run local QA
  6. Update tasks/decisions.md when a rule changes

Default strategy:
- Green: leave alone
- Amber: improve when touched
- Red: plan a bounded refactor

================================================================
5.6. LOCAL VS ONLINE SUPABASE TYPE GENERATION
================================================================

Use local type generation by default:
  supabase gen types typescript --local > src/types/database.types.ts

Only generate from the online project when intentionally releasing against it:
  supabase gen types typescript --project-ref <project-ref> > src/types/database.types.ts

If generated types differ between local and online: stop and investigate
migration drift before coding against either result.

================================================================
6. DEMAND ELEGANCE (BALANCED WITH PRAGMATISM)
================================================================
- For non-trivial changes: pause and ask if there's a cleaner approach
  before committing.
- If a fix feels hacky: implement the elegant solution.
- Skip this for simple, obvious fixes — don't over-engineer.
- Always ask: "Will this code support expansion without major refactoring?"

================================================================
7. AUTONOMOUS BUG FIXING
================================================================
- When given a bug report: just fix it. Don't ask for clarification on
  what's already obvious from logs/errors/tests.
- Point at logs, errors, failing tests — then diagnose and patch.
- Zero context-switching should be required from the user.
- Go fix failing tests without being told to.

================================================================
8. DATABASE SAFETY (POSTFLOW SCHEMA RULE)
================================================================

⚠️  CRITICAL: ALL queries MUST use schema `postflow`. NEVER query `public`.
PostFlow shares a Supabase project with an existing live app. The `public`
schema belongs to that app. Any write to `public` corrupts live data.

GENERAL RULES:
- NEVER run schema changes (CREATE/ALTER/DROP TABLE, etc.) directly against any DB.
- ALL schema changes must be written as migration files in `supabase/migrations/`.
- The user applies migrations by pushing to GitHub — not by running commands.
- Initialize the Supabase client with: `db: { schema: 'postflow' }`

MIGRATION REVIEW CHECKPOINT:
Before proposing any migration:
  1. Write the SQL migration to `supabase/migrations/` with timestamp naming
  2. Post it in chat with a plain-English explanation:
     - What it changes
     - Why it's needed
     - What could break
     - Data loss risk (if any)
  3. Wait for explicit approval before committing
  4. Destructive operations require an explicit "yes, do that" confirmation

- Never modify production data. Test data goes in `supabase/seed.sql`.
- RLS policies are part of the schema — treat them with the same care.

BRANCHING WORKFLOW:
  1. Write migration to `supabase/migrations/`
  2. User reviews SQL and commits to a feature branch
  3. Pushing to GitHub auto-creates a preview Supabase branch + Vercel preview
  4. User tests on the Vercel preview URL
  5. Merging to `main` applies the migration to production

NEVER instruct the user to run `supabase db push`, `supabase db reset`, or
direct SQL via the dashboard for schema changes in production.

================================================================
9. DEPLOYMENT & PREVIEW STRATEGY
================================================================

NO GIT PREVIEW BRANCHES FOR CODE TESTING:
- All code testing happens on localhost before shipping.
- Migrations are reviewed in chat, then applied via GitHub + Vercel branching.

LOCALHOST FIRST:
- Test all code changes locally
- Verify features work, tests pass, logs are clean
- Only after localhost verification: commit and push

PREVIEW BRANCHES FOR MIGRATIONS ONLY:
- Use preview branches to verify migrations don't break the schema
- Code testing must be complete on localhost first

================================================================
TASK MANAGEMENT
================================================================
- Plan First: write the plan to `tasks/todo.md` with clear steps
- Verify Plan: check in before starting implementation
- Track Progress: mark items complete as you go
- Explain Changes: high-level summary at each checkpoint
- Verify Locally: run tests, check behavior on localhost
- Document Decisions: add notable choices to `tasks/decisions.md`
- Capture Lessons: update `tasks/lessons.md` with anything learned

================================================================
CORE PRINCIPLES
================================================================
- Simplicity First: prefer the smallest change that solves the problem
- No Laziness: finish the job — no shortcuts, no half-measures
- Complete Over Fast: a fully polished feature beats a rushed one
- Test Everything: untested code is broken code waiting to be found
- Modular First: code that can't be reused is broken by design
- Schema First: don't code features without the schema to support them

================================================================
NOTE ON SCOPE
================================================================
This file governs process, quality discipline, testing, modularity,
data modeling, and database safety only. When this file and project
memory disagree on a technical or architectural matter, project memory
wins. Stack choices, feature specs, and design decisions all live in
memory — this file does not override them.
<!-- END:postflow-workflow -->
