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

function renderInline(nodes: Node[] | undefined): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hardBreak") return <br key={i} />;
    if (typeof node.text !== "string") return <Fragment key={i}>{renderInline(node.content)}</Fragment>;

    let out: ReactNode = node.text;
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

function renderNode(node: Node, key: string, blockId?: string): ReactNode {
  const anchor = blockId ? { "data-block-id": blockId } : {};

  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className={styles.paragraph} {...anchor}>
          {renderInline(node.content)}
        </p>
      );
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (level <= 2 ? "h3" : "h4") as "h3" | "h4";
      return (
        <Tag key={key} className={styles.heading} {...anchor}>
          {renderInline(node.content)}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key} className={styles.blockquote} {...anchor}>
          {node.content?.map((child, i) => renderNode(child, `${key}-${i}`))}
        </blockquote>
      );
    case "bulletList":
      return (
        <ul key={key} className={styles.list} {...anchor}>
          {node.content?.map((child, i) => renderNode(child, `${key}-${i}`))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className={styles.list} {...anchor}>
          {node.content?.map((child, i) => renderNode(child, `${key}-${i}`))}
        </ol>
      );
    case "listItem":
      return <li key={key}>{node.content?.map((child, i) => renderNode(child, `${key}-${i}`))}</li>;
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
          {renderInline(node.content)}
        </p>
      );
  }
}

export function EntryBody({
  body,
  afterBlock,
}: {
  body: BlockNode[];
  afterBlock?: (blockId: string | undefined) => ReactNode;
}) {
  return (
    <>
      {body.map((block, i) => {
        const id = blockIdOf(block);
        return (
          <Fragment key={id ?? i}>
            {renderNode(block as Node, id ?? String(i), id)}
            {afterBlock?.(id)}
          </Fragment>
        );
      })}
    </>
  );
}
