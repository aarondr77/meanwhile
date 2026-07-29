"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Comment, Profile } from "@/lib/database.types";
import styles from "./marginalia.module.css";

const GAP = 12;

export interface CommentComposer {
  blockId: string | null;
}

export function CommentNote({
  comment,
  author,
  mine,
  onDelete,
}: {
  comment: Comment;
  author: Profile | undefined;
  mine: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.note}>
      <span className={styles.noteBody}>{comment.body}</span>{" "}
      <span className={`chrome ${styles.noteAuthor}`} style={{ color: author?.colour }}>
        {author?.display_name}
      </span>
      {mine ? (
        <button type="button" className={styles.delete} onClick={() => onDelete(comment.id)} aria-label="Delete comment">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function CommentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <textarea
      ref={ref}
      className={styles.input}
      rows={2}
      value={value}
      placeholder="Note…"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => (value.trim() ? onSubmit(value.trim()) : onCancel())}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
          else onCancel();
        }
        if (event.key === "Escape") onCancel();
      }}
    />
  );
}

/**
 * Places margin notes beside the block they annotate, pushing later notes down
 * when they would collide, and drawing a hairline back to the prose.
 */
export function MarginColumn({
  proseRef,
  comments,
  profiles,
  meId,
  composer,
  onDelete,
  onSubmit,
  onCancel,
  version,
}: {
  proseRef: React.RefObject<HTMLDivElement | null>;
  comments: Comment[];
  profiles: Profile[];
  meId: string;
  composer: CommentComposer | null;
  onDelete: (id: string) => void;
  onSubmit: (blockId: string | null, body: string) => void;
  onCancel: () => void;
  version: number;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<Record<string, number>>({});

  const items = useMemo(
    () => [
      ...comments.map((comment) => ({ key: comment.id, blockId: comment.block_id, comment })),
      ...(composer ? [{ key: "composer", blockId: composer.blockId, comment: null }] : []),
    ],
    [comments, composer],
  );

  const measure = useCallback(() => {
    const prose = proseRef.current;
    const column = columnRef.current;
    if (!prose || !column) return;

    const proseTop = prose.getBoundingClientRect().top;
    const next: Record<string, number> = {};
    let cursor = 0;

    for (const item of items) {
      const node = column.querySelector<HTMLElement>(`[data-note="${item.key}"]`);
      if (!node) continue;

      const anchor = item.blockId
        ? prose.querySelector<HTMLElement>(`[data-block-id="${item.blockId}"]`)
        : null;
      const target = anchor ? anchor.getBoundingClientRect().top - proseTop : prose.offsetHeight;
      const top = Math.max(target, cursor);
      next[item.key] = top;
      cursor = top + node.offsetHeight + GAP;
    }

    setTops((prev) => {
      const same =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.entries(next).every(([key, value]) => Math.abs((prev[key] ?? -1) - value) < 0.5);
      return same ? prev : next;
    });
  }, [items, proseRef]);

  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const observer = new ResizeObserver(() => measure());
    if (proseRef.current) observer.observe(proseRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, proseRef, version]);

  return (
    <div className={styles.column} ref={columnRef}>
      {items.map((item) => (
        <div
          key={item.key}
          data-note={item.key}
          className={styles.slot}
          style={{ top: tops[item.key] ?? 0, opacity: tops[item.key] === undefined ? 0 : 1 }}
        >
          <span className={styles.connector} aria-hidden="true" />
          {item.comment ? (
            <CommentNote
              comment={item.comment}
              author={profiles.find((profile) => profile.id === item.comment!.author_id)}
              mine={item.comment.author_id === meId}
              onDelete={onDelete}
            />
          ) : (
            <CommentForm onSubmit={(body) => onSubmit(item.blockId, body)} onCancel={onCancel} />
          )}
        </div>
      ))}
    </div>
  );
}
