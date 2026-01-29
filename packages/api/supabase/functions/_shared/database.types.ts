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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read_at: string | null
          source_id: string | null
          title: string
          type: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read_at?: string | null
          source_id?: string | null
          title: string
          type: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read_at?: string | null
          source_id?: string | null
          title?: string
          type?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          name: string
          photo_url: string | null
          slug: string | null
          social_links: Json | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          name: string
          photo_url?: string | null
          slug?: string | null
          social_links?: Json | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          slug?: string | null
          social_links?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_visit_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_visit_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_visit_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scrape_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          source_id: string | null
          started_at: string
          status: string
          transcripts_added: number | null
          videos_found: number | null
          videos_new: number | null
          videos_updated: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          source_id?: string | null
          started_at: string
          status: string
          transcripts_added?: number | null
          videos_found?: number | null
          videos_new?: number | null
          videos_updated?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          source_id?: string | null
          started_at?: string
          status?: string
          transcripts_added?: number | null
          videos_found?: number | null
          videos_new?: number | null
          videos_updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scrape_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_categories: {
        Row: {
          category_id: string
          is_primary: boolean | null
          source_id: string
        }
        Insert: {
          category_id: string
          is_primary?: boolean | null
          source_id: string
        }
        Update: {
          category_id?: string
          is_primary?: boolean | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_categories_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_people: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          is_primary: boolean | null
          person_id: string
          role: string
          source_id: string
          started_at: string | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean | null
          person_id: string
          role?: string
          source_id: string
          started_at?: string | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean | null
          person_id?: string
          role?: string
          source_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_people_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_tags: {
        Row: {
          created_at: string | null
          source_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          source_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          source_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_tags_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          banner_url: string | null
          created_at: string | null
          description: string | null
          external_id: string
          handle: string | null
          id: string
          is_active: boolean | null
          last_scraped_at: string | null
          name: string
          scrape_frequency: string | null
          subscriber_count: number | null
          thumbnail_url: string | null
          type: string
          updated_at: string | null
          video_count: number | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          external_id: string
          handle?: string | null
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          name: string
          scrape_frequency?: string | null
          subscriber_count?: number | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
          video_count?: number | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          description?: string | null
          external_id?: string
          handle?: string | null
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          name?: string
          scrape_frequency?: string | null
          subscriber_count?: number | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
          video_count?: number | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          type?: string | null
        }
        Relationships: []
      }
      user_favorite_channels: {
        Row: {
          created_at: string
          id: string
          source_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_channels_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      video_categories: {
        Row: {
          category_id: string
          is_primary: boolean | null
          video_id: string
        }
        Insert: {
          category_id: string
          is_primary?: boolean | null
          video_id: string
        }
        Update: {
          category_id?: string
          is_primary?: boolean | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_categories_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_chapters: {
        Row: {
          created_at: string | null
          display_order: number
          end_seconds: number | null
          id: string
          start_seconds: number
          title: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          display_order: number
          end_seconds?: number | null
          id?: string
          start_seconds: number
          title: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          end_seconds?: number | null
          id?: string
          start_seconds?: number
          title?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_chapters_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_people: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          person_id: string
          role: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          person_id: string
          role: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          person_id?: string
          role?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_people_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_tags: {
        Row: {
          created_at: string | null
          source: string | null
          tag_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          source?: string | null
          tag_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          source?: string | null
          tag_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_tags_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          comment_count: number | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          duration_string: string | null
          external_id: string
          has_transcript: boolean | null
          id: string
          like_count: number | null
          metadata_scraped_at: string | null
          published_at: string | null
          source_id: string
          summary: string | null
          thumbnail_url: string | null
          title: string
          transcript: string | null
          transcript_language: string | null
          transcript_scraped_at: string | null
          updated_at: string | null
          upload_date: string | null
          url: string
          view_count: number | null
        }
        Insert: {
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          duration_string?: string | null
          external_id: string
          has_transcript?: boolean | null
          id?: string
          like_count?: number | null
          metadata_scraped_at?: string | null
          published_at?: string | null
          source_id: string
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          transcript?: string | null
          transcript_language?: string | null
          transcript_scraped_at?: string | null
          updated_at?: string | null
          upload_date?: string | null
          url: string
          view_count?: number | null
        }
        Update: {
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          duration_string?: string | null
          external_id?: string
          has_transcript?: boolean | null
          id?: string
          like_count?: number | null
          metadata_scraped_at?: string | null
          published_at?: string | null
          source_id?: string
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          transcript?: string | null
          transcript_language?: string | null
          transcript_scraped_at?: string | null
          updated_at?: string | null
          upload_date?: string | null
          url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_new_videos_since_last_visit: {
        Args: { check_user_id: string }
        Returns: {
          source_id: string
          source_name: string
          source_thumbnail_url: string
          video_duration_seconds: number
          video_id: string
          video_published_at: string
          video_summary: string
          video_thumbnail_url: string
          video_title: string
        }[]
      }
      update_user_last_visit: {
        Args: { check_user_id: string }
        Returns: undefined
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
