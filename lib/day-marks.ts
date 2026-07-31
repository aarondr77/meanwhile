import type { createClient } from "@/lib/supabase/server";
import type { UnclaimedDayMark } from "@/lib/database.types";
import { createSession, getSession, isTerminal } from "@/lib/devin";
import { MARK_OUTPUT_SCHEMA, markPrompt, randomSeed, sanitiseMark } from "@/lib/marks";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** How many drawn-or-drawing marks the pool tries to keep waiting for a day to claim. */
const POOL_TARGET = 5;
/** A ceiling on sessions started per request, so a drained pool never floods Devin. */
const MAX_REFILL = 3;
/** A ceiling on sessions polled per request, so harvesting stays cheap on a hot path. */
const MAX_HARVEST = 8;

/** Start one pool session and record the row it will fill. Throws if Devin refuses. */
async function startPoolMark(supabase: Supabase): Promise<void> {
  const seed = randomSeed();
  const sessionId = await createSession(markPrompt(seed), {
    title: "Journal mark for the pool",
    schema: MARK_OUTPUT_SCHEMA,
    tags: ["meanwhile-day-mark", "meanwhile-day-mark-pool"],
  });
  await supabase.from("unclaimed_day_marks").insert({ seed, session_id: sessionId });
}

/**
 * Collect finished pool sessions into drawn marks. A session that answered with a
 * usable drawing becomes a ready mark; one that finished with nothing is a failure and
 * leaves the pool, so refilling can replace it. Runs opportunistically on the request
 * path, so it is bounded and swallows per-session errors rather than failing the day.
 */
export async function harvestPool(supabase: Supabase): Promise<void> {
  const { data } = await supabase
    .from("unclaimed_day_marks")
    .select("*")
    .is("svg", null)
    .is("claimed_at", null)
    .is("failed_at", null)
    .not("session_id", "is", null)
    .order("requested_at")
    .limit(MAX_HARVEST);

  const pending = (data ?? []) as UnclaimedDayMark[];

  await Promise.all(
    pending.map(async (mark) => {
      if (!mark.session_id) return;
      try {
        const session = await getSession(mark.session_id);
        const raw = typeof session.structuredOutput?.svg === "string" ? session.structuredOutput.svg : null;
        const svg = raw ? sanitiseMark(raw) : null;
        if (svg) {
          await supabase
            .from("unclaimed_day_marks")
            .update({ svg, completed_at: new Date().toISOString() })
            .eq("id", mark.id);
        } else if (isTerminal(session)) {
          await supabase
            .from("unclaimed_day_marks")
            .update({ failed_at: new Date().toISOString() })
            .eq("id", mark.id);
        }
      } catch {
        // Transient Devin error: leave the mark pending and try again next time.
      }
    }),
  );
}

/**
 * Start enough sessions to bring the pool back up to its target of drawn-or-drawing
 * marks. Called after a day takes a mark, so the one just consumed is replaced, and
 * after any request that drained the pool, so a run of failures heals itself.
 */
export async function refillPool(supabase: Supabase): Promise<void> {
  const { count } = await supabase
    .from("unclaimed_day_marks")
    .select("*", { count: "exact", head: true })
    .is("claimed_at", null)
    .is("failed_at", null);

  const live = count ?? 0;
  const missing = Math.min(POOL_TARGET - live, MAX_REFILL);
  if (missing <= 0) return;

  for (let i = 0; i < missing; i += 1) {
    try {
      await startPoolMark(supabase);
    } catch {
      // Devin refused: stop early and let the next request try to finish topping up.
      break;
    }
  }
}

/** The oldest finished, unclaimed mark, claimed in one atomic step, or null if the pool is dry. */
export async function claimPoolMark(supabase: Supabase): Promise<string | null> {
  const { data, error } = await supabase.rpc("claim_day_mark", {});
  if (error) return null;
  return typeof data === "string" ? data : null;
}
