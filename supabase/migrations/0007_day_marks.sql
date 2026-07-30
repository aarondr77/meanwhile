-- One hand-drawn mark per day, drawn by a Devin session when the day is first published.

create table public.day_marks (
  entry_date date primary key,
  svg text,
  session_id text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz
);

alter table public.day_marks enable row level security;

-- Marks belong to the day rather than to an author: both users read every mark,
-- and either may claim a day's generation (the primary key settles the race).
create policy day_marks_read on public.day_marks
  for select to authenticated using (true);

create policy day_marks_write on public.day_marks
  for all to authenticated using (true) with check (true);
