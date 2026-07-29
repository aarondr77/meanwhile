"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Comment, Profile } from "@/lib/database.types";
import styles from "./marginalia.module.css";

const GAP = 12;

export interface CommentComposer {
  blockId: string | null;
  anchorRatio: number;
  quote: string;
  quoteStart: number;
}

export function CommentNote({
  comment,
  author,
  mine,
  onDelete,
  onHover,
}: {
  comment: Comment;
  author: Profile | undefined;
  mine: boolean;
  onDelete: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <div
      className={styles.note}
      onMouseEnter={() => onHover(comment.id)}
      onMouseLeave={() => onHover(null)}
    >
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
  onHover,
  version,
}: {
  proseRef: React.RefObject<HTMLDivElement | null>;
  comments: Comment[];
  profiles: Profile[];
  meId: string;
  composer: CommentComposer | null;
  onDelete: (id: string) => void;
  onSubmit: (anchor: CommentComposer, body: string) => void;
  onCancel: () => void;
  onHover: (id: string | null) => void;
  version: number;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<Record<string, number>>({});

  const items = useMemo(
    () => [
      ...comments.map((comment) => ({
        key: comment.id,
        blockId: comment.block_id,
        anchorRatio: comment.anchor_ratio,
        comment,
      })),
      ...(composer
        ? [{ key: "composer", blockId: composer.blockId, anchorRatio: composer.anchorRatio, comment: null }]
        : []),
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

    // Lay out top-down by anchor position, not by comment age, so an unanchored note
    // sitting at the foot of the entry cannot drag later notes down with it.
    const placed = items
      .map((item) => {
        const node = column.querySelector<HTMLElement>(`[data-note="${item.key}"]`);
        if (!node) return null;
        const anchor = item.blockId
          ? prose.querySelector<HTMLElement>(`[data-block-id="${item.blockId}"]`)
          : null;
        const box = anchor?.getBoundingClientRect();
        const target = box ? box.top - proseTop + item.anchorRatio * box.height : prose.offsetHeight;
        return { key: item.key, node, target };
      })
      .filter((entry): entry is { key: string; node: HTMLElement; target: number } => entry !== null)
      .sort((a, b) => a.target - b.target);

    for (const { key, node, target } of placed) {
      const top = Math.max(target, cursor);
      next[key] = top;
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
              onHover={onHover}
            />
          ) : composer ? (
            <CommentForm onSubmit={(body) => onSubmit(composer, body)} onCancel={onCancel} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
