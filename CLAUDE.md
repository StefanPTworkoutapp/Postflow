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
