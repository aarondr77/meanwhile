-- Signing in is a shared sentence rather than an inbox: two people who both know
-- how they talk to each other, and no mail to wait for. The answer lives here and
-- not in the repository, so reading the source tells you the question only.

create table public.sign_in (
  id boolean primary key default true check (id),
  prompt text not null default 'I love you for',
  answer text not null
);

alter table public.sign_in enable row level security;
-- No policies: only the server action, holding the service role, ever reads this.
