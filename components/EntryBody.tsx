"use client";

import { Fragment, type ReactNode } from "react";
import type { BlockNode, Json } from "@/lib/database.types";
import { StoredImage } from "./StoredImage";
import styles from "./entry.module.css";

interface Mark {
  type: string;
  attrs?: { href?: string };
}

interface Node {
  type?: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, Json>;
  content?: Node[];
}

/** A quoted passage, addressed by character offsets into the block's text. */
export interface Highlight {
  id: string;
  start: number;
  end: number;
  colour: string;
  active: boolean;
}

interface Ink {
  /** Characters of the block consumed so far, so text nodes know their own offset. */
  offset: number;
  highlights: Highlight[];
}

/** Splits a text node wherever a quote begins or ends, marking the quoted spans. */
function paint(text: string, ink: Ink): ReactNode {
  const start = ink.offset;
  ink.offset += text.length;

  const cuts = new Set([0, text.length]);
  for (const highlight of ink.highlights) {
    for (const edge of [highlight.start - start, highlight.end - start]) {
      if (edge > 0 && edge < text.length) cuts.add(edge);
    }
  }

  const bounds = [...cuts].sort((a, b) => a - b);
  return bounds.slice(0, -1).map((from, i) => {
    const to = bounds[i + 1];
    const slice = text.slice(from, to);
    const highlight = ink.highlights.find(
      (candidate) => candidate.start <= start + from && candidate.end >= start + to,
    );
    if (!highlight) return <Fragment key={from}>{slice}</Fragment>;
    return (
      <mark
        key={from}
        className={styles.quoted}
        data-comment-id={highlight.id}
        style={{ background: `${highlight.colour}${highlight.active ? "4d" : "1f"}` }}
      >
        {slice}
      </mark>
    );
  });
}

function renderInline(nodes: Node[] | undefined, ink: Ink): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hardBreak") return <br key={i} />;
    if (typeof node.text !== "string") return <Fragment key={i}>{renderInline(node.content, ink)}</Fragment>;

    let out: ReactNode = paint(node.text, ink);
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") out = <strong>{out}</strong>;
      else if (mark.type === "italic") out = <em>{out}</em>;
      else if (mark.type === "code") out = <code>{out}</code>;
      else if (mark.type === "link")
        out = (
          <a href={mark.attrs?.href} target="_blank" rel="noreferrer noopener">
            {out}
          </a>
        );
    }
    return <Fragment key={i}>{out}</Fragment>;
  });
}

/** TipTap keeps the block id in attrs; older rows may carry it at the top level. */
export function blockIdOf(block: BlockNode): string | undefined {
  const fromAttrs = block.attrs?.id;
  if (typeof fromAttrs === "string") return fromAttrs;
  return typeof block.id === "string" ? block.id : undefined;
}

function renderNode(node: Node, key: string, ink: Ink, blockId?: string): ReactNode {
  const anchor = blockId ? { "data-block-id": blockId } : {};

  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className={styles.paragraph} {...anchor}>
          {renderInline(node.content, ink)}
        </p>
      );
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (level <= 2 ? "h3" : "h4") as "h3" | "h4";
      return (
        <Tag key={key} className={styles.heading} {...anchor}>
          {renderInline(node.content, ink)}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key} className={styles.blockquote} {...anchor}>
          {node.content?.map((child, i) => renderNode(child, `${key}-${i}`, ink))}
        </blockquote>
      );
    case "bulletList":
      return (
        <ul key={key} className={styles.list} {...anchor}>
          {node.content?.map((child, i) => renderNode(child, `${key}-${i}`, ink))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className={styles.list} {...anchor}>
          {node.content?.map((child, i) => renderNode(child, `${key}-${i}`, ink))}
        </ol>
      );
    case "listItem":
      return <li key={key}>{node.content?.map((child, i) => renderNode(child, `${key}-${i}`, ink))}</li>;
    case "horizontalRule":
      return <hr key={key} className={styles.rule} {...anchor} />;
    case "image": {
      const src = String(node.attrs?.src ?? "");
      const alt = String(node.attrs?.alt ?? "");
      const width = node.attrs?.width ? Number(node.attrs.width) : undefined;
      const height = node.attrs?.height ? Number(node.attrs.height) : undefined;
      return (
        <figure key={key} className={styles.figure} {...anchor}>
          <StoredImage path={src} alt={alt} width={width} height={height} />
          {alt ? <figcaption className={styles.caption}>{alt}</figcaption> : null}
        </figure>
      );
    }
    default:
      return (
        <p key={key} className={styles.paragraph} {...anchor}>
          {renderInline(node.content, ink)}
        </p>
      );
  }
}

export function EntryBody({
  body,
  afterBlock,
  highlights,
}: {
  body: BlockNode[];
  afterBlock?: (blockId: string | undefined) => ReactNode;
  highlights?: (blockId: string | undefined) => Highlight[];
}) {
  return (
    <>
      {body.map((block, i) => {
        const id = blockIdOf(block);
        const ink: Ink = { offset: 0, highlights: highlights?.(id) ?? [] };
        return (
          <Fragment key={id ?? i}>
            {renderNode(block as Node, id ?? String(i), ink, id)}
            {afterBlock?.(id)}
          </Fragment>
        );
      })}
    </>
  );
}
