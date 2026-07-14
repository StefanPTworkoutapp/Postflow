export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  postflow: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          mollie_customer_id: string | null
          name: string | null
          stripe_customer_id: string | null
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          mollie_customer_id?: string | null
          name?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          mollie_customer_id?: string | null
          name?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_budget_events: {
        Row: {
          account_id: string
          cap_usd: number
          created_at: string
          id: string
          plan: string
          spent_usd: number
          verdict: string
        }
        Insert: {
          account_id: string
          cap_usd: number
          created_at?: string
          id?: string
          plan: string
          spent_usd: number
          verdict: string
        }
        Update: {
          account_id?: string
          cap_usd?: number
          created_at?: string
          id?: string
          plan?: string
          spent_usd?: number
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_budget_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          brand_id: string | null
          cache_read_tokens: number
          cache_write_tokens: number
          cost_usd: number
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
        }
        Insert: {
          brand_id?: string | null
          cache_read_tokens?: number
          cache_write_tokens?: number
          cost_usd?: number
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
        }
        Update: {
          brand_id?: string | null
          cache_read_tokens?: number
          cache_write_tokens?: number
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_processed: {
        Row: {
          brand_id: string
          id: string
          platform: string
          post_id: string
          processed_at: string
          signals_applied: number
        }
        Insert: {
          brand_id: string
          id?: string
          platform: string
          post_id: string
          processed_at?: string
          signals_applied?: number
        }
        Update: {
          brand_id?: string
          id?: string
          platform?: string
          post_id?: string
          processed_at?: string
          signals_applied?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_processed_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_sync_errors: {
        Row: {
          brand_id: string | null
          created_at: string
          error_detail: Json | null
          error_type: string | null
          id: string
          platform: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          error_detail?: Json | null
          error_type?: string | null
          id?: string
          platform?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          error_detail?: Json | null
          error_type?: string | null
          id?: string
          platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_sync_errors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_template_preferences: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          locked: boolean
          post_type: string
          slot_index: number
          template_slug: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          locked?: boolean
          post_type: string
          slot_index: number
          template_slug: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          locked?: boolean
          post_type?: string
          slot_index?: number
          template_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_template_preferences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_token_events: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          new_confidence: number | null
          new_value: string | null
          old_confidence: number | null
          old_value: string | null
          signal_detail: Json | null
          signal_source_id: string | null
          signal_type: string
          token_key: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          new_confidence?: number | null
          new_value?: string | null
          old_confidence?: number | null
          old_value?: string | null
          signal_detail?: Json | null
          signal_source_id?: string | null
          signal_type: string
          token_key: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          new_confidence?: number | null
          new_value?: string | null
          old_confidence?: number | null
          old_value?: string | null
          signal_detail?: Json | null
          signal_source_id?: string | null
          signal_type?: string
          token_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_token_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          accent_color: string
          account_id: string
          ai_tier: string
          brand_kit: Json
          calibration_done_at: string | null
          calibration_status: string
          created_at: string
          custom_do_rules: string | null
          custom_dont_rules: string | null
          description: string | null
          do_not_mention: string[] | null
          emoji_favorites: string | null
          emoji_policy: string
          font_body: string
          font_heading: string
          geographic_location: string | null
          goals: string[] | null
          id: string
          industry: string | null
          intelligence_tokens: Json
          logo_url: string | null
          name: string
          niche: string | null
          posting_frequency: string
          primary_color: string
          primary_goal: string | null
          secondary_color: string
          tagline: string | null
          target_age_range: string | null
          target_audience_description: string | null
          template_style: number
          tone_examples: string[] | null
          tone_profile: Json | null
          tone_suggestion: string | null
          tone_suggestion_at: string | null
          tone_suggestion_type: string | null
          updated_at: string
          voice_updated_at: string | null
          website_url: string | null
        }
        Insert: {
          accent_color?: string
          account_id: string
          ai_tier?: string
          brand_kit?: Json
          calibration_done_at?: string | null
          calibration_status?: string
          created_at?: string
          custom_do_rules?: string | null
          custom_dont_rules?: string | null
          description?: string | null
          do_not_mention?: string[] | null
          emoji_favorites?: string | null
          emoji_policy?: string
          font_body?: string
          font_heading?: string
          geographic_location?: string | null
          goals?: string[] | null
          id?: string
          industry?: string | null
          intelligence_tokens?: Json
          logo_url?: string | null
          name: string
          niche?: string | null
          posting_frequency?: string
          primary_color?: string
          primary_goal?: string | null
          secondary_color?: string
          tagline?: string | null
          target_age_range?: string | null
          target_audience_description?: string | null
          template_style?: number
          tone_examples?: string[] | null
          tone_profile?: Json | null
          tone_suggestion?: string | null
          tone_suggestion_at?: string | null
          tone_suggestion_type?: string | null
          updated_at?: string
          voice_updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          accent_color?: string
          account_id?: string
          ai_tier?: string
          brand_kit?: Json
          calibration_done_at?: string | null
          calibration_status?: string
          created_at?: string
          custom_do_rules?: string | null
          custom_dont_rules?: string | null
          description?: string | null
          do_not_mention?: string[] | null
          emoji_favorites?: string | null
          emoji_policy?: string
          font_body?: string
          font_heading?: string
          geographic_location?: string | null
          goals?: string[] | null
          id?: string
          industry?: string | null
          intelligence_tokens?: Json
          logo_url?: string | null
          name?: string
          niche?: string | null
          posting_frequency?: string
          primary_color?: string
          primary_goal?: string | null
          secondary_color?: string
          tagline?: string | null
          target_age_range?: string | null
          target_audience_description?: string | null
          template_style?: number
          tone_examples?: string[] | null
          tone_profile?: Json | null
          tone_suggestion?: string | null
          tone_suggestion_at?: string | null
          tone_suggestion_type?: string | null
          updated_at?: string
          voice_updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_generation_jobs: {
        Row: {
          brand_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          input: Json
          month: number
          result: Json | null
          status: string
          year: number
        }
        Insert: {
          brand_id: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input: Json
          month: number
          result?: Json | null
          status?: string
          year: number
        }
        Update: {
          brand_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          month?: number
          result?: Json | null
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_generation_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_optimizations: {
        Row: {
          brand_id: string
          change_type: string
          created_at: string
          entry_id: string
          from_value: string | null
          id: string
          reason: string | null
          to_value: string | null
        }
        Insert: {
          brand_id: string
          change_type: string
          created_at?: string
          entry_id: string
          from_value?: string | null
          id?: string
          reason?: string | null
          to_value?: string | null
        }
        Update: {
          brand_id?: string
          change_type?: string
          created_at?: string
          entry_id?: string
          from_value?: string | null
          id?: string
          reason?: string | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_optimizations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_optimizations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "content_calendar"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_forge_clips: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          job_id: string
          order_index: number
          public_url: string | null
          quality_score: number | null
          storage_path: string
          upload_status: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          job_id: string
          order_index?: number
          public_url?: string | null
          quality_score?: number | null
          storage_path: string
          upload_status?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          job_id?: string
          order_index?: number
          public_url?: string | null
          quality_score?: number | null
          storage_path?: string
          upload_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clip_forge_clips_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "clip_forge_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_forge_feedback: {
        Row: {
          brand_id: string
          brand_tokens_snapshot: Json | null
          created_at: string
          id: string
          job_id: string
          processed: boolean
          processed_at: string | null
          rating: string
          tags: string[] | null
        }
        Insert: {
          brand_id: string
          brand_tokens_snapshot?: Json | null
          created_at?: string
          id?: string
          job_id: string
          processed?: boolean
          processed_at?: string | null
          rating: string
          tags?: string[] | null
        }
        Update: {
          brand_id?: string
          brand_tokens_snapshot?: Json | null
          created_at?: string
          id?: string
          job_id?: string
          processed?: boolean
          processed_at?: string | null
          rating?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "clip_forge_feedback_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clip_forge_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "clip_forge_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_forge_jobs: {
        Row: {
          approved_at: string | null
          brand_id: string
          brand_kit_snapshot: Json | null
          brand_tokens_snapshot: Json | null
          created_at: string
          goal: string
          id: string
          input_clips: Json
          music_skipped_reason: string | null
          output_caption: string | null
          output_hashtags: string[] | null
          output_video_url: string | null
          platform: string
          rejected_at: string | null
          render_progress: number
          shotstack_render_id: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          brand_id: string
          brand_kit_snapshot?: Json | null
          brand_tokens_snapshot?: Json | null
          created_at?: string
          goal: string
          id?: string
          input_clips?: Json
          music_skipped_reason?: string | null
          output_caption?: string | null
          output_hashtags?: string[] | null
          output_video_url?: string | null
          platform: string
          rejected_at?: string | null
          render_progress?: number
          shotstack_render_id?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          brand_id?: string
          brand_kit_snapshot?: Json | null
          brand_tokens_snapshot?: Json | null
          created_at?: string
          goal?: string
          id?: string
          input_clips?: Json
          music_skipped_reason?: string | null
          output_caption?: string | null
          output_hashtags?: string[] | null
          output_video_url?: string | null
          platform?: string
          rejected_at?: string | null
          render_progress?: number
          shotstack_render_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clip_forge_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_wizard_progress: {
        Row: {
          brand_id: string
          completed: boolean
          created_at: string
          current_step: number
          id: string
          platform: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          completed?: boolean
          created_at?: string
          current_step?: number
          id?: string
          platform: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          completed?: boolean
          created_at?: string
          current_step?: number
          id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_wizard_progress_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar: {
        Row: {
          brand_id: string
          content_pillar: string | null
          created_at: string
          goal: string | null
          id: string
          media_brief: string | null
          media_urls: string[]
          platforms: string[] | null
          post_type: string | null
          required_media_count: number
          required_media_type: string | null
          scheduled_date: string
          scheduled_time: string | null
          slide_content: Json | null
          status: string
          template_id: string | null
          template_slug: string | null
          timezone: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          content_pillar?: string | null
          created_at?: string
          goal?: string | null
          id?: string
          media_brief?: string | null
          media_urls?: string[]
          platforms?: string[] | null
          post_type?: string | null
          required_media_count?: number
          required_media_type?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          slide_content?: Json | null
          status?: string
          template_id?: string | null
          template_slug?: string | null
          timezone?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          content_pillar?: string | null
          created_at?: string
          goal?: string | null
          id?: string
          media_brief?: string | null
          media_urls?: string[]
          platforms?: string[] | null
          post_type?: string | null
          required_media_count?: number
          required_media_type?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          slide_content?: Json | null
          status?: string
          template_id?: string | null
          template_slug?: string | null
          timezone?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          account_id: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          type: string | null
          upvotes: number
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          type?: string | null
          upvotes?: number
        }
        Update: {
          account_id?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          type?: string | null
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_posts: {
        Row: {
          brand_id: string
          caption: string | null
          engagement: Json | null
          id: string
          imported_at: string
          media_type: string | null
          platform: string
          platform_post_id: string
          posted_at: string | null
        }
        Insert: {
          brand_id: string
          caption?: string | null
          engagement?: Json | null
          id?: string
          imported_at?: string
          media_type?: string | null
          platform: string
          platform_post_id: string
          posted_at?: string | null
        }
        Update: {
          brand_id?: string
          caption?: string | null
          engagement?: Json | null
          id?: string
          imported_at?: string
          media_type?: string | null
          platform?: string
          platform_post_id?: string
          posted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      inspiration_posts: {
        Row: {
          analysis: Json
          applied_at: string | null
          brand_id: string
          created_at: string
          id: string
          platform: string | null
          source_url: string
          token_signals: Json | null
        }
        Insert: {
          analysis: Json
          applied_at?: string | null
          brand_id: string
          created_at?: string
          id?: string
          platform?: string | null
          source_url: string
          token_signals?: Json | null
        }
        Update: {
          analysis?: Json
          applied_at?: string | null
          brand_id?: string
          created_at?: string
          id?: string
          platform?: string | null
          source_url?: string
          token_signals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inspiration_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          invoice_pdf_url: string | null
          issued_at: string | null
          paid_at: string | null
          provider: string
          provider_invoice_id: string
          provider_payment_url: string | null
          status: string
          subscription_id: string | null
          subtotal_cents: number
          total_cents: number
          vat_amount_cents: number
          vat_rate: number
        }
        Insert: {
          account_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_pdf_url?: string | null
          issued_at?: string | null
          paid_at?: string | null
          provider: string
          provider_invoice_id: string
          provider_payment_url?: string | null
          status?: string
          subscription_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          vat_amount_cents?: number
          vat_rate?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_pdf_url?: string | null
          issued_at?: string | null
          paid_at?: string | null
          provider?: string
          provider_invoice_id?: string
          provider_payment_url?: string | null
          status?: string
          subscription_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          vat_amount_cents?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_uploads: {
        Row: {
          ai_description: string | null
          ai_quality_score: number | null
          ai_tags: string[] | null
          aspect_ratio: string | null
          brand_id: string
          created_at: string
          duration_seconds: number | null
          file_size_mb: number | null
          filename: string
          height: number | null
          id: string
          media_type: string | null
          mime_type: string | null
          public_url: string | null
          scheduled_deletion_at: string | null
          storage_path: string
          storage_provider: string | null
          used_in_post_id: string | null
          width: number | null
        }
        Insert: {
          ai_description?: string | null
          ai_quality_score?: number | null
          ai_tags?: string[] | null
          aspect_ratio?: string | null
          brand_id: string
          created_at?: string
          duration_seconds?: number | null
          file_size_mb?: number | null
          filename: string
          height?: number | null
          id?: string
          media_type?: string | null
          mime_type?: string | null
          public_url?: string | null
          scheduled_deletion_at?: string | null
          storage_path: string
          storage_provider?: string | null
          used_in_post_id?: string | null
          width?: number | null
        }
        Update: {
          ai_description?: string | null
          ai_quality_score?: number | null
          ai_tags?: string[] | null
          aspect_ratio?: string | null
          brand_id?: string
          created_at?: string
          duration_seconds?: number | null
          file_size_mb?: number | null
          filename?: string
          height?: number | null
          id?: string
          media_type?: string | null
          mime_type?: string | null
          public_url?: string | null
          scheduled_deletion_at?: string | null
          storage_path?: string
          storage_provider?: string | null
          used_in_post_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_uploads_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploads_used_in_post_fk"
            columns: ["used_in_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      niche_benchmarks: {
        Row: {
          avg_carousel_save_rate: number | null
          avg_carousel_slide_count: number | null
          avg_carousel_swipe_through_rate: number | null
          avg_completion_rate: number | null
          avg_engagement_rate: number | null
          avg_save_rate: number | null
          calculated_at: string
          id: string
          niche_tag: string
          platform: string
          sample_size: number
          top_carousel_content_mix: string | null
          top_template_slugs: string[] | null
        }
        Insert: {
          avg_carousel_save_rate?: number | null
          avg_carousel_slide_count?: number | null
          avg_carousel_swipe_through_rate?: number | null
          avg_completion_rate?: number | null
          avg_engagement_rate?: number | null
          avg_save_rate?: number | null
          calculated_at?: string
          id?: string
          niche_tag: string
          platform: string
          sample_size?: number
          top_carousel_content_mix?: string | null
          top_template_slugs?: string[] | null
        }
        Update: {
          avg_carousel_save_rate?: number | null
          avg_carousel_slide_count?: number | null
          avg_carousel_swipe_through_rate?: number | null
          avg_completion_rate?: number | null
          avg_engagement_rate?: number | null
          avg_save_rate?: number | null
          calculated_at?: string
          id?: string
          niche_tag?: string
          platform?: string
          sample_size?: number
          top_carousel_content_mix?: string | null
          top_template_slugs?: string[] | null
        }
        Relationships: []
      }
      niche_trends: {
        Row: {
          brand_id: string
          expires_at: string | null
          fetched_at: string
          headline: string | null
          id: string
          niche_tags: string[] | null
          relevance_score: number | null
          source: string
          topic: string
          url: string | null
          week_of: string
        }
        Insert: {
          brand_id: string
          expires_at?: string | null
          fetched_at?: string
          headline?: string | null
          id?: string
          niche_tags?: string[] | null
          relevance_score?: number | null
          source: string
          topic: string
          url?: string | null
          week_of: string
        }
        Update: {
          brand_id?: string
          expires_at?: string | null
          fetched_at?: string
          headline?: string | null
          id?: string
          niche_tags?: string[] | null
          relevance_score?: number | null
          source?: string
          topic?: string
          url?: string | null
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "niche_trends_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_patterns: {
        Row: {
          avg_engagement_rate: number | null
          avg_impressions: number | null
          avg_reach: number | null
          best_content_pillars: string[] | null
          best_days_of_week: number[] | null
          best_hours_of_day: number[] | null
          best_post_types: string[] | null
          brand_id: string
          computed_at: string
          id: string
          period_days: number
          period_end: string
          period_start: string
          platform: string
          sample_size: number
          top_hashtags: string[] | null
        }
        Insert: {
          avg_engagement_rate?: number | null
          avg_impressions?: number | null
          avg_reach?: number | null
          best_content_pillars?: string[] | null
          best_days_of_week?: number[] | null
          best_hours_of_day?: number[] | null
          best_post_types?: string[] | null
          brand_id: string
          computed_at?: string
          id?: string
          period_days?: number
          period_end: string
          period_start: string
          platform: string
          sample_size?: number
          top_hashtags?: string[] | null
        }
        Update: {
          avg_engagement_rate?: number | null
          avg_impressions?: number | null
          avg_reach?: number | null
          best_content_pillars?: string[] | null
          best_days_of_week?: number[] | null
          best_hours_of_day?: number[] | null
          best_post_types?: string[] | null
          brand_id?: string
          computed_at?: string
          id?: string
          period_days?: number
          period_end?: string
          period_start?: string
          platform?: string
          sample_size?: number
          top_hashtags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_patterns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_invites: {
        Row: {
          brand_id: string
          created_at: string
          email: string
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          role: string
          token: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          role?: string
          token: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_invites_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      post_analytics: {
        Row: {
          brand_tokens_snapshot: Json | null
          click_through_rate: number | null
          clicks: number
          clip_forge_job_id: string | null
          comments: number
          completion_rate: number | null
          created_at: string
          engagement_rate: number | null
          fetched_at: string
          id: string
          impressions: number
          likes: number
          performance_score: number | null
          post_id: string
          reach: number
          saves: number
          shares: number
          swipe_through_rate: number | null
        }
        Insert: {
          brand_tokens_snapshot?: Json | null
          click_through_rate?: number | null
          clicks?: number
          clip_forge_job_id?: string | null
          comments?: number
          completion_rate?: number | null
          created_at?: string
          engagement_rate?: number | null
          fetched_at?: string
          id?: string
          impressions?: number
          likes?: number
          performance_score?: number | null
          post_id: string
          reach?: number
          saves?: number
          shares?: number
          swipe_through_rate?: number | null
        }
        Update: {
          brand_tokens_snapshot?: Json | null
          click_through_rate?: number | null
          clicks?: number
          clip_forge_job_id?: string | null
          comments?: number
          completion_rate?: number | null
          created_at?: string
          engagement_rate?: number | null
          fetched_at?: string
          id?: string
          impressions?: number
          likes?: number
          performance_score?: number | null
          post_id?: string
          reach?: number
          saves?: number
          shares?: number
          swipe_through_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_clip_forge_job_id_fkey"
            columns: ["clip_forge_job_id"]
            isOneToOne: false
            referencedRelation: "clip_forge_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_render_jobs: {
        Row: {
          brand_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          input: Json
          job_type: string
          post_id: string
          result: Json | null
          status: string
        }
        Insert: {
          brand_id: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input: Json
          job_type: string
          post_id: string
          result?: Json | null
          status?: string
        }
        Update: {
          brand_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          job_type?: string
          post_id?: string
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_render_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_render_jobs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          actual_performance: Json | null
          ai_caption_original: string | null
          brand_id: string
          buffer_post_id: string | null
          calendar_entry_id: string
          caption: string | null
          carousel_image_urls: string[] | null
          client_approval_status: string | null
          client_edits_count: number
          client_reviewed_at: string | null
          client_reviewer_email: string | null
          created_at: string
          cta: string | null
          edit_history: Json[] | null
          generated_image_url: string | null
          hashtags: string[] | null
          id: string
          media_ids: string[] | null
          platform: string
          post_type: string | null
          posted_at: string | null
          posted_url: string | null
          predicted_performance: Json | null
          publish_error: string | null
          publish_mode: string
          reminder_sent_at: string | null
          reminder_song_name: string | null
          reminder_song_vibe: string | null
          scheduled_for: string | null
          slide_content: Json | null
          source_post_id: string | null
          status: string
          template_id: string | null
          template_slug: string | null
          updated_at: string
        }
        Insert: {
          actual_performance?: Json | null
          ai_caption_original?: string | null
          brand_id: string
          buffer_post_id?: string | null
          calendar_entry_id: string
          caption?: string | null
          carousel_image_urls?: string[] | null
          client_approval_status?: string | null
          client_edits_count?: number
          client_reviewed_at?: string | null
          client_reviewer_email?: string | null
          created_at?: string
          cta?: string | null
          edit_history?: Json[] | null
          generated_image_url?: string | null
          hashtags?: string[] | null
          id?: string
          media_ids?: string[] | null
          platform: string
          post_type?: string | null
          posted_at?: string | null
          posted_url?: string | null
          predicted_performance?: Json | null
          publish_error?: string | null
          publish_mode?: string
          reminder_sent_at?: string | null
          reminder_song_name?: string | null
          reminder_song_vibe?: string | null
          scheduled_for?: string | null
          slide_content?: Json | null
          source_post_id?: string | null
          status?: string
          template_id?: string | null
          template_slug?: string | null
          updated_at?: string
        }
        Update: {
          actual_performance?: Json | null
          ai_caption_original?: string | null
          brand_id?: string
          buffer_post_id?: string | null
          calendar_entry_id?: string
          caption?: string | null
          carousel_image_urls?: string[] | null
          client_approval_status?: string | null
          client_edits_count?: number
          client_reviewed_at?: string | null
          client_reviewer_email?: string | null
          created_at?: string
          cta?: string | null
          edit_history?: Json[] | null
          generated_image_url?: string | null
          hashtags?: string[] | null
          id?: string
          media_ids?: string[] | null
          platform?: string
          post_type?: string | null
          posted_at?: string | null
          posted_url?: string | null
          predicted_performance?: Json | null
          publish_error?: string | null
          publish_mode?: string
          reminder_sent_at?: string | null
          reminder_song_name?: string | null
          reminder_song_vibe?: string | null
          scheduled_for?: string | null
          slide_content?: Json | null
          source_post_id?: string | null
          status?: string
          template_id?: string | null
          template_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_calendar_entry_id_fkey"
            columns: ["calendar_entry_id"]
            isOneToOne: false
            referencedRelation: "content_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      render_credit_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          job_id: string | null
          reason: string
          stripe_pi: string | null
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          job_id?: string | null
          reason: string
          stripe_pi?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          job_id?: string | null
          reason?: string
          stripe_pi?: string | null
        }
        Relationships: []
      }
      research_runs: {
        Row: {
          id: string
          niche: string
          platform: string
          ran_at: string
          signals_found: number
        }
        Insert: {
          id?: string
          niche: string
          platform: string
          ran_at?: string
          signals_found?: number
        }
        Update: {
          id?: string
          niche?: string
          platform?: string
          ran_at?: string
          signals_found?: number
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string | null
          account_handle: string | null
          account_url: string | null
          brand_id: string
          buffer_profile_id: string | null
          created_at: string
          id: string
          is_active: boolean
          platform: string
          platform_access_token: string | null
          platform_account_id: string | null
          refresh_token: string | null
          token_expires_at: string | null
        }
        Insert: {
          access_token?: string | null
          account_handle?: string | null
          account_url?: string | null
          brand_id: string
          buffer_profile_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          platform: string
          platform_access_token?: string | null
          platform_account_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
        }
        Update: {
          access_token?: string | null
          account_handle?: string | null
          account_url?: string | null
          brand_id?: string
          buffer_profile_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: string
          platform_access_token?: string | null
          platform_account_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_id: string
          amount_cents: number | null
          billing_cycle: string | null
          billing_interval: string | null
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          external_subscription_id: string | null
          id: string
          mollie_subscription_id: string | null
          plan: string | null
          provider: string | null
          status: string | null
          storage_addon_gb: number
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount_cents?: number | null
          billing_cycle?: string | null
          billing_interval?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id?: string | null
          id?: string
          mollie_subscription_id?: string | null
          plan?: string | null
          provider?: string | null
          status?: string | null
          storage_addon_gb?: number
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number | null
          billing_cycle?: string | null
          billing_interval?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id?: string | null
          id?: string
          mollie_subscription_id?: string | null
          plan?: string | null
          provider?: string | null
          status?: string | null
          storage_addon_gb?: number
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          ended_at: string | null
          error_count: number
          id: string
          platform: string
          started_at: string
          status: string
          success_count: number
          user_count_attempted: number
        }
        Insert: {
          ended_at?: string | null
          error_count?: number
          id?: string
          platform: string
          started_at?: string
          status?: string
          success_count?: number
          user_count_attempted?: number
        }
        Update: {
          ended_at?: string | null
          error_count?: number
          id?: string
          platform?: string
          started_at?: string
          status?: string
          success_count?: number
          user_count_attempted?: number
        }
        Relationships: []
      }
      template_health: {
        Row: {
          avg_completion_rate: number | null
          avg_engagement_rate: number | null
          avg_save_rate: number | null
          brand_id: string
          created_at: string
          health_score: number
          id: string
          last_checked_at: string | null
          locked_by_user: boolean
          mode: string
          next_check_at: string
          platform: string
          posts_count: number
          template_slug: string
          trend: string
        }
        Insert: {
          avg_completion_rate?: number | null
          avg_engagement_rate?: number | null
          avg_save_rate?: number | null
          brand_id: string
          created_at?: string
          health_score?: number
          id?: string
          last_checked_at?: string | null
          locked_by_user?: boolean
          mode?: string
          next_check_at?: string
          platform: string
          posts_count?: number
          template_slug: string
          trend?: string
        }
        Update: {
          avg_completion_rate?: number | null
          avg_engagement_rate?: number | null
          avg_save_rate?: number | null
          brand_id?: string
          created_at?: string
          health_score?: number
          id?: string
          last_checked_at?: string | null
          locked_by_user?: boolean
          mode?: string
          next_check_at?: string
          platform?: string
          posts_count?: number
          template_slug?: string
          trend?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_health_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      template_suggestions: {
        Row: {
          applied: boolean
          applied_at: string | null
          applied_reason: string | null
          brand_id: string
          created_at: string
          current_score: number | null
          current_slug: string
          dismissed_count: number
          expires_at: string | null
          id: string
          platform: string
          preview_render_url: string | null
          reason: string
          responded_at: string | null
          status: string
          suggested_score: number | null
          suggested_slug: string
          swapped_slots: Json | null
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          applied_reason?: string | null
          brand_id: string
          created_at?: string
          current_score?: number | null
          current_slug: string
          dismissed_count?: number
          expires_at?: string | null
          id?: string
          platform: string
          preview_render_url?: string | null
          reason: string
          responded_at?: string | null
          status?: string
          suggested_score?: number | null
          suggested_slug: string
          swapped_slots?: Json | null
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          applied_reason?: string | null
          brand_id?: string
          created_at?: string
          current_score?: number | null
          current_slug?: string
          dismissed_count?: number
          expires_at?: string | null
          id?: string
          platform?: string
          preview_render_url?: string | null
          reason?: string
          responded_at?: string | null
          status?: string
          suggested_score?: number | null
          suggested_slug?: string
          swapped_slots?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "template_suggestions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          brand_id: string | null
          config: Json | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          platforms: string[] | null
          slug: string
          sort_order: number
          thumbnail_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          platforms?: string[] | null
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          platforms?: string[] | null
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      tone_feedback: {
        Row: {
          applied_to_future: boolean
          brand_id: string
          created_at: string
          feedback_type: string | null
          id: string
          immediate_nudge_applied: boolean
          pattern_detected: string | null
          post_id: string | null
          user_comment: string | null
        }
        Insert: {
          applied_to_future?: boolean
          brand_id: string
          created_at?: string
          feedback_type?: string | null
          id?: string
          immediate_nudge_applied?: boolean
          pattern_detected?: string | null
          post_id?: string | null
          user_comment?: string | null
        }
        Update: {
          applied_to_future?: boolean
          brand_id?: string
          created_at?: string
          feedback_type?: string | null
          id?: string
          immediate_nudge_applied?: boolean
          pattern_detected?: string | null
          post_id?: string | null
          user_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tone_feedback_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tone_feedback_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_builder_jobs: {
        Row: {
          approved_at: string | null
          brand_id: string
          chosen_version: string | null
          created_at: string
          id: string
          output_caption: string | null
          output_hashtags: string[] | null
          regenerate_nudge: string | null
          regenerated: boolean
          rejected_at: string | null
          render_progress: number
          selected_concept_id: string | null
          status: string
          version_a_tokens_snapshot: Json | null
          version_a_url: string | null
          version_b_tokens_snapshot: Json | null
          version_b_url: string | null
        }
        Insert: {
          approved_at?: string | null
          brand_id: string
          chosen_version?: string | null
          created_at?: string
          id?: string
          output_caption?: string | null
          output_hashtags?: string[] | null
          regenerate_nudge?: string | null
          regenerated?: boolean
          rejected_at?: string | null
          render_progress?: number
          selected_concept_id?: string | null
          status?: string
          version_a_tokens_snapshot?: Json | null
          version_a_url?: string | null
          version_b_tokens_snapshot?: Json | null
          version_b_url?: string | null
        }
        Update: {
          approved_at?: string | null
          brand_id?: string
          chosen_version?: string | null
          created_at?: string
          id?: string
          output_caption?: string | null
          output_hashtags?: string[] | null
          regenerate_nudge?: string | null
          regenerated?: boolean
          rejected_at?: string | null
          render_progress?: number
          selected_concept_id?: string | null
          status?: string
          version_a_tokens_snapshot?: Json | null
          version_a_url?: string | null
          version_b_tokens_snapshot?: Json | null
          version_b_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_builder_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_concepts: {
        Row: {
          brand_fit_score: number | null
          brand_id: string
          concept_index: number
          created_at: string
          description: string
          format_spec: Json | null
          id: string
          job_id: string
          niche_trend_id: string | null
          platform: string
          selected: boolean
          title: string
        }
        Insert: {
          brand_fit_score?: number | null
          brand_id: string
          concept_index?: number
          created_at?: string
          description: string
          format_spec?: Json | null
          id?: string
          job_id: string
          niche_trend_id?: string | null
          platform: string
          selected?: boolean
          title: string
        }
        Update: {
          brand_fit_score?: number | null
          brand_id?: string
          concept_index?: number
          created_at?: string
          description?: string
          format_spec?: Json | null
          id?: string
          job_id?: string
          niche_trend_id?: string | null
          platform?: string
          selected?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_concepts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_concepts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trend_builder_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_concepts_niche_trend_id_fkey"
            columns: ["niche_trend_id"]
            isOneToOne: false
            referencedRelation: "niche_trends"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_feedback: {
        Row: {
          brand_id: string
          brand_tokens_snapshot: Json | null
          chosen_version: string | null
          created_at: string
          id: string
          job_id: string
          processed: boolean
          processed_at: string | null
          rating: string
          tags: string[] | null
        }
        Insert: {
          brand_id: string
          brand_tokens_snapshot?: Json | null
          chosen_version?: string | null
          created_at?: string
          id?: string
          job_id: string
          processed?: boolean
          processed_at?: string | null
          rating: string
          tags?: string[] | null
        }
        Update: {
          brand_id?: string
          brand_tokens_snapshot?: Json | null
          chosen_version?: string | null
          created_at?: string
          id?: string
          job_id?: string
          processed?: boolean
          processed_at?: string | null
          rating?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_feedback_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trend_builder_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  postflow: {
    Enums: {},
  },
} as const
