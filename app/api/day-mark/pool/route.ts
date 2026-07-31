import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { devinConfigured } from "@/lib/devin";
import { harvestPool, refillPool } from "@/lib/day-marks";

/**
 * Warms the pool by hand: harvest any finished sessions, then top the pool back up to
 * its target. Publishing a day does this on its own, so this only matters for priming a
 * fresh project before the first day is written. Call it a few times, a minute apart,
 * until the counts stop rising — each call starts at most a few sessions.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!devinConfigured()) return NextResponse.json({ error: "devin not configured" }, { status: 400 });

  await harvestPool(supabase);
  await refillPool(supabase);

  const { count: ready } = await supabase
    .from("unclaimed_day_marks")
    .select("*", { count: "exact", head: true })
    .not("svg", "is", null)
    .is("claimed_at", null);
  const { count: pending } = await supabase
    .from("unclaimed_day_marks")
    .select("*", { count: "exact", head: true })
    .is("svg", null)
    .is("claimed_at", null)
    .is("failed_at", null);

  return NextResponse.json({ ready: ready ?? 0, pending: pending ?? 0 });
}
