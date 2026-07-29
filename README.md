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

Auth is magic link only. `ALLOWED_EMAILS` is checked server-side before any email
is sent; every other address gets the same "check your email" response. Add the
deployment origin to the Supabase project's redirect allow list.

## Staging

A second Supabase project + Vercel project holds throwaway data, so production is
never seeded or reset. Its env (`.env.staging`, uncommitted) adds two variables:

```bash
SUPABASE_SERVICE_ROLE_KEY=   # staging project only
DEV_LOGIN=1
```

`DEV_LOGIN=1` replaces the magic-link form with one button per allowlisted
address — the server action mints a link with the service role and consumes it
server-side, so no mail is involved — and keeps `/login` reachable while signed
in, making it the user switcher. Production leaves both variables unset.

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

`DEVIN_API_KEY` must be set for generation. Without it days simply keep no mark —
nothing else changes.

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
