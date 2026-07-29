-- Where inside its block a note was written, as a fraction of the block's height,
-- so a note about the middle of a long paragraph sits beside that line rather
-- than at the paragraph's top edge.
alter table public.comments
  add column anchor_ratio real not null default 0;
