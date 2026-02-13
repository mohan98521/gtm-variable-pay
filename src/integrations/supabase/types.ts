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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      closing_arr_actuals: {
        Row: {
          adjustment: number | null
          als_others: number | null
          bu: string
          churn: number | null
          closing_arr: number | null
          country: string | null
          cr: number | null
          created_at: string
          customer_code: string
          customer_name: string
          discount_decrement: number | null
          end_date: string | null
          id: string
          inflation: number | null
          month_year: string
          new: number | null
          opening_arr: number | null
          order_category: string | null
          order_category_2: string | null
          pid: string
          product: string
          renewal_status: string | null
          revised_region: string | null
          sales_head_employee_id: string | null
          sales_head_name: string | null
          sales_rep_employee_id: string | null
          sales_rep_name: string | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          adjustment?: number | null
          als_others?: number | null
          bu: string
          churn?: number | null
          closing_arr?: number | null
          country?: string | null
          cr?: number | null
          created_at?: string
          customer_code: string
          customer_name: string
          discount_decrement?: number | null
          end_date?: string | null
          id?: string
          inflation?: number | null
          month_year: string
          new?: number | null
          opening_arr?: number | null
          order_category?: string | null
          order_category_2?: string | null
          pid: string
          product: string
          renewal_status?: string | null
          revised_region?: string | null
          sales_head_employee_id?: string | null
          sales_head_name?: string | null
          sales_rep_employee_id?: string | null
          sales_rep_name?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          adjustment?: number | null
          als_others?: number | null
          bu?: string
          churn?: number | null
          closing_arr?: number | null
          country?: string | null
          cr?: number | null
          created_at?: string
          customer_code?: string
          customer_name?: string
          discount_decrement?: number | null
          end_date?: string | null
          id?: string
          inflation?: number | null
          month_year?: string
          new?: number | null
          opening_arr?: number | null
          order_category?: string | null
          order_category_2?: string | null
          pid?: string
          product?: string
          renewal_status?: string | null
          revised_region?: string | null
          sales_head_employee_id?: string | null
          sales_head_name?: string | null
          sales_rep_employee_id?: string | null
          sales_rep_name?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      closing_arr_targets: {
        Row: {
          closing_arr_target_usd: number
          created_at: string
          effective_year: number
          employee_id: string
          id: string
          ms_churn_allowance_usd: number
          msps_bookings_target_usd: number
          net_price_increase_target_usd: number
          opening_arr_usd: number
          software_bookings_target_usd: number
          software_churn_allowance_usd: number
        }
        Insert: {
          closing_arr_target_usd?: number
          created_at?: string
          effective_year?: number
          employee_id: string
          id?: string
          ms_churn_allowance_usd?: number
          msps_bookings_target_usd?: number
          net_price_increase_target_usd?: number
          opening_arr_usd?: number
          software_bookings_target_usd?: number
          software_churn_allowance_usd?: number
        }
        Update: {
          closing_arr_target_usd?: number
          created_at?: string
          effective_year?: number
          employee_id?: string
          id?: string
          ms_churn_allowance_usd?: number
          msps_bookings_target_usd?: number
          net_price_increase_target_usd?: number
          opening_arr_usd?: number
          software_bookings_target_usd?: number
          software_churn_allowance_usd?: number
        }
        Relationships: []
      }
      commission_structures: {
        Row: {
          commission_rate_pct: number
          commission_type: string
          created_at: string
          effective_year: number
          id: string
          is_active: boolean
          min_arr_threshold_usd: number | null
          requires_100_pct_achievement: boolean
          sales_function: string
        }
        Insert: {
          commission_rate_pct?: number
          commission_type: string
          created_at?: string
          effective_year?: number
          id?: string
          is_active?: boolean
          min_arr_threshold_usd?: number | null
          requires_100_pct_achievement?: boolean
          sales_function: string
        }
        Update: {
          commission_rate_pct?: number
          commission_type?: string
          created_at?: string
          effective_year?: number
          id?: string
          is_active?: boolean
          min_arr_threshold_usd?: number | null
          requires_100_pct_achievement?: boolean
          sales_function?: string
        }
        Relationships: []
      }
      comp_plans: {
        Row: {
          clawback_period_days: number | null
          cr_er_min_gp_margin_pct: number
          created_at: string
          description: string | null
          effective_year: number
          id: string
          impl_min_gp_margin_pct: number
          is_active: boolean
          is_clawback_exempt: boolean
          name: string
          nrr_ote_percent: number
          payout_frequency: string | null
          updated_at: string
        }
        Insert: {
          clawback_period_days?: number | null
          cr_er_min_gp_margin_pct?: number
          created_at?: string
          description?: string | null
          effective_year?: number
          id?: string
          impl_min_gp_margin_pct?: number
          is_active?: boolean
          is_clawback_exempt?: boolean
          name: string
          nrr_ote_percent?: number
          payout_frequency?: string | null
          updated_at?: string
        }
        Update: {
          clawback_period_days?: number | null
          cr_er_min_gp_margin_pct?: number
          created_at?: string
          description?: string | null
          effective_year?: number
          id?: string
          impl_min_gp_margin_pct?: number
          is_active?: boolean
          is_clawback_exempt?: boolean
          name?: string
          nrr_ote_percent?: number
          payout_frequency?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      deal_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          deal_id: string | null
          id: string
          is_retroactive: boolean
          new_values: Json | null
          old_values: Json | null
          period_month: string | null
          reason: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          deal_id?: string | null
          id?: string
          is_retroactive?: boolean
          new_values?: Json | null
          old_values?: Json | null
          period_month?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          deal_id?: string | null
          id?: string
          is_retroactive?: boolean
          new_values?: Json | null
          old_values?: Json | null
          period_month?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_audit_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_collections: {
        Row: {
          booking_month: string
          clawback_amount_usd: number | null
          clawback_triggered_at: string | null
          collection_amount_usd: number | null
          collection_date: string | null
          collection_month: string | null
          created_at: string
          customer_name: string | null
          deal_id: string
          deal_value_usd: number
          first_milestone_due_date: string | null
          id: string
          is_clawback_triggered: boolean | null
          is_collected: boolean | null
          notes: string | null
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_month: string
          clawback_amount_usd?: number | null
          clawback_triggered_at?: string | null
          collection_amount_usd?: number | null
          collection_date?: string | null
          collection_month?: string | null
          created_at?: string
          customer_name?: string | null
          deal_id: string
          deal_value_usd?: number
          first_milestone_due_date?: string | null
          id?: string
          is_clawback_triggered?: boolean | null
          is_collected?: boolean | null
          notes?: string | null
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_month?: string
          clawback_amount_usd?: number | null
          clawback_triggered_at?: string | null
          collection_amount_usd?: number | null
          collection_date?: string | null
          collection_month?: string | null
          created_at?: string
          customer_name?: string | null
          deal_id?: string
          deal_value_usd?: number
          first_milestone_due_date?: string | null
          id?: string
          is_clawback_triggered?: boolean | null
          is_collected?: boolean | null
          notes?: string | null
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_collections_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_participants: {
        Row: {
          created_at: string
          deal_id: string
          employee_id: string
          id: string
          participant_role: string
          split_percent: number
        }
        Insert: {
          created_at?: string
          deal_id: string
          employee_id: string
          id?: string
          participant_role: string
          split_percent?: number
        }
        Update: {
          created_at?: string
          deal_id?: string
          employee_id?: string
          id?: string
          participant_role?: string
          split_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_participants_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_variable_pay_attribution: {
        Row: {
          achievement_pct: number
          calculation_month: string
          clawback_amount_usd: number | null
          clawback_date: string | null
          clawback_eligible_usd: number
          compensation_exchange_rate: number | null
          created_at: string | null
          deal_id: string
          deal_value_usd: number
          employee_id: string
          fiscal_year: number
          id: string
          is_clawback_triggered: boolean | null
          local_currency: string | null
          metric_name: string
          multiplier: number
          payout_on_booking_local: number | null
          payout_on_booking_usd: number
          payout_on_collection_local: number | null
          payout_on_collection_usd: number
          payout_on_year_end_local: number | null
          payout_on_year_end_usd: number
          payout_run_id: string | null
          plan_id: string | null
          proportion_pct: number
          target_usd: number
          total_actual_usd: number
          total_variable_pay_usd: number
          updated_at: string | null
          variable_pay_split_local: number | null
          variable_pay_split_usd: number
        }
        Insert: {
          achievement_pct: number
          calculation_month: string
          clawback_amount_usd?: number | null
          clawback_date?: string | null
          clawback_eligible_usd: number
          compensation_exchange_rate?: number | null
          created_at?: string | null
          deal_id: string
          deal_value_usd: number
          employee_id: string
          fiscal_year: number
          id?: string
          is_clawback_triggered?: boolean | null
          local_currency?: string | null
          metric_name: string
          multiplier: number
          payout_on_booking_local?: number | null
          payout_on_booking_usd: number
          payout_on_collection_local?: number | null
          payout_on_collection_usd: number
          payout_on_year_end_local?: number | null
          payout_on_year_end_usd: number
          payout_run_id?: string | null
          plan_id?: string | null
          proportion_pct: number
          target_usd: number
          total_actual_usd: number
          total_variable_pay_usd: number
          updated_at?: string | null
          variable_pay_split_local?: number | null
          variable_pay_split_usd: number
        }
        Update: {
          achievement_pct?: number
          calculation_month?: string
          clawback_amount_usd?: number | null
          clawback_date?: string | null
          clawback_eligible_usd?: number
          compensation_exchange_rate?: number | null
          created_at?: string | null
          deal_id?: string
          deal_value_usd?: number
          employee_id?: string
          fiscal_year?: number
          id?: string
          is_clawback_triggered?: boolean | null
          local_currency?: string | null
          metric_name?: string
          multiplier?: number
          payout_on_booking_local?: number | null
          payout_on_booking_usd?: number
          payout_on_collection_local?: number | null
          payout_on_collection_usd?: number
          payout_on_year_end_local?: number | null
          payout_on_year_end_usd?: number
          payout_run_id?: string | null
          plan_id?: string | null
          proportion_pct?: number
          target_usd?: number
          total_actual_usd?: number
          total_variable_pay_usd?: number
          updated_at?: string | null
          variable_pay_split_local?: number | null
          variable_pay_split_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_variable_pay_attribution_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_variable_pay_attribution_payout_run_id_fkey"
            columns: ["payout_run_id"]
            isOneToOne: false
            referencedRelation: "payout_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_variable_pay_attribution_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          bu: string
          channel_sales_employee_id: string | null
          channel_sales_name: string | null
          country: string
          cr_usd: number | null
          created_at: string
          customer_code: string
          customer_name: string | null
          eligible_for_perpetual_incentive: boolean | null
          er_usd: number | null
          first_year_amc_usd: number | null
          first_year_subscription_usd: number | null
          gp_margin_percent: number | null
          id: string
          implementation_usd: number | null
          linked_to_impl: boolean | null
          managed_services_usd: number | null
          month_year: string
          new_software_booking_arr_usd: number | null
          notes: string | null
          perpetual_license_usd: number | null
          product: string
          product_specialist_employee_id: string | null
          product_specialist_head_employee_id: string | null
          product_specialist_head_name: string | null
          product_specialist_name: string | null
          project_id: string
          region: string
          sales_engineering_employee_id: string | null
          sales_engineering_head_employee_id: string | null
          sales_engineering_head_name: string | null
          sales_engineering_name: string | null
          sales_head_employee_id: string | null
          sales_head_name: string | null
          sales_rep_employee_id: string | null
          sales_rep_name: string | null
          solution_manager_employee_id: string | null
          solution_manager_head_employee_id: string | null
          solution_manager_head_name: string | null
          solution_manager_name: string | null
          status: string
          tcv_usd: number | null
          type_of_proposal: string
          updated_at: string
        }
        Insert: {
          bu: string
          channel_sales_employee_id?: string | null
          channel_sales_name?: string | null
          country: string
          cr_usd?: number | null
          created_at?: string
          customer_code: string
          customer_name?: string | null
          eligible_for_perpetual_incentive?: boolean | null
          er_usd?: number | null
          first_year_amc_usd?: number | null
          first_year_subscription_usd?: number | null
          gp_margin_percent?: number | null
          id?: string
          implementation_usd?: number | null
          linked_to_impl?: boolean | null
          managed_services_usd?: number | null
          month_year: string
          new_software_booking_arr_usd?: number | null
          notes?: string | null
          perpetual_license_usd?: number | null
          product: string
          product_specialist_employee_id?: string | null
          product_specialist_head_employee_id?: string | null
          product_specialist_head_name?: string | null
          product_specialist_name?: string | null
          project_id: string
          region: string
          sales_engineering_employee_id?: string | null
          sales_engineering_head_employee_id?: string | null
          sales_engineering_head_name?: string | null
          sales_engineering_name?: string | null
          sales_head_employee_id?: string | null
          sales_head_name?: string | null
          sales_rep_employee_id?: string | null
          sales_rep_name?: string | null
          solution_manager_employee_id?: string | null
          solution_manager_head_employee_id?: string | null
          solution_manager_head_name?: string | null
          solution_manager_name?: string | null
          status?: string
          tcv_usd?: number | null
          type_of_proposal: string
          updated_at?: string
        }
        Update: {
          bu?: string
          channel_sales_employee_id?: string | null
          channel_sales_name?: string | null
          country?: string
          cr_usd?: number | null
          created_at?: string
          customer_code?: string
          customer_name?: string | null
          eligible_for_perpetual_incentive?: boolean | null
          er_usd?: number | null
          first_year_amc_usd?: number | null
          first_year_subscription_usd?: number | null
          gp_margin_percent?: number | null
          id?: string
          implementation_usd?: number | null
          linked_to_impl?: boolean | null
          managed_services_usd?: number | null
          month_year?: string
          new_software_booking_arr_usd?: number | null
          notes?: string | null
          perpetual_license_usd?: number | null
          product?: string
          product_specialist_employee_id?: string | null
          product_specialist_head_employee_id?: string | null
          product_specialist_head_name?: string | null
          product_specialist_name?: string | null
          project_id?: string
          region?: string
          sales_engineering_employee_id?: string | null
          sales_engineering_head_employee_id?: string | null
          sales_engineering_head_name?: string | null
          sales_engineering_name?: string | null
          sales_head_employee_id?: string | null
          sales_head_name?: string | null
          sales_rep_employee_id?: string | null
          sales_rep_name?: string | null
          solution_manager_employee_id?: string | null
          solution_manager_head_employee_id?: string | null
          solution_manager_head_name?: string | null
          solution_manager_name?: string | null
          status?: string
          tcv_usd?: number | null
          type_of_proposal?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          auth_user_id: string | null
          business_unit: string | null
          city: string | null
          compensation_exchange_rate: number | null
          country: string | null
          created_at: string
          date_of_hire: string | null
          department: string | null
          departure_date: string | null
          designation: string | null
          email: string
          employee_id: string
          employee_role: string | null
          full_name: string
          function_area: string | null
          group_name: string | null
          id: string
          incentive_type: string | null
          is_active: boolean
          local_currency: string
          manager_employee_id: string | null
          ote_local_currency: number | null
          ote_usd: number | null
          region: string | null
          sales_function: string | null
          target_bonus_percent: number | null
          tfp_local_currency: number | null
          tfp_usd: number | null
          tvp_local_currency: number | null
          tvp_usd: number | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          business_unit?: string | null
          city?: string | null
          compensation_exchange_rate?: number | null
          country?: string | null
          created_at?: string
          date_of_hire?: string | null
          department?: string | null
          departure_date?: string | null
          designation?: string | null
          email: string
          employee_id: string
          employee_role?: string | null
          full_name: string
          function_area?: string | null
          group_name?: string | null
          id?: string
          incentive_type?: string | null
          is_active?: boolean
          local_currency?: string
          manager_employee_id?: string | null
          ote_local_currency?: number | null
          ote_usd?: number | null
          region?: string | null
          sales_function?: string | null
          target_bonus_percent?: number | null
          tfp_local_currency?: number | null
          tfp_usd?: number | null
          tvp_local_currency?: number | null
          tvp_usd?: number | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          business_unit?: string | null
          city?: string | null
          compensation_exchange_rate?: number | null
          country?: string | null
          created_at?: string
          date_of_hire?: string | null
          department?: string | null
          departure_date?: string | null
          designation?: string | null
          email?: string
          employee_id?: string
          employee_role?: string | null
          full_name?: string
          function_area?: string | null
          group_name?: string | null
          id?: string
          incentive_type?: string | null
          is_active?: boolean
          local_currency?: string
          manager_employee_id?: string | null
          ote_local_currency?: number | null
          ote_usd?: number | null
          region?: string | null
          sales_function?: string | null
          target_bonus_percent?: number | null
          tfp_local_currency?: number | null
          tfp_usd?: number | null
          tvp_local_currency?: number | null
          tvp_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          currency_code: string
          id: string
          month_year: string
          rate_to_usd: number
        }
        Insert: {
          created_at?: string
          currency_code: string
          id?: string
          month_year: string
          rate_to_usd: number
        }
        Update: {
          created_at?: string
          currency_code?: string
          id?: string
          month_year?: string
          rate_to_usd?: number
        }
        Relationships: []
      }
      monthly_actuals: {
        Row: {
          achieved_value_local_currency: number
          created_at: string
          id: string
          metric_id: string
          month_year: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_value_local_currency: number
          created_at?: string
          id?: string
          metric_id: string
          month_year: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_value_local_currency?: number
          created_at?: string
          id?: string
          metric_id?: string
          month_year?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_actuals_employee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_actuals_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "plan_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_bookings: {
        Row: {
          booking_type: string
          booking_value_local: number | null
          booking_value_usd: number
          client_name: string | null
          collection_date: string | null
          created_at: string
          deal_name: string | null
          deal_type: string | null
          employee_id: string
          first_year_amc_arr_usd: number | null
          id: string
          local_currency: string | null
          month_year: string
          status: string
          tcv_value_usd: number | null
          updated_at: string
        }
        Insert: {
          booking_type: string
          booking_value_local?: number | null
          booking_value_usd?: number
          client_name?: string | null
          collection_date?: string | null
          created_at?: string
          deal_name?: string | null
          deal_type?: string | null
          employee_id: string
          first_year_amc_arr_usd?: number | null
          id?: string
          local_currency?: string | null
          month_year: string
          status?: string
          tcv_value_usd?: number | null
          updated_at?: string
        }
        Update: {
          booking_type?: string
          booking_value_local?: number | null
          booking_value_usd?: number
          client_name?: string | null
          collection_date?: string | null
          created_at?: string
          deal_name?: string | null
          deal_type?: string | null
          employee_id?: string
          first_year_amc_arr_usd?: number | null
          id?: string
          local_currency?: string | null
          month_year?: string
          status?: string
          tcv_value_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      monthly_payouts: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          booking_amount_local: number | null
          booking_amount_usd: number | null
          calculated_amount_local: number | null
          calculated_amount_usd: number
          clawback_amount_local: number | null
          clawback_amount_usd: number | null
          collection_amount_local: number | null
          collection_amount_usd: number | null
          commission_id: string | null
          created_at: string
          deal_id: string | null
          employee_id: string
          exchange_rate_type: string | null
          exchange_rate_used: number | null
          holdback_amount_local: number | null
          holdback_amount_usd: number | null
          id: string
          local_currency: string | null
          metric_id: string | null
          month_year: string
          notes: string | null
          paid_amount_local: number | null
          paid_amount_usd: number | null
          paid_date: string | null
          payout_run_id: string | null
          payout_type: string
          plan_id: string | null
          status: string
          updated_at: string
          year_end_amount_local: number | null
          year_end_amount_usd: number | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_amount_local?: number | null
          booking_amount_usd?: number | null
          calculated_amount_local?: number | null
          calculated_amount_usd?: number
          clawback_amount_local?: number | null
          clawback_amount_usd?: number | null
          collection_amount_local?: number | null
          collection_amount_usd?: number | null
          commission_id?: string | null
          created_at?: string
          deal_id?: string | null
          employee_id: string
          exchange_rate_type?: string | null
          exchange_rate_used?: number | null
          holdback_amount_local?: number | null
          holdback_amount_usd?: number | null
          id?: string
          local_currency?: string | null
          metric_id?: string | null
          month_year: string
          notes?: string | null
          paid_amount_local?: number | null
          paid_amount_usd?: number | null
          paid_date?: string | null
          payout_run_id?: string | null
          payout_type: string
          plan_id?: string | null
          status?: string
          updated_at?: string
          year_end_amount_local?: number | null
          year_end_amount_usd?: number | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_amount_local?: number | null
          booking_amount_usd?: number | null
          calculated_amount_local?: number | null
          calculated_amount_usd?: number
          clawback_amount_local?: number | null
          clawback_amount_usd?: number | null
          collection_amount_local?: number | null
          collection_amount_usd?: number | null
          commission_id?: string | null
          created_at?: string
          deal_id?: string | null
          employee_id?: string
          exchange_rate_type?: string | null
          exchange_rate_used?: number | null
          holdback_amount_local?: number | null
          holdback_amount_usd?: number | null
          id?: string
          local_currency?: string | null
          metric_id?: string | null
          month_year?: string
          notes?: string | null
          paid_amount_local?: number | null
          paid_amount_usd?: number | null
          paid_date?: string | null
          payout_run_id?: string | null
          payout_type?: string
          plan_id?: string | null
          status?: string
          updated_at?: string
          year_end_amount_local?: number | null
          year_end_amount_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_payouts_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "plan_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_payouts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_payouts_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "plan_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_payouts_payout_run_id_fkey"
            columns: ["payout_run_id"]
            isOneToOne: false
            referencedRelation: "payout_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_payouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      multiplier_grids: {
        Row: {
          created_at: string
          id: string
          max_pct: number
          min_pct: number
          multiplier_value: number
          plan_metric_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_pct: number
          min_pct: number
          multiplier_value: number
          plan_metric_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_pct?: number
          min_pct?: number
          multiplier_value?: number
          plan_metric_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "multiplier_grids_plan_metric_id_fkey"
            columns: ["plan_metric_id"]
            isOneToOne: false
            referencedRelation: "plan_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_adjustments: {
        Row: {
          adjustment_amount_local: number
          adjustment_amount_usd: number
          adjustment_type: string
          applied_to_month: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          exchange_rate_used: number
          id: string
          local_currency: string
          original_amount_local: number
          original_amount_usd: number
          payout_run_id: string
          reason: string
          requested_by: string | null
          status: string
          supporting_documents: Json | null
          updated_at: string
        }
        Insert: {
          adjustment_amount_local?: number
          adjustment_amount_usd?: number
          adjustment_type: string
          applied_to_month?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          exchange_rate_used?: number
          id?: string
          local_currency?: string
          original_amount_local?: number
          original_amount_usd?: number
          payout_run_id: string
          reason: string
          requested_by?: string | null
          status?: string
          supporting_documents?: Json | null
          updated_at?: string
        }
        Update: {
          adjustment_amount_local?: number
          adjustment_amount_usd?: number
          adjustment_type?: string
          applied_to_month?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          exchange_rate_used?: number
          id?: string
          local_currency?: string
          original_amount_local?: number
          original_amount_usd?: number
          payout_run_id?: string
          reason?: string
          requested_by?: string | null
          status?: string
          supporting_documents?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_adjustments_payout_run_id_fkey"
            columns: ["payout_run_id"]
            isOneToOne: false
            referencedRelation: "payout_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_audit_log: {
        Row: {
          action: string
          action_type: string | null
          amount_local: number | null
          amount_usd: number | null
          audit_category: string | null
          changed_at: string
          changed_by: string | null
          compensation_rate: number | null
          deal_collection_id: string | null
          employee_id: string | null
          entity_type: string
          exchange_rate_used: number | null
          id: string
          is_rate_mismatch: boolean | null
          local_currency: string | null
          market_rate: number | null
          metadata: Json | null
          month_year: string | null
          new_values: Json | null
          old_values: Json | null
          payout_id: string | null
          payout_run_id: string | null
          rate_type: string | null
          rate_variance_pct: number | null
          reason: string | null
        }
        Insert: {
          action: string
          action_type?: string | null
          amount_local?: number | null
          amount_usd?: number | null
          audit_category?: string | null
          changed_at?: string
          changed_by?: string | null
          compensation_rate?: number | null
          deal_collection_id?: string | null
          employee_id?: string | null
          entity_type?: string
          exchange_rate_used?: number | null
          id?: string
          is_rate_mismatch?: boolean | null
          local_currency?: string | null
          market_rate?: number | null
          metadata?: Json | null
          month_year?: string | null
          new_values?: Json | null
          old_values?: Json | null
          payout_id?: string | null
          payout_run_id?: string | null
          rate_type?: string | null
          rate_variance_pct?: number | null
          reason?: string | null
        }
        Update: {
          action?: string
          action_type?: string | null
          amount_local?: number | null
          amount_usd?: number | null
          audit_category?: string | null
          changed_at?: string
          changed_by?: string | null
          compensation_rate?: number | null
          deal_collection_id?: string | null
          employee_id?: string | null
          entity_type?: string
          exchange_rate_used?: number | null
          id?: string
          is_rate_mismatch?: boolean | null
          local_currency?: string | null
          market_rate?: number | null
          metadata?: Json | null
          month_year?: string | null
          new_values?: Json | null
          old_values?: Json | null
          payout_id?: string | null
          payout_run_id?: string | null
          rate_type?: string | null
          rate_variance_pct?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_audit_log_deal_collection_id_fkey"
            columns: ["deal_collection_id"]
            isOneToOne: false
            referencedRelation: "deal_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_audit_log_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "monthly_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_audit_log_payout_run_id_fkey"
            columns: ["payout_run_id"]
            isOneToOne: false
            referencedRelation: "payout_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          calculated_by: string | null
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_locked: boolean
          month_year: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          run_status: string
          total_clawbacks_usd: number | null
          total_commissions_usd: number | null
          total_payout_usd: number | null
          total_variable_pay_usd: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_locked?: boolean
          month_year: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_status?: string
          total_clawbacks_usd?: number | null
          total_commissions_usd?: number | null
          total_payout_usd?: number | null
          total_variable_pay_usd?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_locked?: boolean
          month_year?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_status?: string
          total_clawbacks_usd?: number | null
          total_commissions_usd?: number | null
          total_payout_usd?: number | null
          total_variable_pay_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      performance_targets: {
        Row: {
          created_at: string
          effective_year: number
          employee_id: string
          id: string
          metric_type: string
          target_value_usd: number
        }
        Insert: {
          created_at?: string
          effective_year?: number
          employee_id: string
          id?: string
          metric_type: string
          target_value_usd?: number
        }
        Update: {
          created_at?: string
          effective_year?: number
          employee_id?: string
          id?: string
          metric_type?: string
          target_value_usd?: number
        }
        Relationships: []
      }
      plan_commissions: {
        Row: {
          commission_rate_pct: number
          commission_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          min_threshold_usd: number | null
          payout_on_booking_pct: number | null
          payout_on_collection_pct: number | null
          payout_on_year_end_pct: number | null
          plan_id: string
        }
        Insert: {
          commission_rate_pct?: number
          commission_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_threshold_usd?: number | null
          payout_on_booking_pct?: number | null
          payout_on_collection_pct?: number | null
          payout_on_year_end_pct?: number | null
          plan_id: string
        }
        Update: {
          commission_rate_pct?: number
          commission_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_threshold_usd?: number | null
          payout_on_booking_pct?: number | null
          payout_on_collection_pct?: number | null
          payout_on_year_end_pct?: number | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_metrics: {
        Row: {
          created_at: string
          gate_threshold_percent: number | null
          id: string
          logic_type: Database["public"]["Enums"]["logic_type"]
          metric_name: string
          payout_on_booking_pct: number | null
          payout_on_collection_pct: number | null
          payout_on_year_end_pct: number | null
          plan_id: string
          weightage_percent: number
        }
        Insert: {
          created_at?: string
          gate_threshold_percent?: number | null
          id?: string
          logic_type?: Database["public"]["Enums"]["logic_type"]
          metric_name: string
          payout_on_booking_pct?: number | null
          payout_on_collection_pct?: number | null
          payout_on_year_end_pct?: number | null
          plan_id: string
          weightage_percent: number
        }
        Update: {
          created_at?: string
          gate_threshold_percent?: number | null
          id?: string
          logic_type?: Database["public"]["Enums"]["logic_type"]
          metric_name?: string
          payout_on_booking_pct?: number | null
          payout_on_collection_pct?: number | null
          payout_on_year_end_pct?: number | null
          plan_id?: string
          weightage_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_metrics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_spiffs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          linked_metric_name: string
          min_deal_value_usd: number | null
          plan_id: string
          spiff_name: string
          spiff_rate_pct: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          linked_metric_name: string
          min_deal_value_usd?: number | null
          plan_id: string
          spiff_name: string
          spiff_rate_pct?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          linked_metric_name?: string
          min_deal_value_usd?: number | null
          plan_id?: string
          spiff_name?: string
          spiff_rate_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_spiffs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_unit: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_hire: string | null
          department: string | null
          departure_date: string | null
          designation: string | null
          email: string
          employee_id: string | null
          full_name: string
          function_area: string | null
          group_name: string | null
          id: string
          local_currency: string
          manager_id: string | null
          region: string | null
          sales_function: string | null
          updated_at: string
        }
        Insert: {
          business_unit?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_hire?: string | null
          department?: string | null
          departure_date?: string | null
          designation?: string | null
          email: string
          employee_id?: string | null
          full_name: string
          function_area?: string | null
          group_name?: string | null
          id: string
          local_currency?: string
          manager_id?: string | null
          region?: string | null
          sales_function?: string | null
          updated_at?: string
        }
        Update: {
          business_unit?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_hire?: string | null
          department?: string | null
          departure_date?: string | null
          designation?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string
          function_area?: string | null
          group_name?: string | null
          id?: string
          local_currency?: string
          manager_id?: string | null
          region?: string | null
          sales_function?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_targets: {
        Row: {
          created_at: string
          effective_year: number
          employee_id: string
          id: string
          metric_type: string
          quarter: number
          target_value_usd: number
        }
        Insert: {
          created_at?: string
          effective_year?: number
          employee_id: string
          id?: string
          metric_type: string
          quarter: number
          target_value_usd?: number
        }
        Update: {
          created_at?: string
          effective_year?: number
          employee_id?: string
          id?: string
          metric_type?: string
          quarter?: number
          target_value_usd?: number
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          permission_key: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_system_role: boolean
          label: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          label: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          label?: string
          name?: string
        }
        Relationships: []
      }
      system_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          is_retroactive: boolean
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          is_retroactive?: boolean
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          is_retroactive?: boolean
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      user_targets: {
        Row: {
          created_at: string
          currency: string
          effective_end_date: string
          effective_start_date: string
          id: string
          ote_local_currency: number | null
          ote_usd: number | null
          plan_id: string
          target_bonus_percent: number | null
          target_bonus_usd: number | null
          target_value_annual: number
          tfp_local_currency: number | null
          tfp_usd: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_end_date: string
          effective_start_date: string
          id?: string
          ote_local_currency?: number | null
          ote_usd?: number | null
          plan_id: string
          target_bonus_percent?: number | null
          target_bonus_usd?: number | null
          target_value_annual: number
          tfp_local_currency?: number | null
          tfp_usd?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_end_date?: string
          effective_start_date?: string
          id?: string
          ote_local_currency?: number | null
          ote_usd?: number | null
          plan_id?: string
          target_bonus_percent?: number | null
          target_bonus_usd?: number | null
          target_value_annual?: number
          tfp_local_currency?: number | null
          tfp_usd?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_targets_employee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_targets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
    }
    Enums: {
      logic_type: "Stepped_Accelerator" | "Gated_Threshold" | "Linear"
      user_role: "Admin" | "Sales_Head" | "Sales_Rep"
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
    Enums: {
      logic_type: ["Stepped_Accelerator", "Gated_Threshold", "Linear"],
      user_role: ["Admin", "Sales_Head", "Sales_Rep"],
    },
  },
} as const
