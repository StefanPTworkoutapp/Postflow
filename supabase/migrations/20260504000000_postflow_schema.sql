-- PostFlow schema migration
-- Creates the 'postflow' schema and all 10 tables.
-- SAFETY: This migration only touches the 'postflow' schema.
--         It does not modify any tables in 'public'.

-- ============================================================
-- SCHEMA
-- ============================================================

CREATE SCHEMA IF NOT EXISTS postflow;

-- ============================================================
-- HELPER: auto-update updated_at on row changes
-- ============================================================

CREATE OR REPLACE FUNCTION postflow.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: accounts
-- Top-level entity, one per signup.
-- ============================================================

CREATE TABLE postflow.accounts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT        UNIQUE NOT NULL,
  name                 TEXT,
  subscription_tier    TEXT        NOT NULL DEFAULT 'free'
                                   CHECK (subscription_tier IN ('free', 'starter', 'pro', 'business', 'enterprise')),
  subscription_status  TEXT        NOT NULL DEFAULT 'active'
                                   CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  stripe_customer_id   TEXT,
  mollie_customer_id   TEXT,
  trial_ends_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON postflow.accounts
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();

-- ============================================================
-- TABLE: brands
-- Each account can have multiple brands (MVP = 1 brand).
-- ============================================================

CREATE TABLE postflow.brands (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                   UUID        NOT NULL REFERENCES postflow.accounts(id) ON DELETE CASCADE,
  name                         TEXT        NOT NULL,
  industry                     TEXT,
  niche                        TEXT,
  description                  TEXT,
  tagline                      TEXT,
  website_url                  TEXT,

  -- Visual identity
  logo_url                     TEXT,
  primary_color                TEXT        NOT NULL DEFAULT '#1A203A',
  secondary_color              TEXT        NOT NULL DEFAULT '#A8B8A8',
  accent_color                 TEXT        NOT NULL DEFAULT '#D4E8C8',
  font_heading                 TEXT        NOT NULL DEFAULT 'Montserrat',
  font_body                    TEXT        NOT NULL DEFAULT 'Inter',

  -- Audience
  target_audience_description  TEXT,
  target_age_range             TEXT,
  geographic_location          TEXT,

  -- Goals
  primary_goal                 TEXT        CHECK (primary_goal IN ('lead_generation', 'brand_awareness', 'engagement', 'sales')),
  posting_frequency            TEXT        NOT NULL DEFAULT 'monthly'
                                           CHECK (posting_frequency IN ('weekly', 'monthly')),

  -- Tone of Voice
  tone_profile                 JSONB,
  tone_examples                TEXT[],
  do_not_mention               TEXT[],

  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brands_account_id_idx ON postflow.brands(account_id);

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON postflow.brands
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();

-- ============================================================
-- TABLE: social_accounts
-- Connected social platforms per brand.
-- ============================================================

CREATE TABLE postflow.social_accounts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  platform           TEXT        NOT NULL
                                 CHECK (platform IN ('instagram', 'linkedin', 'facebook', 'tiktok', 'x', 'threads')),
  account_handle     TEXT,
  account_url        TEXT,
  buffer_profile_id  TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT true,

  -- Stored encrypted at the application layer
  access_token       TEXT,
  refresh_token      TEXT,
  token_expires_at   TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX social_accounts_brand_id_idx ON postflow.social_accounts(brand_id);

-- ============================================================
-- TABLE: templates
-- Design templates per brand. 8 defaults ship with MVP.
-- ============================================================

CREATE TABLE postflow.templates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  template_type       TEXT        CHECK (template_type IN ('carousel', 'single_image', 'reel', 'story', 'quote', 'testimonial')),
  platform            TEXT        CHECK (platform IN ('instagram', 'linkedin', 'facebook', 'tiktok', 'x', 'threads', 'pinterest')),
  design_config       JSONB       NOT NULL,
  preview_url         TEXT,
  version_number      INT         NOT NULL DEFAULT 1,
  parent_template_id  UUID        REFERENCES postflow.templates(id),
  is_default          BOOLEAN     NOT NULL DEFAULT false,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX templates_brand_id_idx ON postflow.templates(brand_id);

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON postflow.templates
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();

-- ============================================================
-- TABLE: media_uploads
-- Photos and videos uploaded by the user.
-- ============================================================

CREATE TABLE postflow.media_uploads (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  filename                TEXT        NOT NULL,
  storage_provider        TEXT        CHECK (storage_provider IN ('supabase', 'cloudflare_r2')),
  storage_path            TEXT        NOT NULL,
  public_url              TEXT,
  media_type              TEXT        CHECK (media_type IN ('image', 'video')),
  mime_type               TEXT,
  file_size_mb            NUMERIC,
  duration_seconds        INT,
  width                   INT,
  height                  INT,
  aspect_ratio            TEXT        CHECK (aspect_ratio IN ('horizontal', 'vertical', 'square')),

  -- AI analysis
  ai_tags                 TEXT[],
  ai_description          TEXT,
  ai_quality_score        INT         CHECK (ai_quality_score BETWEEN 0 AND 100),

  -- Lifecycle
  used_in_post_id         UUID,       -- FK set after posts table exists (see FK below)
  scheduled_deletion_at   TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX media_uploads_brand_id_idx ON postflow.media_uploads(brand_id);
CREATE INDEX media_uploads_deletion_idx ON postflow.media_uploads(scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;

-- ============================================================
-- TABLE: content_calendar
-- Master plan for upcoming posts.
-- ============================================================

CREATE TABLE postflow.content_calendar (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  scheduled_date        DATE        NOT NULL,
  scheduled_time        TIME,
  timezone              TEXT        NOT NULL DEFAULT 'Europe/Amsterdam',
  topic                 TEXT,
  content_pillar        TEXT        CHECK (content_pillar IN ('education', 'motivation', 'community', 'app_teaser', 'promotional', 'behind_the_scenes')),
  goal                  TEXT        CHECK (goal IN ('engagement', 'conversion', 'brand_awareness', 'lead_generation')),
  platforms             TEXT[],
  template_id           UUID        REFERENCES postflow.templates(id),
  post_type             TEXT        CHECK (post_type IN ('carousel', 'single_image', 'reel', 'story', 'text_only')),
  required_media_count  INT         NOT NULL DEFAULT 1,
  required_media_type   TEXT,
  media_brief           TEXT,
  status                TEXT        NOT NULL DEFAULT 'planned'
                                    CHECK (status IN ('planned', 'media_pending', 'drafting', 'ready', 'scheduled', 'posted', 'archived')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX content_calendar_brand_date_idx ON postflow.content_calendar(brand_id, scheduled_date);

CREATE TRIGGER content_calendar_updated_at
  BEFORE UPDATE ON postflow.content_calendar
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();

-- ============================================================
-- TABLE: posts
-- Generated posts, one per platform variant.
-- ============================================================

CREATE TABLE postflow.posts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  calendar_entry_id     UUID        NOT NULL REFERENCES postflow.content_calendar(id) ON DELETE CASCADE,
  platform              TEXT        NOT NULL
                                    CHECK (platform IN ('instagram', 'linkedin', 'facebook', 'tiktok', 'x', 'threads', 'pinterest')),
  template_id           UUID        REFERENCES postflow.templates(id),

  -- Generated content
  caption               TEXT,
  hashtags              TEXT[],
  cta                   TEXT,

  -- Media
  media_ids             UUID[],
  generated_image_url   TEXT,

  -- Edit history
  ai_caption_original   TEXT,
  client_edits_count    INT         NOT NULL DEFAULT 0,
  edit_history          JSONB[],

  -- Posting
  scheduled_for         TIMESTAMPTZ,
  posted_at             TIMESTAMPTZ,
  buffer_post_id        TEXT,
  posted_url            TEXT,

  status                TEXT        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft', 'ready', 'scheduled', 'posted', 'failed')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX posts_brand_id_idx         ON postflow.posts(brand_id);
CREATE INDEX posts_calendar_entry_idx   ON postflow.posts(calendar_entry_id);
CREATE INDEX posts_status_idx           ON postflow.posts(status);
CREATE INDEX posts_scheduled_for_idx    ON postflow.posts(scheduled_for)
  WHERE scheduled_for IS NOT NULL;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON postflow.posts
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();

-- Add deferred FK: media_uploads.used_in_post_id → posts.id
ALTER TABLE postflow.media_uploads
  ADD CONSTRAINT media_uploads_used_in_post_fk
  FOREIGN KEY (used_in_post_id) REFERENCES postflow.posts(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: post_analytics
-- Performance data per post, updated by daily background job.
-- ============================================================

CREATE TABLE postflow.post_analytics (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID        NOT NULL REFERENCES postflow.posts(id) ON DELETE CASCADE,
  impressions         INT         NOT NULL DEFAULT 0,
  reach               INT         NOT NULL DEFAULT 0,
  likes               INT         NOT NULL DEFAULT 0,
  comments            INT         NOT NULL DEFAULT 0,
  shares              INT         NOT NULL DEFAULT 0,
  saves               INT         NOT NULL DEFAULT 0,
  clicks              INT         NOT NULL DEFAULT 0,
  engagement_rate     NUMERIC,
  click_through_rate  NUMERIC,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performance_score   INT         CHECK (performance_score BETWEEN 0 AND 100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX post_analytics_post_id_idx ON postflow.post_analytics(post_id);

-- ============================================================
-- TABLE: tone_feedback
-- Learning loop — tracks every tone adjustment the user makes.
-- ============================================================

CREATE TABLE postflow.tone_feedback (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  post_id             UUID        REFERENCES postflow.posts(id) ON DELETE SET NULL,
  feedback_type       TEXT        CHECK (feedback_type IN ('too_formal', 'too_casual', 'wrong_voice', 'great', 'cta_weak', 'too_long', 'too_short')),
  user_comment        TEXT,
  pattern_detected    TEXT,
  applied_to_future   BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tone_feedback_brand_id_idx ON postflow.tone_feedback(brand_id);

-- ============================================================
-- TABLE: subscriptions
-- Stripe / Mollie payment tracking.
-- ============================================================

CREATE TABLE postflow.subscriptions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               UUID        NOT NULL REFERENCES postflow.accounts(id) ON DELETE CASCADE,
  provider                 TEXT        CHECK (provider IN ('stripe', 'mollie')),
  external_subscription_id TEXT,
  plan                     TEXT        CHECK (plan IN ('starter', 'pro', 'business', 'enterprise')),
  billing_cycle            TEXT        CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount_cents             INT,
  currency                 TEXT        NOT NULL DEFAULT 'EUR',
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at                TIMESTAMPTZ,
  canceled_at              TIMESTAMPTZ,
  status                   TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX subscriptions_account_id_idx ON postflow.subscriptions(account_id);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON postflow.subscriptions
  FOR EACH ROW EXECUTE FUNCTION postflow.set_updated_at();

-- ============================================================
-- TABLE: feature_requests
-- User feedback and roadmap input.
-- ============================================================

CREATE TABLE postflow.feature_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        REFERENCES postflow.accounts(id) ON DELETE SET NULL,
  type        TEXT        CHECK (type IN ('bug', 'feature', 'feedback')),
  category    TEXT        CHECK (category IN ('ui', 'ai', 'analytics', 'posting', 'billing', 'other')),
  description TEXT        NOT NULL,
  priority    TEXT        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status      TEXT        NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted', 'under_review', 'planned', 'in_progress', 'shipped', 'declined')),
  upvotes     INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Enable RLS on all tables. Policies added once auth is wired.
-- ============================================================

ALTER TABLE postflow.accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.social_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.media_uploads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.post_analytics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.tone_feedback    ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE postflow.feature_requests ENABLE ROW LEVEL SECURITY;
