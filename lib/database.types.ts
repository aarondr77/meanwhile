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

/** The mark drawn for a day; `svg` is null while the drawing session is still running. */
export interface DayMark {
  entry_date: string;
  svg: string | null;
  session_id: string | null;
  requested_at: string;
  completed_at: string | null;
  failed_at: string | null;
}

export interface Comment {
  id: string;
  entry_id: string;
  author_id: string;
  block_id: string | null;
  /** 0 at the block's top edge, 1 at its bottom: where in the block the note was written. */
  anchor_ratio: number;
  /** The passage the note is about, empty for notes written before quotes were kept. */
  quote: string;
  /** Character offset of `quote` within the block's text. */
  quote_start: number;
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
      day_marks: {
        Row: DayMark;
        Insert: Pick<DayMark, "entry_date"> & Partial<DayMark>;
        Update: Partial<DayMark>;
        Relationships: [];
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, "id" | "created_at" | "anchor_ratio" | "quote" | "quote_start"> & {
          id?: string;
          anchor_ratio?: number;
          quote?: string;
          quote_start?: number;
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
