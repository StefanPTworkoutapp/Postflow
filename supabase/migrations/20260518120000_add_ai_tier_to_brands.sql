-- Add ai_tier to postflow.brands
-- Lets each brand owner choose between Standard (Sonnet) and Economy (Haiku)
-- for their real-time AI generation (captions, calendar).
-- Defaults to 'standard' so all existing brands keep current behaviour.

alter table postflow.brands
  add column if not exists ai_tier text not null default 'standard'
    check (ai_tier in ('standard', 'economy'));

comment on column postflow.brands.ai_tier is
  'AI generation quality tier: standard = claude-sonnet (default), economy = claude-haiku for captions and calendar.';
