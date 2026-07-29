"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Comment, Entry, Profile } from "@/lib/database.types";
import { EntryBody } from "./EntryBody";
import { EntryEditor } from "./EntryEditor";
import { CommentForm, CommentNote, MarginColumn, type CommentComposer } from "./Marginalia";
import marginStyles from "./marginalia.module.css";
import styles from "./stream.module.css";

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
  const supabase = useMemo(() => createClient(), []);

  const published = Boolean(entry?.published_at);
  const body = entry?.body ?? [];

  const addComment = async (blockId: string | null, text: string) => {
    setComposer(null);
    if (!entry) return;
    await supabase.from("comments").insert({
      entry_id: entry.id,
      author_id: me.id,
      block_id: blockId,
      body: text,
    });
    onCommentsChange();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    onCommentsChange();
  };

  const commentsFor = (blockId: string | undefined) =>
    comments.filter((comment) => (blockId ? comment.block_id === blockId : comment.block_id === null));

  const openComposerFromSelection = () => {
    if (!published) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const node = selection.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const block = element?.closest<HTMLElement>("[data-block-id]");
    setComposer({ blockId: block?.dataset.blockId ?? null });
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
            afterBlock={(blockId) => {
              const own = commentsFor(blockId);
              const showComposer = composer && composer.blockId === blockId;
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
                    />
                  ))}
                  {showComposer ? (
                    <CommentForm
                      onSubmit={(text) => addComment(blockId ?? null, text)}
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
            onClick={() => setComposer({ blockId: null })}
          >
            Add a note
          </button>
        ) : null}

        {published && composer && composer.blockId === null ? (
          <div className={`${marginStyles.inline} ${styles.inlineOnly}`}>
            <CommentForm onSubmit={(text) => addComment(null, text)} onCancel={() => setComposer(null)} />
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
            version={comments.length}
          />
          <button
            type="button"
            className={styles.marginTarget}
            aria-label="Add a note"
            onClick={() => setComposer({ blockId: null })}
          />
        </div>
      ) : null}
    </article>
  );
}
