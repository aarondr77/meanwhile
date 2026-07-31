// Pushes the other person a notification when a day is published.
//
// Called by the entries_notify_published trigger via pg_net. Runs with the
// service role so it can read Pushover user keys, which no client may select.

import { createClient } from "jsr:@supabase/supabase-js@2";

interface Payload {
  kind: "entry";
  id: string;
  author_id: string;
  entry_date: string;
}

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

/** "Tuesday, 28 July" — the entry's own date, never the recipient's today. */
const formatDate = (date: string): string =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

const EXCERPT_LIMIT = 240;

/** The message is sent as HTML, so the journal's own angle brackets must survive. */
const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The opening of the entry, so the notification is worth reading on its own. */
const excerpt = (body: unknown): string => {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as { text?: string; content?: unknown[] };
    if (typeof record.text === "string") parts.push(record.text);
    record.content?.forEach(walk);
  };
  (Array.isArray(body) ? body : []).forEach((block) => {
    walk(block);
    parts.push("\n");
  });

  const text = parts.join("").replace(/\n{2,}/g, "\n").trim();
  if (text.length <= EXCERPT_LIMIT) return text;

  // Cut on a word so the ellipsis does not land mid-word.
  const cut = text.slice(0, EXCERPT_LIMIT);
  const space = cut.lastIndexOf(" ");
  return `${(space > EXCERPT_LIMIT - 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

Deno.serve(async (request) => {
  if (request.headers.get("x-notify-secret") !== env("NOTIFY_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = (await request.json()) as Payload;
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const [{ data: author }, { data: others }, { data: entry }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", payload.author_id).single(),
    admin.from("profiles").select("id, pushover_key, push_enabled").neq("id", payload.author_id),
    admin.from("entries").select("body").eq("id", payload.id).single(),
  ]);

  const recipient = (others ?? []).find((row) => row.push_enabled && row.pushover_key);
  if (!author || !recipient) return new Response("no recipient", { status: 200 });

  // The unique key on (recipient, kind, source) turns a replayed webhook into a
  // conflict, so the notification is sent at most once.
  const { data: claim } = await admin
    .from("notifications")
    .insert({ recipient_id: recipient.id, kind: payload.kind, source_id: payload.id })
    .select("id")
    .maybeSingle();
  if (!claim) return new Response("already sent", { status: 200 });

  const opening = excerpt(entry?.body);
  const day = formatDate(payload.entry_date);

  const response = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: env("PUSHOVER_TOKEN"),
      user: recipient.pushover_key,
      title: `${author.display_name} wrote about ${day}`,
      // An entry can be nothing but photographs, and the day still stands alone.
      message: opening ? escapeHtml(opening) : `<i>${day}</i>`,
      html: 1,
      url: `${env("SITE_URL")}/#${payload.entry_date}`,
      url_title: `Read ${author.display_name}'s ${day}`,
      timestamp: Math.floor(Date.now() / 1000),
    }),
  });

  const result = await response.json();
  const ok = response.ok && result.status === 1;

  await admin
    .from("notifications")
    .update(
      ok
        ? { sent_at: new Date().toISOString(), provider_id: result.request }
        : { error: `${response.status} ${(result.errors ?? ["unknown"]).join(", ")}` },
    )
    .eq("id", claim.id);

  return new Response(ok ? "sent" : "failed", { status: 200 });
});
