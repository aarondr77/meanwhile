/**
 * Fills the day-mark pool from a terminal, so the marks a published day claims are
 * already drawn. The app warms the pool on its own as days are published; this is for
 * priming a fresh project, or topping it back up after a run of failed sessions,
 * without signing in and posting to /api/day-mark/pool by hand.
 *
 *   npm run marks:warm            # reads .env.local
 *
 * It checks the Devin credentials first — a pool that will not fill because the key is
 * wrong is the failure worth reporting — then harvests finished sessions and starts new
 * ones on a loop until the pool holds POOL_TARGET drawn, unclaimed marks.
 */
import { createClient } from "@supabase/supabase-js";
import { harvestPool, POOL_TARGET, refillPool } from "../lib/day-marks";
import { assertDevinCredentials } from "../lib/devin";
import type { Database } from "../lib/database.types";

/** How long to keep waiting for sessions to answer before reporting what landed. */
const DEADLINE_MS = 45 * 60 * 1000;
const POLL_MS = 30 * 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

async function counts(): Promise<{ ready: number; pending: number }> {
  const { count: ready } = await db
    .from("unclaimed_day_marks")
    .select("*", { count: "exact", head: true })
    .not("svg", "is", null)
    .is("claimed_at", null);
  const { count: pending } = await db
    .from("unclaimed_day_marks")
    .select("*", { count: "exact", head: true })
    .is("svg", null)
    .is("claimed_at", null)
    .is("failed_at", null);
  return { ready: ready ?? 0, pending: pending ?? 0 };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

await assertDevinCredentials();

const started = Date.now();
let ready = 0;

for (;;) {
  await harvestPool(db);
  await refillPool(db);

  const now = await counts();
  ready = now.ready;
  console.log(`${new Date().toISOString().slice(11, 19)}  ready ${now.ready}/${POOL_TARGET}, drawing ${now.pending}`);

  if (now.ready >= POOL_TARGET) break;
  if (now.pending === 0 && now.ready < POOL_TARGET) throw new Error("nothing drawing and pool short: Devin refused every session");
  if (Date.now() - started > DEADLINE_MS) break;
  await sleep(POLL_MS);
}

console.log(ready >= POOL_TARGET ? `pool warm: ${ready} marks waiting` : `gave up with ${ready} of ${POOL_TARGET} marks drawn`);
