-- There is no signup flow: the two profiles come into being the first time each
-- allowlisted address follows a magic link. First in gets author-a, second author-b.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing int;
begin
  select count(*) into existing from public.profiles;

  insert into public.profiles (id, display_name, colour)
  values (
    new.id,
    initcap(split_part(new.email, '@', 1)),
    case when existing = 0 then '#7A6E9E' else '#C2653A' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
