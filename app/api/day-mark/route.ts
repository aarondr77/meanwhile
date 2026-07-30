import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSession, devinConfigured, getSession, TERMINAL_STATUSES } from "@/lib/devin";
import { isValidIsoDate } from "@/lib/dates";
import { MARK_OUTPUT_SCHEMA, markPrompt, sanitiseMark } from "@/lib/marks";
import type { DayMark } from "@/lib/database.types";

type State = "ready" | "pending" | "failed" | "none";

function payload(state: State, svg: string | null = null) {
  return NextResponse.json({ state, svg });
}

async function dateParam(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("date");
  if (fromQuery) return isValidIsoDate(fromQuery) ? fromQuery : null;
  const body = (await request.json().catch(() => null)) as { date?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date : null;
  return date && isValidIsoDate(date) ? date : null;
}

/** Asks Devin to draw the day's mark. Called when a day gets its first published entry. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const date = await dateParam(request);
  if (!date) return NextResponse.json({ error: "bad date" }, { status: 400 });

  const { data: existing } = await supabase.from("day_marks").select("*").eq("entry_date", date).maybeSingle();
  const current = existing as DayMark | null;
  if (current?.svg) return payload("ready", current.svg);
  if (current?.session_id) return payload("pending");
  if (!devinConfigured()) return payload("none");

  // The primary key settles the race when both authors publish the same day at once.
  if (!current) {
    const { error } = await supabase.from("day_marks").insert({ entry_date: date });
    if (error) return payload("pending");
  }

  try {
    const sessionId = await createSession(markPrompt(date), {
      title: `Journal mark for ${date}`,
      schema: MARK_OUTPUT_SCHEMA,
      tags: ["meanwhile-day-mark"],
    });
    await supabase.from("day_marks").update({ session_id: sessionId, failed_at: null }).eq("entry_date", date);
    return payload("pending");
  } catch {
    await supabase.from("day_marks").update({ failed_at: new Date().toISOString() }).eq("entry_date", date);
    return payload("failed");
  }
}

/** The mark if it is drawn, otherwise a poll of the session that is drawing it. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const date = await dateParam(request);
  if (!date) return NextResponse.json({ error: "bad date" }, { status: 400 });

  const { data } = await supabase.from("day_marks").select("*").eq("entry_date", date).maybeSingle();
  const mark = data as DayMark | null;
  if (!mark) return payload("none");
  if (mark.svg) return payload("ready", mark.svg);
  if (!mark.session_id) return payload(mark.failed_at ? "failed" : "pending");

  let session;
  try {
    session = await getSession(mark.session_id);
  } catch {
    return payload("pending");
  }

  const raw = typeof session.structuredOutput?.svg === "string" ? session.structuredOutput.svg : null;
  const svg = raw ? sanitiseMark(raw) : null;

  if (svg) {
    await supabase
      .from("day_marks")
      .update({ svg, completed_at: new Date().toISOString(), failed_at: null })
      .eq("entry_date", date);
    return payload("ready", svg);
  }

  // A finished session with no usable drawing is a failure: the day simply keeps no mark.
  if (TERMINAL_STATUSES.has(session.status)) {
    await supabase.from("day_marks").update({ failed_at: new Date().toISOString() }).eq("entry_date", date);
    return payload("failed");
  }

  return payload("pending");
}
