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
    PostgrestVersion: "13.0.4"
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
          brand_kit: Json
          calibration_done_at: string | null
          calibration_status: string
          created_at: string
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
          website_url: string | null
        }
        Insert: {
          accent_color?: string
          account_id: string
          brand_kit?: Json
          calibration_done_at?: string | null
          calibration_status?: string
          created_at?: string
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
          website_url?: string | null
        }
        Update: {
          accent_color?: string
          account_id?: string
          brand_kit?: Json
          calibration_done_at?: string | null
          calibration_status?: string
          created_at?: string
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
      niche_trends: {
        Row: {
          brand_id: string
          fetched_at: string
          headline: string | null
          id: string
          relevance_score: number | null
          source: string
          topic: string
          url: string | null
          week_of: string
        }
        Insert: {
          brand_id: string
          fetched_at?: string
          headline?: string | null
          id?: string
          relevance_score?: number | null
          source: string
          topic: string
          url?: string | null
          week_of: string
        }
        Update: {
          brand_id?: string
          fetched_at?: string
          headline?: string | null
          id?: string
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
      post_analytics: {
        Row: {
          click_through_rate: number | null
          clicks: number
          comments: number
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
        }
        Insert: {
          click_through_rate?: number | null
          clicks?: number
          comments?: number
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
        }
        Update: {
          click_through_rate?: number | null
          clicks?: number
          comments?: number
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
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          ai_caption_original: string | null
          brand_id: string
          buffer_post_id: string | null
          calendar_entry_id: string
          caption: string | null
          carousel_image_urls: string[] | null
          client_edits_count: number
          created_at: string
          cta: string | null
          edit_history: Json[] | null
          generated_image_url: string | null
          hashtags: string[] | null
          id: string
          media_ids: string[] | null
          platform: string
          posted_at: string | null
          posted_url: string | null
          scheduled_for: string | null
          slide_content: Json | null
          status: string
          template_id: string | null
          template_slug: string | null
          updated_at: string
        }
        Insert: {
          ai_caption_original?: string | null
          brand_id: string
          buffer_post_id?: string | null
          calendar_entry_id: string
          caption?: string | null
          carousel_image_urls?: string[] | null
          client_edits_count?: number
          created_at?: string
          cta?: string | null
          edit_history?: Json[] | null
          generated_image_url?: string | null
          hashtags?: string[] | null
          id?: string
          media_ids?: string[] | null
          platform: string
          posted_at?: string | null
          posted_url?: string | null
          scheduled_for?: string | null
          slide_content?: Json | null
          status?: string
          template_id?: string | null
          template_slug?: string | null
          updated_at?: string
        }
        Update: {
          ai_caption_original?: string | null
          brand_id?: string
          buffer_post_id?: string | null
          calendar_entry_id?: string
          caption?: string | null
          carousel_image_urls?: string[] | null
          client_edits_count?: number
          created_at?: string
          cta?: string | null
          edit_history?: Json[] | null
          generated_image_url?: string | null
          hashtags?: string[] | null
          id?: string
          media_ids?: string[] | null
          platform?: string
          posted_at?: string | null
          posted_url?: string | null
          scheduled_for?: string | null
          slide_content?: Json | null
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
        ]
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
