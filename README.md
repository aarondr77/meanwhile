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
