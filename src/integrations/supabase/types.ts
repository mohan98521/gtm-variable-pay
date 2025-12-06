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
      comp_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
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
            foreignKeyName: "monthly_actuals_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "plan_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_actuals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      plan_metrics: {
        Row: {
          created_at: string
          gate_threshold_percent: number | null
          id: string
          logic_type: Database["public"]["Enums"]["logic_type"]
          metric_name: string
          plan_id: string
          weightage_percent: number
        }
        Insert: {
          created_at?: string
          gate_threshold_percent?: number | null
          id?: string
          logic_type?: Database["public"]["Enums"]["logic_type"]
          metric_name: string
          plan_id: string
          weightage_percent: number
        }
        Update: {
          created_at?: string
          gate_threshold_percent?: number | null
          id?: string
          logic_type?: Database["public"]["Enums"]["logic_type"]
          metric_name?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          local_currency: string
          manager_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          local_currency?: string
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          local_currency?: string
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
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
      user_targets: {
        Row: {
          created_at: string
          currency: string
          effective_end_date: string
          effective_start_date: string
          id: string
          plan_id: string
          target_value_annual: number
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_end_date: string
          effective_start_date: string
          id?: string
          plan_id: string
          target_value_annual: number
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_end_date?: string
          effective_start_date?: string
          id?: string
          plan_id?: string
          target_value_annual?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_targets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
