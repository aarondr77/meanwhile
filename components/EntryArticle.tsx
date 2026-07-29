"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Comment, Entry, Profile } from "@/lib/database.types";
import { blockIdOf, EntryBody, type Highlight } from "./EntryBody";
import { blockText } from "@/lib/blocks";
import { EntryEditor } from "./EntryEditor";
import { CommentForm, CommentNote, MarginColumn, type CommentComposer } from "./Marginalia";
import marginStyles from "./marginalia.module.css";
import styles from "./stream.module.css";

/** A note about the entry as a whole rather than any one passage. */
const detachedAnchor: CommentComposer = { blockId: null, anchorRatio: 0, quote: "", quoteStart: 0 };

export function EntryArticle({
  entry,
  date,
  author,
  me,
  profiles,
  comments,
  editable,
  placeholder,
  onEntryChange,
  onCommentsChange,
}: {
  entry: Entry | null;
  date: string;
  author: Profile;
  me: Profile;
  profiles: Profile[];
  comments: Comment[];
  editable: boolean;
  placeholder: string;
  onEntryChange: (entry: Entry) => void;
  onCommentsChange: () => void;
}) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [composer, setComposer] = useState<CommentComposer | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const published = Boolean(entry?.published_at);
  const body = entry?.body ?? [];

  const addComment = async (anchor: CommentComposer, text: string) => {
    setComposer(null);
    if (!entry) return;
    await supabase.from("comments").insert({
      entry_id: entry.id,
      author_id: me.id,
      block_id: anchor.blockId,
      anchor_ratio: anchor.anchorRatio,
      quote: anchor.quote,
      quote_start: anchor.quoteStart,
      body: text,
    });
    onCommentsChange();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    onCommentsChange();
  };

  const commentsFor = (blockId: string | undefined) =>
    blockId ? comments.filter((comment) => comment.block_id === blockId) : [];

  /**
   * Locates each note's quote in the block as it reads now: the stored offset is
   * preferred, then the first occurrence, and an edited-away quote simply drops out.
   */
  const highlightsFor = (blockId: string | undefined): Highlight[] => {
    const block = blockId ? body.find((candidate) => blockIdOf(candidate) === blockId) : undefined;
    if (!block) return [];
    const text = blockText(block);

    return commentsFor(blockId).flatMap((comment) => {
      if (!comment.quote) return [];
      const start =
        text.slice(comment.quote_start, comment.quote_start + comment.quote.length) === comment.quote
          ? comment.quote_start
          : text.indexOf(comment.quote);
      if (start < 0) return [];
      return [
        {
          id: comment.id,
          start,
          end: start + comment.quote.length,
          colour: profiles.find((profile) => profile.id === comment.author_id)?.colour ?? "#8a8a8a",
          active: hovered === comment.id,
        },
      ];
    });
  };

  // The author's own prose is the editor, which has no per-block render slots, so their
  // notes all fall back to the single inline section (mobile) below the entry.
  const inlineFallback = editable ? comments : comments.filter((comment) => comment.block_id === null);

  const openComposerFromSelection = () => {
    if (!published) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const node = selection.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const block = element?.closest<HTMLElement>("[data-block-id]");

    const range = selection.getRangeAt(0);

    // Note beside the selected line, not the top of a paragraph that may run for inches.
    const selectionBox = range.getBoundingClientRect();
    const blockBox = block?.getBoundingClientRect();
    const anchorRatio =
      blockBox && blockBox.height > 0
        ? Math.min(Math.max((selectionBox.top - blockBox.top) / blockBox.height, 0), 1)
        : 0;

    // Where the passage sits in the block's text, so it can be highlighted later.
    let quoteStart = 0;
    if (block) {
      const preceding = document.createRange();
      preceding.selectNodeContents(block);
      preceding.setEnd(range.startContainer, range.startOffset);
      quoteStart = preceding.toString().length;
    }

    setComposer({
      blockId: block?.dataset.blockId ?? null,
      anchorRatio,
      quote: block ? range.toString() : "",
      quoteStart,
    });
  };

  return (
    <article className={styles.entry}>
      <span className={`chrome ${styles.author}`} style={{ color: author.colour }}>
        {author.display_name}
      </span>

      <div className={styles.prose} ref={proseRef} onMouseUp={openComposerFromSelection}>
        {editable ? (
          <EntryEditor
            date={date}
            me={me}
            entry={entry}
            placeholder={placeholder}
            onEntryChange={onEntryChange}
          />
        ) : (
          <EntryBody
            body={body}
            highlights={highlightsFor}
            afterBlock={(blockId) => {
              const own = commentsFor(blockId);
              const showComposer = Boolean(blockId) && composer?.blockId === blockId;
              if (own.length === 0 && !showComposer) return null;
              return (
                <div className={`${marginStyles.inline} ${styles.inlineOnly}`}>
                  {own.map((comment) => (
                    <CommentNote
                      key={comment.id}
                      comment={comment}
                      author={profiles.find((profile) => profile.id === comment.author_id)}
                      mine={comment.author_id === me.id}
                      onDelete={deleteComment}
                      onHover={setHovered}
                    />
                  ))}
                  {showComposer && composer ? (
                    <CommentForm
                      onSubmit={(text) => addComment(composer, text)}
                      onCancel={() => setComposer(null)}
                    />
                  ) : null}
                </div>
              );
            }}
          />
        )}

        {published && !composer ? (
          <button
            type="button"
            className={`${marginStyles.inlineTrigger} ${styles.inlineOnly}`}
            onClick={() => setComposer(detachedAnchor)}
          >
            Add a note
          </button>
        ) : null}

        {published && (inlineFallback.length > 0 || composer?.blockId === null) ? (
          <div className={`${marginStyles.inline} ${styles.inlineOnly}`}>
            {inlineFallback.map((comment) => (
              <CommentNote
                key={comment.id}
                comment={comment}
                author={profiles.find((profile) => profile.id === comment.author_id)}
                mine={comment.author_id === me.id}
                onDelete={deleteComment}
                onHover={setHovered}
              />
            ))}
            {composer?.blockId === null ? (
              <CommentForm onSubmit={(text) => addComment(detachedAnchor, text)} onCancel={() => setComposer(null)} />
            ) : null}
          </div>
        ) : null}
      </div>

      {published ? (
        <div className={styles.marginOnly}>
          <MarginColumn
            proseRef={proseRef}
            comments={comments}
            profiles={profiles}
            meId={me.id}
            composer={composer}
            onDelete={deleteComment}
            onSubmit={addComment}
            onCancel={() => setComposer(null)}
            onHover={setHovered}
            version={comments.length}
          />
          <button
            type="button"
            className={styles.marginTarget}
            aria-label="Add a note"
            onClick={() => setComposer(detachedAnchor)}
          />
        </div>
      ) : null}
    </article>
  );
}
