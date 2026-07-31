# Meanwhile

A private journal for two people. Two screens: a calendar and a stream.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL, anon key, and the two emails
npm run dev
```

## Supabase

Apply the migrations in `supabase/migrations` in order — either with the Supabase
SQL editor or the CLI (`supabase db push`). They create the four tables, the RLS
policies, the `entry-images` storage bucket, and the trigger that mints a profile
the first time each allowlisted address signs in.

Signing in is a sentence the two of them finish rather than an inbox: pick a name,
complete the prompt, and the server compares it — lowercased, stripped of anything
that isn't a letter or digit — against `sign_in.answer`, then mints the session with
the service role. No mail, so no SMTP to configure. The answer is never in the
repository and never reaches the browser; set it per project:

```sql
insert into sign_in (answer) values ('<the word>');
```

`ALLOWED_EMAILS` still bounds who can exist at all, and both people need an auth
user before they can be offered as a name — create the second one once, with the
name you want on the button:

```sql
-- Or the dashboard: Authentication → Add user → auto-confirm.
update profiles set display_name = 'Cat' where display_name = 'Cat.lindberg';
```

## Notifications

When one of you publishes a day, the other gets a push notification through
[Pushover](https://pushover.net). Publishing happens in the browser, so the
notification is fired by a database trigger rather than by the app:
`entries_notify_published` posts through `pg_net` to the `notify-push` edge function,
which looks up the other profile's user key and calls Pushover. The `notifications`
table records every send, and its unique key means a replayed webhook cannot notify
twice.

There are two of us and we are not going to change, so the user keys are set by
hand rather than through a settings screen. They live on `profiles`, which has no
RLS policy at all — the app never reads that table, only the three-column
`profiles_public` view.

Setting it up, once:

1. Register an application at <https://pushover.net/apps/build> and keep its API token.
2. Each person installs the Pushover app and copies their 30-character user key from
   <https://pushover.net>.
3. Write the keys in (SQL editor, service role):

   ```sql
   update profiles set pushover_key = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    where display_name = 'Aaron';
   ```

   A null key, or `push_enabled = false`, means that person is simply not notified.

```bash
supabase functions deploy notify-push --no-verify-jwt
supabase secrets set \
  PUSHOVER_TOKEN=... \
  NOTIFY_SECRET="$(openssl rand -hex 32)" SITE_URL=https://your-domain
```

Then point the trigger at the function (SQL editor, once per project — kept out of the
migration because the URL and secret differ between staging and production):

```sql
insert into notification_config (notify_url, notify_secret)
values ('https://<project-ref>.supabase.co/functions/v1/notify-push',
        '<the same NOTIFY_SECRET>');
```

An empty `notification_config` makes the trigger a no-op, which is what local and
staging want unless they are deliberately testing delivery.

## Staging

A second Supabase project + Vercel project holds throwaway data, so production is
never seeded or reset. Its env (`.env.staging`, uncommitted) adds one variable:

```bash
DEV_LOGIN=1
```

`DEV_LOGIN=1` is the seed script's safety catch and nothing else: it refuses to
wipe a project without it. Switching between the two people is just signing out
and answering as the other one.

```bash
npm run seed:staging   # wipes entries/comments, writes a month of both authors' days
```

## Day marks

Each day carries a small hand-drawn mark beside its date: two abstract figures,
one in dusty violet and one in terracotta, for the two people writing. The first
time a day gets a published entry, `POST /api/day-mark` claims the day in
`day_marks` and asks a Devin session to draw it (`lib/marks.ts` holds the brief
and the SVG the session must return). The stream polls `GET /api/day-mark?date=`
until the session answers, then the SVG is sanitised against a small drawing
subset of SVG and stored, so the mark is drawn once and read forever.

Generation needs `DEVIN_API_KEY` and `DEVIN_ORG_ID`: the API is v3, whose keys are
org-scoped service user keys (`cog_` prefix, Settings → Service Users), so the org
is part of every path. Without them days simply keep no mark — nothing else changes.

## Paintings

`assets/paintings` holds the eight 1536×1024 sources. `npm run paintings`
derives the AVIF/WebP files at 1600/1024/640 into `public/paintings`; those
derived files are committed, so the build needs no image step. The month-to-
painting map lives in `lib/paintings.ts`.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```
