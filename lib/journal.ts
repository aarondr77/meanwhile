import type { SupabaseClient } from "@supabase/supabase-js";
import type { Comment, Database, Entry } from "@/lib/database.types";

export type Client = SupabaseClient<Database>;

export interface Dot {
  entry_date: string;
  author_id: string;
}

export async function fetchDots(supabase: Client, start: string, end: string): Promise<Dot[]> {
  const { data, error } = await supabase.rpc("entry_dots", { range_start: start, range_end: end });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEntries(supabase: Client, start: string, end: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: false })
    .order("published_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Entry[];
}

export async function fetchComments(supabase: Client, entryIds: string[]): Promise<Comment[]> {
  if (entryIds.length === 0) return [];
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .in("entry_id", entryIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

/** Entries within a day are interleaved by author and ordered by publication time. */
export function sortEntriesForDay(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const at = a.published_at ?? a.created_at;
    const bt = b.published_at ?? b.created_at;
    return at.localeCompare(bt);
  });
}
