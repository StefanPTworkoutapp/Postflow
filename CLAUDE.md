@AGENTS.md
@.claude/rules/workflow.mdc
@.claude/rules/quality-gate.mdc

================================================================
LANGUAGE RULE
================================================================
All user-facing text within the PostFlow app itself — UI copy, labels,
buttons, error messages, emails, notifications, generated captions/content,
docs shipped in-app, etc. — MUST always be in ENGLISH, regardless of what
language the user (Sayen) communicates with Claude in during a session
(e.g. Dutch). Conversation language in chat has no bearing on in-app
content language. Never localize or translate in-app strings to Dutch
unless explicitly instructed otherwise for a specific feature.

================================================================
MULTI-CONTRIBUTOR REBASE RULE
================================================================
This project has another person actively working on it alongside Claude.
Before opening or updating ANY pull request:
  1. Run `git fetch origin` first.
  2. Check whether the target branch (usually `main`) has moved ahead of
     the local branch/PR base: `git log HEAD..origin/main --oneline`.
  3. If it has, rebase the feature branch onto the latest `origin/main`
     (`git rebase origin/main`) before pushing/opening the PR — don't just
     merge or push and let it diverge.
  4. Resolve any conflicts surfaced by the rebase; re-run typecheck/tests
     after resolving before pushing.
  5. Only force-push the REBASED FEATURE BRANCH (never `main`) after a
     rebase, and only after telling the user a rebase happened.

Goal: never let Claude's branch and the collaborator's changes drift apart
silently. Always check for upstream movement before PRing, not just before
merging.

================================================================
UNIVERSAL ACTIONABLE ERRORS RULE
================================================================
No user-facing error in PostFlow may be a dead end. Every error the user can
see MUST do one of two things:

  1. CONNECTION-RELATED ERRORS (e.g. trying to schedule/publish to a platform
     with no connected/expired social account): show the actual problem in
     plain English, then give a "Connect {platform}" action that deep-links
     to /settings/connections?platform={platform}. The connections page
     scrolls to and highlights that platform automatically.

  2. ANY OTHER ERROR: show the actual problem in plain English, then give a
     "Report to support" action that opens a prefilled email to
     support@mindyourbodypt.app with subject "PostFlow — {context}" and a
     body containing the error message, the page URL, and a timestamp — so
     the user can just hit send, no retyping required.

Never show a raw/generic error string with no action ("Something went
wrong", a bare API error message, a silently swallowed catch block). Use the
shared `ActionableError` component (`src/components/shared/ActionableError.tsx`)
and its `classifyScheduleError()` helper for this everywhere — don't hand-roll
a new error banner per surface.

DATA SAFETY: whatever the user was working on (a draft post, an uploaded
video, calendar entry, etc.) must be PRESERVED when an error occurs — never
lose the user's work because a schedule/publish attempt failed. Only flip
status to "scheduled"/"published" on confirmed success from the server.

This rule applies everywhere a post can be created, edited, scheduled, or
published: post creation, the post editor, calendar (single + any future
bulk scheduling), Stories, Carousel, Create (Smart Video Builder), Trend
Builder, and any future surface. When adding a new flow that can fail,
wire it into this pattern from the start — don't ship a bespoke error
banner and fix it later.
