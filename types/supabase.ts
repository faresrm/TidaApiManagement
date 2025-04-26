export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          last_used: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at: string
          id?: string
          is_active?: boolean
          key: string
          last_used?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          last_used?: string | null
          name?: string
          user_id?: string
        }
      }
      plans: {
        Row: {
          daily_limit: number
          description: string | null
          id: string
          name: string
          price: number
          request_interval: number
        }
        Insert: {
          daily_limit: number
          description?: string | null
          id: string
          name: string
          price: number
          request_interval: number
        }
        Update: {
          daily_limit?: number
          description?: string | null
          id?: string
          name?: string
          price?: number
          request_interval?: number
        }
      }
      subscriptions: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          plan_id: string
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          plan_id: string
          start_date: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          plan_id?: string
          start_date?: string
          status?: string
          user_id?: string
        }
      }
      usage_logs: {
        Row: {
          api_key_id: string | null
          endpoint: string
          id: string
          status: string
          timestamp: string
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          endpoint: string
          id?: string
          status: string
          timestamp: string
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          endpoint?: string
          id?: string
          status?: string
          timestamp?: string
          user_id?: string
        }
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
  }
}
