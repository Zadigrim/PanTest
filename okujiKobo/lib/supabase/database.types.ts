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
  public: {
    Tables: {
      accolades: {
        Row: {
          given_at: string | null
          given_by: string
          giver_institution: string | null
          giver_role: string
          id: string
          nominated_for_rangers_choice: boolean | null
          note: string | null
          rangers_choice_year: number | null
          stamp_id: string
          stop_id: string
          title: string
          user_id: string
        }
        Insert: {
          given_at?: string | null
          given_by: string
          giver_institution?: string | null
          giver_role: string
          id?: string
          nominated_for_rangers_choice?: boolean | null
          note?: string | null
          rangers_choice_year?: number | null
          stamp_id: string
          stop_id: string
          title: string
          user_id: string
        }
        Update: {
          given_at?: string | null
          given_by?: string
          giver_institution?: string | null
          giver_role?: string
          id?: string
          nominated_for_rangers_choice?: boolean | null
          note?: string | null
          rangers_choice_year?: number | null
          stamp_id?: string
          stop_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accolades_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accolades_stamp_id_fkey"
            columns: ["stamp_id"]
            isOneToOne: false
            referencedRelation: "stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accolades_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accolades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      acquisitions: {
        Row: {
          acquired_at: string | null
          id: string
          last_correction_dismissed_at: string | null
          passport_id: string
          price_paid_cents: number | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          acquired_at?: string | null
          id?: string
          last_correction_dismissed_at?: string | null
          passport_id: string
          price_paid_cents?: number | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          acquired_at?: string | null
          id?: string
          last_correction_dismissed_at?: string | null
          passport_id?: string
          price_paid_cents?: number | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisitions_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisitions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_inspection_log: {
        Row: {
          id: string
          inspected_at: string
          inspected_by: string
          passport_creator_id: string
          passport_id: string
        }
        Insert: {
          id?: string
          inspected_at?: string
          inspected_by: string
          passport_creator_id: string
          passport_id: string
        }
        Update: {
          id?: string
          inspected_at?: string
          inspected_by?: string
          passport_creator_id?: string
          passport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_inspection_log_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_inspection_log_passport_creator_id_fkey"
            columns: ["passport_creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_inspection_log_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      card_instances: {
        Row: {
          collector_passport_id: string
          consumed_at: string | null
          id: string
          issued_at: string
          reissue_on_completion: boolean
          sequence: number
          target_count: number
        }
        Insert: {
          collector_passport_id: string
          consumed_at?: string | null
          id?: string
          issued_at?: string
          reissue_on_completion?: boolean
          sequence: number
          target_count: number
        }
        Update: {
          collector_passport_id?: string
          consumed_at?: string | null
          id?: string
          issued_at?: string
          reissue_on_completion?: boolean
          sequence?: number
          target_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_instances_collector_passport_id_fkey"
            columns: ["collector_passport_id"]
            isOneToOne: false
            referencedRelation: "collector_passports"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_passports: {
        Row: {
          acquired_at: string
          acquired_demo: boolean
          completed_at: string | null
          copy_number: number | null
          expires_at: string | null
          id: string
          last_correction_dismissed_at: string | null
          passport_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          acquired_demo?: boolean
          completed_at?: string | null
          copy_number?: number | null
          expires_at?: string | null
          id?: string
          last_correction_dismissed_at?: string | null
          passport_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          acquired_demo?: boolean
          completed_at?: string | null
          copy_number?: number | null
          expires_at?: string | null
          id?: string
          last_correction_dismissed_at?: string | null
          passport_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collector_passports_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_passports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_subscriptions: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string
          id: string
          note: string | null
          revoked_at: string | null
          tier: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by: string
          id?: string
          note?: string | null
          revoked_at?: string | null
          tier: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string
          id?: string
          note?: string | null
          revoked_at?: string | null
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_subscriptions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_tokens: {
        Row: {
          distribution_location_id: string | null
          distribution_logged_at: string | null
          distribution_logged_by: string | null
          distribution_pending: boolean | null
          expires_at: string
          extra_gift_card_cents: number | null
          generated_at: string | null
          id: string
          location_whitelist: string[] | null
          page_id: string
          passport_id: string
          prize_distributed: boolean | null
          prize_given: string | null
          prize_note: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          token_code: string
          user_id: string
        }
        Insert: {
          distribution_location_id?: string | null
          distribution_logged_at?: string | null
          distribution_logged_by?: string | null
          distribution_pending?: boolean | null
          expires_at?: string
          extra_gift_card_cents?: number | null
          generated_at?: string | null
          id?: string
          location_whitelist?: string[] | null
          page_id: string
          passport_id: string
          prize_distributed?: boolean | null
          prize_given?: string | null
          prize_note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          token_code: string
          user_id: string
        }
        Update: {
          distribution_location_id?: string | null
          distribution_logged_at?: string | null
          distribution_logged_by?: string | null
          distribution_pending?: boolean | null
          expires_at?: string
          extra_gift_card_cents?: number | null
          generated_at?: string | null
          id?: string
          location_whitelist?: string[] | null
          page_id?: string
          passport_id?: string
          prize_distributed?: boolean | null
          prize_given?: string | null
          prize_note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          token_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_tokens_distribution_logged_by_fkey"
            columns: ["distribution_logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_tokens_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "passport_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_tokens_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_tokens_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_certifications: {
        Row: {
          completed_at: string | null
          id: string
          module: string
          portfolio_page_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          module: string
          portfolio_page_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          module?: string
          portfolio_page_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_certifications_portfolio_page_id_fkey"
            columns: ["portfolio_page_id"]
            isOneToOne: false
            referencedRelation: "passport_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_quality_scores: {
        Row: {
          avg_mood_rating: number | null
          completion_rate: number | null
          composite_score: number | null
          computed_at: string | null
          expert_signoff_rate: number | null
          id: string
          passport_id: string
          pool_share_cents: number | null
          return_visit_rate: number | null
        }
        Insert: {
          avg_mood_rating?: number | null
          completion_rate?: number | null
          composite_score?: number | null
          computed_at?: string | null
          expert_signoff_rate?: number | null
          id?: string
          passport_id: string
          pool_share_cents?: number | null
          return_visit_rate?: number | null
        }
        Update: {
          avg_mood_rating?: number | null
          completion_rate?: number | null
          composite_score?: number | null
          computed_at?: string | null
          expert_signoff_rate?: number | null
          id?: string
          passport_id?: string
          pool_share_cents?: number | null
          return_visit_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_quality_scores_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      design_assets: {
        Row: {
          asset_type: string
          bytes_size: number | null
          created_at: string | null
          display_name: string | null
          file_format: string | null
          height_px: number | null
          id: string
          institution_id: string | null
          is_built_in: boolean
          is_monochrome: boolean | null
          metadata: Json | null
          name: string | null
          owner_id: string
          parent_asset_id: string | null
          scoped_passport_id: string | null
          storage_path: string | null
          thumbnail_data: string | null
          url: string | null
          width_px: number | null
        }
        Insert: {
          asset_type: string
          bytes_size?: number | null
          created_at?: string | null
          display_name?: string | null
          file_format?: string | null
          height_px?: number | null
          id?: string
          institution_id?: string | null
          is_built_in?: boolean
          is_monochrome?: boolean | null
          metadata?: Json | null
          name?: string | null
          owner_id: string
          parent_asset_id?: string | null
          scoped_passport_id?: string | null
          storage_path?: string | null
          thumbnail_data?: string | null
          url?: string | null
          width_px?: number | null
        }
        Update: {
          asset_type?: string
          bytes_size?: number | null
          created_at?: string | null
          display_name?: string | null
          file_format?: string | null
          height_px?: number | null
          id?: string
          institution_id?: string | null
          is_built_in?: boolean
          is_monochrome?: boolean | null
          metadata?: Json | null
          name?: string | null
          owner_id?: string
          parent_asset_id?: string | null
          scoped_passport_id?: string | null
          storage_path?: string | null
          thumbnail_data?: string | null
          url?: string | null
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "design_assets_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "design_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_scoped_passport_id_fkey"
            columns: ["scoped_passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_authorizations: {
        Row: {
          authorized_at: string | null
          authorized_by: string | null
          can_design: boolean
          can_distribute_prizes: boolean | null
          can_manage_billing: boolean
          can_manage_employees: boolean
          can_verify: boolean | null
          can_view_analytics: boolean
          id: string
          institution_id: string
          role_label: string | null
          user_id: string
        }
        Insert: {
          authorized_at?: string | null
          authorized_by?: string | null
          can_design?: boolean
          can_distribute_prizes?: boolean | null
          can_manage_billing?: boolean
          can_manage_employees?: boolean
          can_verify?: boolean | null
          can_view_analytics?: boolean
          id?: string
          institution_id: string
          role_label?: string | null
          user_id: string
        }
        Update: {
          authorized_at?: string | null
          authorized_by?: string | null
          can_design?: boolean
          can_distribute_prizes?: boolean | null
          can_manage_billing?: boolean
          can_manage_employees?: boolean
          can_verify?: boolean | null
          can_view_analytics?: boolean
          id?: string
          institution_id?: string
          role_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_authorizations_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_authorizations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_subscriptions: {
        Row: {
          current_period_end: string | null
          id: string
          institution_id: string
          monthly_price_cents: number | null
          started_at: string | null
          stripe_subscription_id: string | null
          tier: string | null
        }
        Insert: {
          current_period_end?: string | null
          id?: string
          institution_id: string
          monthly_price_cents?: number | null
          started_at?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
        }
        Update: {
          current_period_end?: string | null
          id?: string
          institution_id?: string
          monthly_price_cents?: number | null
          started_at?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_subscriptions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address_city: string | null
          address_line1: string | null
          address_state: string | null
          address_zip: string | null
          admin_user_id: string | null
          annual_revenue: number | null
          catalog_url: string | null
          charges_admission: boolean | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          institution_type: string | null
          internal_notes: string | null
          logo_url: string | null
          marketing_spend: number | null
          municipality_population: number | null
          name: string
          pricing_model: string | null
          pricing_model_computed: string | null
          pricing_model_locked: boolean
          pricing_model_override_at: string | null
          pricing_model_override_by: string | null
          slug: string
          tier: string
          token_prefix: string
          type: string
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_line1?: string | null
          address_state?: string | null
          address_zip?: string | null
          admin_user_id?: string | null
          annual_revenue?: number | null
          catalog_url?: string | null
          charges_admission?: boolean | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          institution_type?: string | null
          internal_notes?: string | null
          logo_url?: string | null
          marketing_spend?: number | null
          municipality_population?: number | null
          name: string
          pricing_model?: string | null
          pricing_model_computed?: string | null
          pricing_model_locked?: boolean
          pricing_model_override_at?: string | null
          pricing_model_override_by?: string | null
          slug: string
          tier?: string
          token_prefix?: string
          type?: string
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_line1?: string | null
          address_state?: string | null
          address_zip?: string | null
          admin_user_id?: string | null
          annual_revenue?: number | null
          catalog_url?: string | null
          charges_admission?: boolean | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          institution_type?: string | null
          internal_notes?: string | null
          logo_url?: string | null
          marketing_spend?: number | null
          municipality_population?: number | null
          name?: string
          pricing_model?: string | null
          pricing_model_computed?: string | null
          pricing_model_locked?: boolean
          pricing_model_override_at?: string | null
          pricing_model_override_by?: string | null
          slug?: string
          tier?: string
          token_prefix?: string
          type?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutions_pricing_model_override_by_fkey"
            columns: ["pricing_model_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          body: string | null
          created_at: string
          id: string
          input_method: string | null
          is_shared: boolean | null
          mood_rating: number | null
          photo_urls: string[] | null
          stamp_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          input_method?: string | null
          is_shared?: boolean | null
          mood_rating?: number | null
          photo_urls?: string[] | null
          stamp_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          input_method?: string | null
          is_shared?: boolean | null
          mood_rating?: number | null
          photo_urls?: string[] | null
          stamp_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_stamp_id_fkey"
            columns: ["stamp_id"]
            isOneToOne: false
            referencedRelation: "stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_photos: {
        Row: {
          byte_size: number | null
          created_at: string
          height_after: number | null
          height_before: number | null
          id: string
          journal_entry_id: string
          original_filename: string | null
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
          width_after: number | null
          width_before: number | null
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          height_after?: number | null
          height_before?: number | null
          id?: string
          journal_entry_id: string
          original_filename?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
          width_after?: number | null
          width_before?: number | null
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          height_after?: number | null
          height_before?: number | null
          id?: string
          journal_entry_id?: string
          original_filename?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          width_after?: number | null
          width_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_photos_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_sharing_terms: {
        Row: {
          agreed_at: string | null
          from_user_id: string
          id: string
          journey_id: string
          reveal_date: string | null
          to_user_id: string
          visibility: string | null
        }
        Insert: {
          agreed_at?: string | null
          from_user_id: string
          id?: string
          journey_id: string
          reveal_date?: string | null
          to_user_id: string
          visibility?: string | null
        }
        Update: {
          agreed_at?: string | null
          from_user_id?: string
          id?: string
          journey_id?: string
          reveal_date?: string | null
          to_user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_sharing_terms_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_sharing_terms_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_sharing_terms_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_members: {
        Row: {
          joined_at: string | null
          journey_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          joined_at?: string | null
          journey_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          joined_at?: string | null
          journey_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_members_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          passport_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          passport_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          passport_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_ratings: {
        Row: {
          id: string
          rated_at: string | null
          rating: number | null
          stamp_id: string
          user_id: string
        }
        Insert: {
          id?: string
          rated_at?: string | null
          rating?: number | null
          stamp_id: string
          user_id: string
        }
        Update: {
          id?: string
          rated_at?: string | null
          rating?: number | null
          stamp_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_ratings_stamp_id_fkey"
            columns: ["stamp_id"]
            isOneToOne: false
            referencedRelation: "stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_acquisition_ledger: {
        Row: {
          id: string
          occurred_at: string
          original_user_id: string | null
          passport_id: string
          recorded_at: string
          source: string
        }
        Insert: {
          id?: string
          occurred_at?: string
          original_user_id?: string | null
          passport_id: string
          recorded_at?: string
          source: string
        }
        Update: {
          id?: string
          occurred_at?: string
          original_user_id?: string | null
          passport_id?: string
          recorded_at?: string
          source?: string
        }
        Relationships: []
      }
      passport_autosaves: {
        Row: {
          design_state: Json
          id: string
          passport_id: string
          saved_at: string | null
        }
        Insert: {
          design_state: Json
          id?: string
          passport_id: string
          saved_at?: string | null
        }
        Update: {
          design_state?: Json
          id?: string
          passport_id?: string
          saved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passport_autosaves_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_pages: {
        Row: {
          background_color: string | null
          background_image_url: string | null
          background_opacity: number | null
          background_type: string | null
          closed_at: string | null
          created_at: string
          custom_background_opacity: number
          elements: Json
          id: string
          page_number: number | null
          page_order: number
          page_type: string | null
          paper_color: string | null
          passport_id: string
          prize_description: string | null
          prize_location_constraint: string | null
          prize_redeemable_location_ids: string[] | null
          section_name: string
          section_subtitle: string | null
          section_tagline: string | null
          section_title: string | null
        }
        Insert: {
          background_color?: string | null
          background_image_url?: string | null
          background_opacity?: number | null
          background_type?: string | null
          closed_at?: string | null
          created_at?: string
          custom_background_opacity?: number
          elements?: Json
          id?: string
          page_number?: number | null
          page_order?: number
          page_type?: string | null
          paper_color?: string | null
          passport_id: string
          prize_description?: string | null
          prize_location_constraint?: string | null
          prize_redeemable_location_ids?: string[] | null
          section_name: string
          section_subtitle?: string | null
          section_tagline?: string | null
          section_title?: string | null
        }
        Update: {
          background_color?: string | null
          background_image_url?: string | null
          background_opacity?: number | null
          background_type?: string | null
          closed_at?: string | null
          created_at?: string
          custom_background_opacity?: number
          elements?: Json
          id?: string
          page_number?: number | null
          page_order?: number
          page_type?: string | null
          paper_color?: string | null
          passport_id?: string
          prize_description?: string | null
          prize_location_constraint?: string | null
          prize_redeemable_location_ids?: string[] | null
          section_name?: string
          section_subtitle?: string | null
          section_tagline?: string | null
          section_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passport_pages_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_published_snapshots: {
        Row: {
          id: string
          passport_id: string
          published_at: string
          published_by: string | null
          snapshot: Json
        }
        Insert: {
          id?: string
          passport_id: string
          published_at?: string
          published_by?: string | null
          snapshot: Json
        }
        Update: {
          id?: string
          passport_id?: string
          published_at?: string
          published_by?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "passport_published_snapshots_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_published_snapshots_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_republish_log: {
        Row: {
          admin_override: boolean
          admin_override_by: string | null
          diff_summary: Json
          factual_text_flagged: boolean
          id: string
          justification: string
          passport_id: string
          republished_at: string
          republished_by: string | null
          what_changed: string
        }
        Insert: {
          admin_override?: boolean
          admin_override_by?: string | null
          diff_summary: Json
          factual_text_flagged?: boolean
          id?: string
          justification: string
          passport_id: string
          republished_at?: string
          republished_by?: string | null
          what_changed: string
        }
        Update: {
          admin_override?: boolean
          admin_override_by?: string | null
          diff_summary?: Json
          factual_text_flagged?: boolean
          id?: string
          justification?: string
          passport_id?: string
          republished_at?: string
          republished_by?: string | null
          what_changed?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_republish_log_admin_override_by_fkey"
            columns: ["admin_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_republish_log_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_republish_log_republished_by_fkey"
            columns: ["republished_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_retention_log: {
        Row: {
          actor_id: string | null
          at: string
          from_state: string | null
          id: string
          passport_id: string
          passport_title: string | null
          reason: string | null
          to_state: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          from_state?: string | null
          id?: string
          passport_id: string
          passport_title?: string | null
          reason?: string | null
          to_state: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          from_state?: string | null
          id?: string
          passport_id?: string
          passport_title?: string | null
          reason?: string | null
          to_state?: string
        }
        Relationships: []
      }
      passport_transfers: {
        Row: {
          from_creator_id: string | null
          from_proprietor_id: string | null
          id: string
          initiated_at: string
          initiated_by: string
          note: string | null
          passport_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          to_institution_id: string | null
          to_user_id: string | null
        }
        Insert: {
          from_creator_id?: string | null
          from_proprietor_id?: string | null
          id?: string
          initiated_at?: string
          initiated_by: string
          note?: string | null
          passport_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          to_institution_id?: string | null
          to_user_id?: string | null
        }
        Update: {
          from_creator_id?: string | null
          from_proprietor_id?: string | null
          id?: string
          initiated_at?: string
          initiated_by?: string
          note?: string | null
          passport_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          to_institution_id?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passport_transfers_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_transfers_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_transfers_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_transfers_to_institution_id_fkey"
            columns: ["to_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_transfers_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passports: {
        Row: {
          consumable_target_count: number | null
          cover_bg_color: string
          cover_bg_type: string
          cover_emblem: string | null
          cover_image_url: string | null
          cover_inside_data: Json | null
          cover_outside_data: Json | null
          cover_paper_color: string | null
          cover_template: string | null
          cover_thumbnail: string | null
          cover_thumbnail_url: string | null
          created_at: string
          creator_id: string
          credential_type: string
          description: string | null
          design_state: Json | null
          design_state_updated_at: string | null
          distribution_only: boolean
          estimated_hours: number | null
          traveler_types: string[] | null
          award_year: number | null
          shortlisted: boolean
          expected_spend_note: string | null
          expected_spend_tier: string | null
          expiry_duration_days: number | null
          id: string
          illus_color: string | null
          illus_opacity: number
          illus_type: string | null
          institution_id: string | null
          is_demo: boolean
          is_free: boolean
          is_published: boolean
          last_edited_at: string | null
          last_edited_by: string | null
          next_copy_number: number
          page_image_urls: Json | null
          paper_color: string
          passport_type: string
          price_cents: number
          print_certificate: boolean | null
          print_enabled: boolean | null
          print_journal_setting: string | null
          proprietor_id: string | null
          published_at: string | null
          retention_deleted_at: string | null
          retention_flagged_at: string | null
          retention_grace_until: string | null
          retention_reason: string | null
          retention_state: string
          show_copy_number: boolean
          status: string | null
          title: string
          transit_accessible: boolean | null
          updated_at: string
          wheelchair_accessible: boolean | null
        }
        Insert: {
          consumable_target_count?: number | null
          cover_bg_color?: string
          cover_bg_type?: string
          cover_emblem?: string | null
          cover_image_url?: string | null
          cover_inside_data?: Json | null
          cover_outside_data?: Json | null
          cover_paper_color?: string | null
          cover_template?: string | null
          cover_thumbnail?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string
          creator_id: string
          credential_type?: string
          description?: string | null
          design_state?: Json | null
          design_state_updated_at?: string | null
          distribution_only?: boolean
          estimated_hours?: number | null
          traveler_types?: string[] | null
          award_year?: number | null
          shortlisted?: boolean
          expected_spend_note?: string | null
          expected_spend_tier?: string | null
          expiry_duration_days?: number | null
          id?: string
          illus_color?: string | null
          illus_opacity?: number
          illus_type?: string | null
          institution_id?: string | null
          is_demo?: boolean
          is_free?: boolean
          is_published?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          next_copy_number?: number
          page_image_urls?: Json | null
          paper_color?: string
          passport_type?: string
          price_cents?: number
          print_certificate?: boolean | null
          print_enabled?: boolean | null
          print_journal_setting?: string | null
          proprietor_id?: string | null
          published_at?: string | null
          retention_deleted_at?: string | null
          retention_flagged_at?: string | null
          retention_grace_until?: string | null
          retention_reason?: string | null
          retention_state?: string
          show_copy_number?: boolean
          status?: string | null
          title: string
          transit_accessible?: boolean | null
          updated_at?: string
          wheelchair_accessible?: boolean | null
        }
        Update: {
          consumable_target_count?: number | null
          cover_bg_color?: string
          cover_bg_type?: string
          cover_emblem?: string | null
          cover_image_url?: string | null
          cover_inside_data?: Json | null
          cover_outside_data?: Json | null
          cover_paper_color?: string | null
          cover_template?: string | null
          cover_thumbnail?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string
          creator_id?: string
          credential_type?: string
          description?: string | null
          design_state?: Json | null
          design_state_updated_at?: string | null
          distribution_only?: boolean
          estimated_hours?: number | null
          traveler_types?: string[] | null
          award_year?: number | null
          shortlisted?: boolean
          expected_spend_note?: string | null
          expected_spend_tier?: string | null
          expiry_duration_days?: number | null
          id?: string
          illus_color?: string | null
          illus_opacity?: number
          illus_type?: string | null
          institution_id?: string | null
          is_demo?: boolean
          is_free?: boolean
          is_published?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          next_copy_number?: number
          page_image_urls?: Json | null
          paper_color?: string
          passport_type?: string
          price_cents?: number
          print_certificate?: boolean | null
          print_enabled?: boolean | null
          print_journal_setting?: string | null
          proprietor_id?: string | null
          published_at?: string | null
          retention_deleted_at?: string | null
          retention_flagged_at?: string | null
          retention_grace_until?: string | null
          retention_reason?: string | null
          retention_state?: string
          show_copy_number?: boolean
          status?: string | null
          title?: string
          transit_accessible?: boolean | null
          updated_at?: string
          wheelchair_accessible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "passports_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passports_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passports_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_sessions: {
        Row: {
          arrived_at: string
          departed_at: string | null
          duration_seconds: number | null
          id: string
          local_timezone: string
          session_number: number | null
          stop_id: string
          user_id: string
        }
        Insert: {
          arrived_at: string
          departed_at?: string | null
          duration_seconds?: number | null
          id?: string
          local_timezone: string
          session_number?: number | null
          stop_id: string
          user_id: string
        }
        Update: {
          arrived_at?: string
          departed_at?: string | null
          duration_seconds?: number | null
          id?: string
          local_timezone?: string
          session_number?: number | null
          stop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_sessions_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          copies: number
          created_at: string | null
          created_by: string | null
          id: string
          institution_id: string
          journal_setting: string
          passport_id: string
          stop_ids: string[]
        }
        Insert: {
          copies: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          institution_id: string
          journal_setting: string
          passport_id: string
          stop_ids: string[]
        }
        Update: {
          copies?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          institution_id?: string
          journal_setting?: string
          passport_id?: string
          stop_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_configurations: {
        Row: {
          configured_at: string | null
          configured_by: string
          id: string
          institution_id: string
          location_whitelist: string[] | null
          page_id: string
          prize_description: string
          prize_value_cents: number | null
        }
        Insert: {
          configured_at?: string | null
          configured_by: string
          id?: string
          institution_id: string
          location_whitelist?: string[] | null
          page_id: string
          prize_description: string
          prize_value_cents?: number | null
        }
        Update: {
          configured_at?: string | null
          configured_by?: string
          id?: string
          institution_id?: string
          location_whitelist?: string[] | null
          page_id?: string
          prize_description?: string
          prize_value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_configurations_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_configurations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_configurations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "passport_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adult_attested_at: string | null
          auth_provider: string | null
          avatar_url: string | null
          bio: string | null
          connect_roles: string[] | null
          created_at: string
          date_of_birth: string | null
          demo_mode_enabled: boolean
          display_name: string
          family_id: string | null
          id: string
          is_platform_admin: boolean
          pro_expires_at: string | null
          pro_source: string | null
          pro_status: string
          role: string
          stripe_connect_account_id: string | null
          studio_expires_at: string | null
          studio_source: string | null
          studio_status: string
          traveler_type: string | null
          updated_at: string
          website_url: string | null
          welcome_seen_at: string | null
        }
        Insert: {
          adult_attested_at?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          bio?: string | null
          connect_roles?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          demo_mode_enabled?: boolean
          display_name: string
          family_id?: string | null
          id: string
          is_platform_admin?: boolean
          pro_expires_at?: string | null
          pro_source?: string | null
          pro_status?: string
          role?: string
          stripe_connect_account_id?: string | null
          studio_expires_at?: string | null
          studio_source?: string | null
          studio_status?: string
          traveler_type?: string | null
          updated_at?: string
          website_url?: string | null
          welcome_seen_at?: string | null
        }
        Update: {
          adult_attested_at?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          bio?: string | null
          connect_roles?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          demo_mode_enabled?: boolean
          display_name?: string
          family_id?: string | null
          id?: string
          is_platform_admin?: boolean
          pro_expires_at?: string | null
          pro_source?: string | null
          pro_status?: string
          role?: string
          stripe_connect_account_id?: string | null
          studio_expires_at?: string | null
          studio_source?: string | null
          studio_status?: string
          traveler_type?: string | null
          updated_at?: string
          website_url?: string | null
          welcome_seen_at?: string | null
        }
        Relationships: []
      }
      punch_slots: {
        Row: {
          box_height: number
          box_width: number
          box_x: number
          box_y: number
          created_at: string
          id: string
          label: string | null
          page_id: string
          rotation: number
          slot_order: number
        }
        Insert: {
          box_height?: number
          box_width?: number
          box_x?: number
          box_y?: number
          created_at?: string
          id?: string
          label?: string | null
          page_id: string
          rotation?: number
          slot_order: number
        }
        Update: {
          box_height?: number
          box_width?: number
          box_x?: number
          box_y?: number
          created_at?: string
          id?: string
          label?: string | null
          page_id?: string
          rotation?: number
          slot_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "punch_slots_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "passport_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      punches: {
        Row: {
          card_instance_id: string
          geohash: string | null
          id: string
          punch_sequence: number
          punched_at: string
          stamp_pos_x: number | null
          stamp_pos_y: number | null
          stop_id: string
          user_id: string
          verification_method: string | null
        }
        Insert: {
          card_instance_id: string
          geohash?: string | null
          id?: string
          punch_sequence: number
          punched_at?: string
          stamp_pos_x?: number | null
          stamp_pos_y?: number | null
          stop_id: string
          user_id: string
          verification_method?: string | null
        }
        Update: {
          card_instance_id?: string
          geohash?: string | null
          id?: string
          punch_sequence?: number
          punched_at?: string
          stamp_pos_x?: number | null
          stamp_pos_y?: number | null
          stop_id?: string
          user_id?: string
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punches_card_instance_id_fkey"
            columns: ["card_instance_id"]
            isOneToOne: false
            referencedRelation: "card_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punches_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_recommendations: {
        Row: {
          author: string | null
          catalog_url: string | null
          id: string
          note: string | null
          recommended_at: string | null
          recommended_by: string
          recommender_role: string
          stamp_id: string
          title: string
          user_id: string
        }
        Insert: {
          author?: string | null
          catalog_url?: string | null
          id?: string
          note?: string | null
          recommended_at?: string | null
          recommended_by: string
          recommender_role: string
          stamp_id: string
          title: string
          user_id: string
        }
        Update: {
          author?: string | null
          catalog_url?: string | null
          id?: string
          note?: string | null
          recommended_at?: string | null
          recommended_by?: string
          recommender_role?: string
          stamp_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_recommendations_recommended_by_fkey"
            columns: ["recommended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_recommendations_stamp_id_fkey"
            columns: ["stamp_id"]
            isOneToOne: false
            referencedRelation: "stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spend_verification_log: {
        Row: {
          ai_reasoning: string | null
          ai_suggested_range_high: number | null
          ai_suggested_range_low: number | null
          created_at: string
          creator_decision: string | null
          id: string
          passport_id: string
          requested_tier: string
        }
        Insert: {
          ai_reasoning?: string | null
          ai_suggested_range_high?: number | null
          ai_suggested_range_low?: number | null
          created_at?: string
          creator_decision?: string | null
          id?: string
          passport_id: string
          requested_tier: string
        }
        Update: {
          ai_reasoning?: string | null
          ai_suggested_range_high?: number | null
          ai_suggested_range_low?: number | null
          created_at?: string
          creator_decision?: string | null
          id?: string
          passport_id?: string
          requested_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "spend_verification_log_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_slots: {
        Row: {
          created_at: string
          height_pct: number
          id: string
          page_id: string
          pos_x: number
          pos_y: number
          stop_id: string | null
          width_pct: number
        }
        Insert: {
          created_at?: string
          height_pct?: number
          id?: string
          page_id: string
          pos_x?: number
          pos_y?: number
          stop_id?: string | null
          width_pct?: number
        }
        Update: {
          created_at?: string
          height_pct?: number
          id?: string
          page_id?: string
          pos_x?: number
          pos_y?: number
          stop_id?: string | null
          width_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "stamp_slots_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "passport_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_slots_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stamps: {
        Row: {
          accolade_id: string | null
          collector_passport_id: string
          contact_size_px: number | null
          geohash: string | null
          has_accolade: boolean | null
          id: string
          is_demo: boolean
          passport_id: string | null
          rotation_deg: number | null
          saturation: number | null
          smudge_dx: number | null
          smudge_dy: number | null
          smudge_intensity: number | null
          stamp_pos_x: number | null
          stamp_pos_y: number | null
          stop_id: string
          stop_opened_at: string | null
          tilt_dx: number | null
          tilt_dy: number | null
          tilt_intensity: number | null
          user_id: string
          verification_method: string
          verified_at: string
          verified_by: string | null
          verifier_id: string | null
          verifier_note: string | null
        }
        Insert: {
          accolade_id?: string | null
          collector_passport_id: string
          contact_size_px?: number | null
          geohash?: string | null
          has_accolade?: boolean | null
          id?: string
          is_demo?: boolean
          passport_id?: string | null
          rotation_deg?: number | null
          saturation?: number | null
          smudge_dx?: number | null
          smudge_dy?: number | null
          smudge_intensity?: number | null
          stamp_pos_x?: number | null
          stamp_pos_y?: number | null
          stop_id: string
          stop_opened_at?: string | null
          tilt_dx?: number | null
          tilt_dy?: number | null
          tilt_intensity?: number | null
          user_id: string
          verification_method?: string
          verified_at?: string
          verified_by?: string | null
          verifier_id?: string | null
          verifier_note?: string | null
        }
        Update: {
          accolade_id?: string | null
          collector_passport_id?: string
          contact_size_px?: number | null
          geohash?: string | null
          has_accolade?: boolean | null
          id?: string
          is_demo?: boolean
          passport_id?: string | null
          rotation_deg?: number | null
          saturation?: number | null
          smudge_dx?: number | null
          smudge_dy?: number | null
          smudge_intensity?: number | null
          stamp_pos_x?: number | null
          stamp_pos_y?: number | null
          stop_id?: string
          stop_opened_at?: string | null
          tilt_dx?: number | null
          tilt_dy?: number | null
          tilt_intensity?: number | null
          user_id?: string
          verification_method?: string
          verified_at?: string
          verified_by?: string | null
          verifier_id?: string | null
          verifier_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stamps_accolade_id_fkey"
            columns: ["accolade_id"]
            isOneToOne: false
            referencedRelation: "accolades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_collector_passport_id_fkey"
            columns: ["collector_passport_id"]
            isOneToOne: false
            referencedRelation: "collector_passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_verifier_id_fkey"
            columns: ["verifier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          stop_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          stop_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          stop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_acknowledgments_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          reported_at: string | null
          stop_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          reported_at?: string | null
          stop_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          reported_at?: string | null
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_comments_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_imports: {
        Row: {
          id: string
          imported_at: string
          importer_id: string
          source_stop_id: string
          target_stop_id: string
        }
        Insert: {
          id?: string
          imported_at?: string
          importer_id: string
          source_stop_id: string
          target_stop_id: string
        }
        Update: {
          id?: string
          imported_at?: string
          importer_id?: string
          source_stop_id?: string
          target_stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_imports_importer_id_fkey"
            columns: ["importer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_imports_source_stop_id_fkey"
            columns: ["source_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_imports_target_stop_id_fkey"
            columns: ["target_stop_id"]
            isOneToOne: true
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_qr_tokens: {
        Row: {
          consumed_at: string | null
          consumed_by: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          single_use: boolean
          stop_id: string
          token: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          single_use?: boolean
          stop_id: string
          token: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          single_use?: boolean
          stop_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_qr_tokens_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_qr_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_qr_tokens_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_ratings: {
        Row: {
          id: string
          rated_at: string
          rater_id: string
          rating: number
          stop_id: string
        }
        Insert: {
          id?: string
          rated_at?: string
          rater_id: string
          rating: number
          stop_id: string
        }
        Update: {
          id?: string
          rated_at?: string
          rater_id?: string
          rating?: number
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_ratings_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_reviews: {
        Row: {
          attribution: string
          author_id: string
          body: string | null
          created_at: string
          edited_at: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          rating: number
          reported_at: string | null
          stop_id: string
        }
        Insert: {
          attribution: string
          author_id: string
          body?: string | null
          created_at?: string
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          rating: number
          reported_at?: string | null
          stop_id: string
        }
        Update: {
          attribution?: string
          author_id?: string
          body?: string | null
          created_at?: string
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          rating?: number
          reported_at?: string | null
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_reviews_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_reviews_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          attribution_note: string | null
          box_height: number | null
          box_width: number | null
          box_x: number | null
          box_y: number | null
          classifiers: string[] | null
          closed_at: string | null
          country: string | null
          created_at: string
          description: string | null
          evidence_tier: number
          expected_spend_tier: string | null
          experience_type: string | null
          experience_verification_method: string | null
          geohash: string | null
          grade_levels: string[] | null
          id: string
          is_shared: boolean | null
          journal_prompt: string | null
          lat: number | null
          learning_objective: string | null
          lng: number | null
          location_caption_mode: string
          location_caption_placement: string
          location_name: string | null
          location_type: string | null
          name: string
          original_stop_id: string | null
          page_id: string
          print_include_journal: boolean | null
          qr_code_id: string | null
          qr_code_token: string | null
          radius_meters: number
          rotation: number
          shared_at: string | null
          smudge_intensity: string | null
          stamp_asset_id: string | null
          stamp_color: string
          stamp_icon: string
          stamp_rotation_fixed: number | null
          stamp_rotation_max: number | null
          stamp_rotation_min: number | null
          stamp_rotation_range: number | null
          stamp_shape: string
          stamp_smudge: string
          stamp_type: string
          stop_order: number
          subject_areas: string[] | null
          target_location: unknown
          verification_radius_meters: number | null
          verification_tier: number | null
          verification_type: string | null
          year_established: string | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          attribution_note?: string | null
          box_height?: number | null
          box_width?: number | null
          box_x?: number | null
          box_y?: number | null
          classifiers?: string[] | null
          closed_at?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          evidence_tier?: number
          expected_spend_tier?: string | null
          experience_type?: string | null
          experience_verification_method?: string | null
          geohash?: string | null
          grade_levels?: string[] | null
          id?: string
          is_shared?: boolean | null
          journal_prompt?: string | null
          lat?: number | null
          learning_objective?: string | null
          lng?: number | null
          location_caption_mode?: string
          location_caption_placement?: string
          location_name?: string | null
          location_type?: string | null
          name: string
          original_stop_id?: string | null
          page_id: string
          print_include_journal?: boolean | null
          qr_code_id?: string | null
          qr_code_token?: string | null
          radius_meters?: number
          rotation?: number
          shared_at?: string | null
          smudge_intensity?: string | null
          stamp_asset_id?: string | null
          stamp_color?: string
          stamp_icon?: string
          stamp_rotation_fixed?: number | null
          stamp_rotation_max?: number | null
          stamp_rotation_min?: number | null
          stamp_rotation_range?: number | null
          stamp_shape?: string
          stamp_smudge?: string
          stamp_type?: string
          stop_order?: number
          subject_areas?: string[] | null
          target_location?: unknown
          verification_radius_meters?: number | null
          verification_tier?: number | null
          verification_type?: string | null
          year_established?: string | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          attribution_note?: string | null
          box_height?: number | null
          box_width?: number | null
          box_x?: number | null
          box_y?: number | null
          classifiers?: string[] | null
          closed_at?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          evidence_tier?: number
          expected_spend_tier?: string | null
          experience_type?: string | null
          experience_verification_method?: string | null
          geohash?: string | null
          grade_levels?: string[] | null
          id?: string
          is_shared?: boolean | null
          journal_prompt?: string | null
          lat?: number | null
          learning_objective?: string | null
          lng?: number | null
          location_caption_mode?: string
          location_caption_placement?: string
          location_name?: string | null
          location_type?: string | null
          name?: string
          original_stop_id?: string | null
          page_id?: string
          print_include_journal?: boolean | null
          qr_code_id?: string | null
          qr_code_token?: string | null
          radius_meters?: number
          rotation?: number
          shared_at?: string | null
          smudge_intensity?: string | null
          stamp_asset_id?: string | null
          stamp_color?: string
          stamp_icon?: string
          stamp_rotation_fixed?: number | null
          stamp_rotation_max?: number | null
          stamp_rotation_min?: number | null
          stamp_rotation_range?: number | null
          stamp_shape?: string
          stamp_smudge?: string
          stamp_type?: string
          stop_order?: number
          subject_areas?: string[] | null
          target_location?: unknown
          verification_radius_meters?: number | null
          verification_tier?: number | null
          verification_type?: string | null
          year_established?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stops_original_stop_id_fkey"
            columns: ["original_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "passport_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_stamp_asset_id_fkey"
            columns: ["stamp_asset_id"]
            isOneToOne: false
            referencedRelation: "design_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          journal_entry_id: string | null
          note_type: string
          stop_id: string | null
          student_user_id: string
          teacher_user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          journal_entry_id?: string | null
          note_type: string
          stop_id?: string | null
          student_user_id: string
          teacher_user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          journal_entry_id?: string | null
          note_type?: string
          stop_id?: string | null
          student_user_id?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notes_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notes_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notes_teacher_user_id_fkey"
            columns: ["teacher_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount_cents: number
          creator_id: string
          from_user_id: string
          id: string
          note: string | null
          passport_id: string
          stripe_payment_intent_id: string | null
          tipped_at: string | null
        }
        Insert: {
          amount_cents: number
          creator_id: string
          from_user_id: string
          id?: string
          note?: string | null
          passport_id: string
          stripe_payment_intent_id?: string | null
          tipped_at?: string | null
        }
        Update: {
          amount_cents?: number
          creator_id?: string
          from_user_id?: string
          id?: string
          note?: string | null
          passport_id?: string
          stripe_payment_intent_id?: string | null
          tipped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "passports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_passport_transfer: {
        Args: { p_transfer_id: string }
        Returns: Json
      }
      allocate_copy_number: { Args: { p_passport_id: string }; Returns: number }
      attest_adult: { Args: never; Returns: string }
      can_grant_comp_for: { Args: { p_target: string }; Returns: boolean }
      cancel_passport_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      check_gps_within_radius: {
        Args: {
          radius_m: number
          stop_id: string
          user_lat: number
          user_lng: number
        }
        Returns: boolean
      }
      close_user_account: { Args: { target_user_id: string }; Returns: Json }
      consume_stop_qr_token_and_punch: {
        Args: {
          p_lat?: number
          p_lng?: number
          p_stop_opened_at?: string
          p_token: string
        }
        Returns: {
          card_instance_id: string
          geohash: string | null
          id: string
          punch_sequence: number
          punched_at: string
          stamp_pos_x: number | null
          stamp_pos_y: number | null
          stop_id: string
          user_id: string
          verification_method: string | null
        }
        SetofOptions: {
          from: "*"
          to: "punches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      count_asset_references: {
        Args: { p_asset_id: string; p_asset_url: string }
        Returns: number
      }
      decline_passport_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      ensure_collector_passport: {
        Args: { p_demo?: boolean; p_passport_id: string; p_user_id: string }
        Returns: {
          acquired_at: string
          copy_number: number
          expires_at: string
          id: string
          is_new: boolean
        }[]
      }
      ensure_moichido_punch_stop: {
        Args: { p_passport_id: string }
        Returns: string
      }
      find_passports_nearby: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_km?: number
        }
        Returns: {
          cover_bg_color: string
          cover_emblem: string
          cover_thumbnail: string
          creator_id: string
          distance_m: number
          is_free: boolean
          passport_id: string
          price_cents: number
          proprietor_id: string
          stops_in_radius: number
          title: string
        }[]
      }
      generate_completion_token_code: {
        Args: { p_passport_id: string }
        Returns: string
      }
      initiate_passport_transfer: {
        Args: {
          p_note?: string
          p_passport_id: string
          p_to_institution_id: string
          p_to_user_id: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_demo_authorized: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      issue_stop_qr_token: {
        Args: { p_stop_id: string; p_ttl_seconds?: number }
        Returns: string
      }
      list_asset_references: {
        Args: { p_asset_id: string; p_asset_url: string }
        Returns: {
          passport_id: string
          passport_title: string
          reference_kind: string
        }[]
      }
      okuji_custodial_id: { Args: never; Returns: string }
      redeem_completion: {
        Args: {
          p_action: string
          p_extra_cents?: number
          p_note?: string
          p_token_code: string
        }
        Returns: {
          distribution_location_id: string | null
          distribution_logged_at: string | null
          distribution_logged_by: string | null
          distribution_pending: boolean | null
          expires_at: string
          extra_gift_card_cents: number | null
          generated_at: string | null
          id: string
          location_whitelist: string[] | null
          page_id: string
          passport_id: string
          prize_distributed: boolean | null
          prize_given: string | null
          prize_note: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          token_code: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "completion_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_stop_comment: { Args: { p_comment_id: string }; Returns: string }
      report_stop_review: { Args: { p_review_id: string }; Returns: string }
      retention_assert_admin: { Args: never; Returns: undefined }
      retention_flag: { Args: { p_passport_id: string }; Returns: undefined }
      retention_is_eligible: {
        Args: { p_passport_id: string }
        Returns: boolean
      }
      retention_keep: { Args: { p_passport_id: string }; Returns: undefined }
      retention_purge: {
        Args: { p_passport_id: string; p_recovery_days?: number }
        Returns: Json
      }
      retention_scan_drafts: {
        Args: { p_idle_days?: number }
        Returns: {
          creator_id: string
          last_activity: string
          passport_id: string
          retention_state: string
          title: string
        }[]
      }
      retention_soft_delete: {
        Args: { p_passport_id: string }
        Returns: undefined
      }
      set_stop_comment_hidden: {
        Args: { p_comment_id: string; p_hidden: boolean }
        Returns: string
      }
      set_stop_review_hidden: {
        Args: { p_hidden: boolean; p_review_id: string }
        Returns: string
      }
      stop_review_summary: {
        Args: { p_stop_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
      stop_reviews_enabled: { Args: { p_stop_id: string }; Returns: boolean }
      submit_stop_review: {
        Args: { p_body?: string; p_rating: number; p_stop_id: string }
        Returns: string
      }
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
  public: {
    Enums: {},
  },
} as const
