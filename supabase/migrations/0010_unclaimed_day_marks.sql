-- A pool of day marks drawn ahead of time, so a freshly published day can take a
-- finished mark at once instead of waiting for a Devin session to draw one. A mark
-- in the pool belongs to no date until it is claimed; the date it lands on is the
-- only reason it was ever tied to a day.

create table public.unclaimed_day_marks (
  id uuid primary key default gen_random_uuid(),
  -- The variation seed the mark was drawn from; a mark is never tied to a real date.
  seed text not null,
  svg text,
  session_id text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  -- Set the instant a published day takes this mark; a claimed mark never leaves again.
  claimed_at timestamptz
);

alter table public.unclaimed_day_marks enable row level security;

-- The pool belongs to the journal rather than to an author: either user may fill it,
-- read it, and claim from it, exactly as with day_marks.
create policy unclaimed_day_marks_read on public.unclaimed_day_marks
  for select to authenticated using (true);

create policy unclaimed_day_marks_write on public.unclaimed_day_marks
  for all to authenticated using (true) with check (true);

-- Take the oldest finished, unclaimed mark and mark it claimed in one statement, so
-- two days published at the same instant never carry the same drawing. `skip locked`
-- lets the loser fall straight through to the next mark rather than block on the row.
create or replace function public.claim_day_mark()
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed text;
begin
  update public.unclaimed_day_marks
     set claimed_at = now()
   where id = (
     select id
       from public.unclaimed_day_marks
      where svg is not null and claimed_at is null and failed_at is null
      order by requested_at
      limit 1
      for update skip locked
   )
  returning svg into claimed;
  return claimed;
end;
$$;

grant execute on function public.claim_day_mark() to authenticated;
