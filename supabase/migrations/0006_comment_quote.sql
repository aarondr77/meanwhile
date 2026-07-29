-- The passage a note is about, plus its character offset inside the block's text,
-- so the referenced words can be highlighted in the author's colour.
alter table public.comments
  add column quote text not null default '',
  add column quote_start integer not null default 0;
