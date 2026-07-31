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
