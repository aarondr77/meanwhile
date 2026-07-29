-- Only the entry's author can edit the entry, so the comments the trigger must detach
-- always belong to the other user: without security definer, RLS silently updates 0 rows.
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
