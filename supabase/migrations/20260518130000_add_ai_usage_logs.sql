-- AI usage log — one row per Claude API call.
-- Tracks model, token counts, estimated cost, and which brand/feature triggered it.
-- Used in the admin dashboard for monthly cost-per-brand reporting.

create table if not exists postflow.ai_usage_logs (
  id                  uuid            default gen_random_uuid() primary key,
  brand_id            uuid            references postflow.brands(id) on delete set null,
  created_at          timestamptz     default now() not null,

  -- what ran
  model               text            not null,
  feature             text            not null, -- 'caption' | 'calendar' | 'tone_extraction' | etc.

  -- token counts straight from the Anthropic response
  input_tokens        integer         not null default 0,
  output_tokens       integer         not null default 0,
  cache_read_tokens   integer         not null default 0,
  cache_write_tokens  integer         not null default 0,

  -- estimated cost in USD at time of call (see logUsage.ts for pricing table)
  cost_usd            numeric(10, 8)  not null default 0
);

-- Fast per-brand time-range scans (monthly aggregation in admin dashboard)
create index if not exists ai_usage_logs_brand_created
  on postflow.ai_usage_logs (brand_id, created_at desc);

-- Global time-range scans (admin dashboard full-month queries)
create index if not exists ai_usage_logs_created_at
  on postflow.ai_usage_logs (created_at desc);

comment on table postflow.ai_usage_logs is
  'Append-only log of every Claude API call made by PostFlow. Used for cost attribution per brand.';
