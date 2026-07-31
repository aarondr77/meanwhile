-- A push notification when the other person publishes a day.
--
-- The trigger lives in the database rather than in the publish path because
-- publishing is a client-side update: a tab that closes mid-request must still
-- send the notification.

create extension if not exists pg_net with schema extensions;

-- The Pushover user key: 30 characters from that account's dashboard.
alter table public.profiles
  add column pushover_key text,
  add column push_enabled boolean not null default true;

alter table public.profiles
  add constraint profiles_pushover_key_shape
  check (pushover_key is null or pushover_key ~ '^[A-Za-z0-9]{30}$');

-- One row per message the sender was asked to deliver. The unique key makes a
-- replayed webhook a no-op; the failure columns keep a delivery record.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('entry')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,
  error text,
  unique (recipient_id, kind, source_id)
);

alter table public.notifications enable row level security;
-- No policies: only the service role reads or writes this table.

-- A user key is a credential, not journal content, and profiles_read from 0001
-- would hand each person the other's. Nothing client-side needs the table any
-- more: the app reads names and colours through the view below, and the keys
-- are set by hand with the service role. So the table keeps no policy at all.
drop policy profiles_read on public.profiles;

-- Owner rights on purpose: with invoker rights the view would find no policy on
-- profiles and each person's calendar and stream would lose the other person
-- entirely. The column list is the whole security boundary, and it does not
-- include pushover_key.
create view public.profiles_public
with (security_invoker = false)
as select id, display_name, colour from public.profiles;

-- A three-column view over one table is auto-updatable, and with owner rights
-- that would be a way to write another person's row: read only, explicitly.
revoke all on public.profiles_public from anon, authenticated;
grant select on public.profiles_public to authenticated;

-- Where to post, per project. A table rather than a custom GUC because hosted
-- Postgres refuses `alter database ... set app.*`. At most one row; no row at
-- all makes the trigger a no-op, which is what local and staging want.
create table public.notification_config (
  id boolean primary key default true check (id),
  notify_url text not null,
  notify_secret text not null
);

alter table public.notification_config enable row level security;
-- No policies: the secret is for the trigger and the service role only.

create or replace function public.notify_entry_published()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  config public.notification_config;
begin
  select * into config from public.notification_config limit 1;
  if not found then
    return new;
  end if;

  perform net.http_post(
    url := config.notify_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', config.notify_secret
    ),
    body := jsonb_build_object(
      'kind', 'entry',
      'id', new.id,
      'author_id', new.author_id,
      'entry_date', new.entry_date
    )
  );

  return new;
end;
$$;

create trigger entries_notify_published
  after update of published_at on public.entries
  for each row
  when (old.published_at is null and new.published_at is not null)
  execute function public.notify_entry_published();
