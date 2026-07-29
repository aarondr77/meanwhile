-- Shared journal: two people, four tables, permissions entirely in RLS.

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  colour text not null
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  body jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, entry_date)
);

create index entries_entry_date_idx on public.entries (entry_date desc);

create table public.images (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  storage_path text not null,
  width int not null,
  height int not null,
  alt text
);

create index images_entry_id_idx on public.images (entry_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  block_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_entry_id_idx on public.comments (entry_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_touch_updated_at
  before update on public.entries
  for each row execute function public.touch_updated_at();

-- A block that is deleted must not take its marginalia with it: comments whose
-- anchor disappears fall back to null and render at the end of the entry.
create or replace function public.detach_orphaned_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_ids uuid[];
begin
  select coalesce(array_agg((coalesce(block -> 'attrs' ->> 'id', block ->> 'id'))::uuid), '{}')
    into live_ids
    from jsonb_array_elements(new.body) as block
   where coalesce(block -> 'attrs' ->> 'id', block ->> 'id') is not null;

  update public.comments
     set block_id = null
   where entry_id = new.id
     and block_id is not null
     and not (block_id = any (live_ids));

  return new;
end;
$$;

create trigger entries_detach_orphaned_comments
  after update of body on public.entries
  for each row execute function public.detach_orphaned_comments();

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.images enable row level security;
alter table public.comments enable row level security;

-- Both users read everything; each writes only their own rows. Drafts stay private.
create policy profiles_read on public.profiles
  for select to authenticated using (true);

create policy entries_read on public.entries
  for select to authenticated
  using (published_at is not null or author_id = (select auth.uid()));

create policy entries_write on public.entries
  for all to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy images_read on public.images
  for select to authenticated
  using (
    exists (
      select 1 from public.entries e
       where e.id = images.entry_id
         and (e.published_at is not null or e.author_id = (select auth.uid()))
    )
  );

create policy images_write on public.images
  for all to authenticated
  using (
    exists (select 1 from public.entries e where e.id = images.entry_id and e.author_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.entries e where e.id = images.entry_id and e.author_id = (select auth.uid()))
  );

create policy comments_read on public.comments
  for select to authenticated
  using (
    exists (
      select 1 from public.entries e
       where e.id = comments.entry_id
         and (e.published_at is not null or e.author_id = (select auth.uid()))
    )
  );

create policy comments_write on public.comments
  for all to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = comments.entry_id and e.published_at is not null)
  );

-- Calendar dots: which authors wrote on which day, without shipping entry bodies.
create or replace function public.entry_dots(range_start date, range_end date)
returns table (entry_date date, author_id uuid)
language sql
stable
security invoker
as $$
  select e.entry_date, e.author_id
    from public.entries e
   where e.entry_date between range_start and range_end
     and e.published_at is not null
   group by e.entry_date, e.author_id;
$$;

insert into storage.buckets (id, name, public)
values ('entry-images', 'entry-images', false)
on conflict (id) do nothing;

create policy entry_images_read on storage.objects
  for select to authenticated using (bucket_id = 'entry-images');

create policy entry_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'entry-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy entry_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'entry-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
