export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface BlockNode {
  id: string;
  type: string;
  attrs?: Record<string, Json>;
  content?: Json[];
  marks?: Json[];
  text?: string;
}

export interface Profile {
  id: string;
  display_name: string;
  colour: string;
}

export interface Entry {
  id: string;
  author_id: string;
  entry_date: string;
  body: BlockNode[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntryImage {
  id: string;
  entry_id: string;
  storage_path: string;
  width: number;
  height: number;
  alt: string | null;
}

export interface Comment {
  id: string;
  entry_id: string;
  author_id: string;
  block_id: string | null;
  /** 0 at the block's top edge, 1 at its bottom: where in the block the note was written. */
  anchor_ratio: number;
  body: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
        Relationships: [];
      };
      entries: {
        Row: Entry;
        Insert: Omit<Entry, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Entry, "id">>;
        Relationships: [];
      };
      images: {
        Row: EntryImage;
        Insert: Omit<EntryImage, "id"> & { id?: string };
        Update: Partial<EntryImage>;
        Relationships: [];
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, "id" | "created_at" | "anchor_ratio"> & {
          id?: string;
          anchor_ratio?: number;
        };
        Update: Partial<Comment>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      entry_dots: {
        Args: { range_start: string; range_end: string };
        Returns: { entry_date: string; author_id: string }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
