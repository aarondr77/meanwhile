/**
 * Fills a staging database with a month of two-sided journal traffic: published
 * entries from both authors, marginal comments (anchored and detached), and one
 * private draft. Refuses to run against a project that is not marked staging.
 *
 *   node scripts/seed-staging.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_EMAILS
 * and DEV_LOGIN=1 in the environment (see .env.staging).
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (process.env.DEV_LOGIN !== "1") throw new Error("DEV_LOGIN=1 is required: refusing to seed a non-staging project");
if (emails.length !== 2) throw new Error("ALLOWED_EMAILS must list exactly two addresses");

const [aaronEmail, catEmail] = emails;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const paragraph = (text) => ({
  type: "paragraph",
  attrs: { id: randomUUID() },
  content: [{ type: "text", text }],
});

const heading = (text) => ({
  type: "heading",
  attrs: { id: randomUUID(), level: 2 },
  content: [{ type: "text", text }],
});

const quote = (text) => ({
  type: "blockquote",
  attrs: { id: randomUUID() },
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function ensureUser(email, displayName, colour) {
  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  let user = list.users.find((candidate) => candidate.email === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await db
    .from("profiles")
    .upsert({ id: user.id, display_name: displayName, colour });
  if (profileError) throw profileError;

  return user.id;
}

/** [daysAgo, author, blocks, publishedAt or null for a draft] */
const script = [
  [24, "aaron", [paragraph("Woke up before the alarm for once. Walked to the water while the city was still deciding whether to be awake."), paragraph("Sent you a photo of the ferry. It looked like a paper cutout.")]],
  [23, "cat", [paragraph("Market day. Bought too much basil again, and a bunch of ranunculus that the woman insisted were the last good ones of the season."), paragraph("Ate lunch standing up over the sink, which I know you hate.")]],
  [21, "aaron", [heading("Long day"), paragraph("Three hours of meetings that could have been a paragraph. Afterwards I sat in the park and read twenty pages and felt like a person again."), paragraph("I keep saving things to tell you and then forgetting them by evening. Hence this.")]],
  [20, "cat", [paragraph("Rain all afternoon. I opened the window anyway because it smelled like the summer we drove to the coast."), quote("Distance is just the part of the story where nothing happens yet.")]],
  [18, "cat", [paragraph("Finished the blue sweater. It fits nobody. I'm keeping it.")]],
  [17, "aaron", [paragraph("Cooked the lentil thing from your mother's recipe and it came out almost right — I think I under-salted the onions."), paragraph("Ate the leftovers for breakfast, which is either efficient or a warning sign.")]],
  [14, "aaron", [paragraph("Two weeks now. I've started measuring time in how many entries down the page you are."), paragraph("Ran six miles without stopping, mostly out of spite.")]],
  [13, "cat", [heading("Small inventory"), paragraph("One cracked mug, retired. Two library books, overdue. A postcard I keep not sending because I want the first line to be perfect.")]],
  [11, "cat", [paragraph("Called my sister for an hour. She asked when you're back and I gave her the honest answer, which made us both quiet for a second.")]],
  [10, "aaron", [paragraph("Fixed the bike's rear derailleur with a hex key and unearned confidence. It shifts. I'm suspicious.")]],
  [7, "aaron", [paragraph("A whole day of good light. I took the long way home twice."), paragraph("The plant you told me not to overwater is thriving, which suggests I was the problem.")]],
  [6, "cat", [paragraph("Went to the late showing alone and cried at the part with the train, as predicted.")]],
  [4, "cat", [paragraph("Slow Sunday. Bread, newspaper, a nap I didn't plan. I thought about how you narrate these days better than I do.")]],
  [3, "aaron", [paragraph("Wrote until the battery died, then kept going on paper, which felt like cheating in the good direction.")]],
  [1, "cat", [paragraph("Yesterday's soup was better today. That's the whole entry.")]],
  [0, "aaron", [paragraph("Draft I haven't published — you shouldn't be able to see this one from Cat's account.")], null],

  // Days both of them wrote, so the calendar shows a pair of dots.
  [21, "cat", [paragraph("He had the day I had last Tuesday. We are on a delay of about a week."), paragraph("Planted the window box. Optimistic of me.")]],
  [20, "aaron", [paragraph("Rain here too, an hour behind yours. I like that the weather gets to both of us eventually.")]],
  [17, "cat", [paragraph("Under-salted onions are a fixable problem. Write down what you did.")]],
  [7, "cat", [paragraph("Good light here as well — I sat on the step until the neighbour's cat came over."), quote("Two people, one day, two pages. That was the whole idea.")]],
  [4, "aaron", [paragraph("Sunday too, but I spent it in the laundromat reading the same paragraph four times.")]],
  [1, "aaron", [paragraph("Made the soup. Understand the entry now.")]],
];

/** [daysAgo, author of the annotated entry, commenter, block index or null, text] */
const notes = [
  [24, "aaron", "cat", 1, "A paper cutout ferry. I can see it exactly."],
  [23, "cat", "aaron", 0, "Too much basil is the correct amount of basil."],
  [23, "cat", "aaron", 1, "I do hate it. Sit down."],
  [21, "aaron", "cat", 0, "This is my favourite kind of your entries."],
  [21, "aaron", "cat", 2, "Forget them out loud next time — call me."],
  [21, "cat", "aaron", 1, "Optimism is the point of a window box."],
  [20, "cat", "aaron", 1, "Stealing this line for later."],
  [17, "aaron", "cat", 0, "Salt the onions first, then again at the end. Every time."],
  [14, "aaron", "aaron", 1, "Spite is a renewable resource."],
  [13, "cat", "aaron", null, "Send the postcard. First lines are allowed to be bad."],
  [10, "aaron", "cat", 0, "Suspicion is the correct response to your own repairs."],
  [7, "aaron", "cat", 1, "It was absolutely you."],
  [7, "cat", "aaron", 1, "That was the whole idea."],
  [4, "cat", "aaron", 0, "You narrate them fine. You just don't believe it."],
  [1, "cat", "aaron", 0, "Perfect entry."],
];

const aaronId = await ensureUser(aaronEmail, "Aaron", "#7A6E9E");
const catId = await ensureUser(catEmail, "Cat", "#C2653A");
const authors = { aaron: aaronId, cat: catId };

await db.from("comments").delete().neq("id", randomUUID());
await db.from("entries").delete().neq("id", randomUUID());

const seeded = new Map();

for (const [daysAgo, author, blocks, published = "auto"] of script) {
  const entryDate = isoDaysAgo(daysAgo);
  const publishedAt = published === null ? null : `${entryDate}T19:30:00Z`;
  const { data, error } = await db
    .from("entries")
    .insert({ author_id: authors[author], entry_date: entryDate, body: blocks, published_at: publishedAt })
    .select("id")
    .single();
  if (error) throw error;
  seeded.set(`${author}:${daysAgo}`, { id: data.id, blocks });
}

for (const [daysAgo, author, commenter, blockIndex, body] of notes) {
  const entry = seeded.get(`${author}:${daysAgo}`);
  if (!entry) throw new Error(`no seeded ${author} entry ${daysAgo} days ago`);
  const blockId = blockIndex === null ? null : entry.blocks[blockIndex].attrs.id;
  const { error } = await db
    .from("comments")
    .insert({ entry_id: entry.id, author_id: authors[commenter], block_id: blockId, body });
  if (error) throw error;
}

console.log(`seeded ${script.length} entries and ${notes.length} comments for ${aaronEmail} + ${catEmail}`);
