"use client";

import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { StoredImage } from "../StoredImage";

const number = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

function View({ node, selected }: NodeViewProps) {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";

  return (
    <NodeViewWrapper
      as="figure"
      data-drag-handle
      style={{ margin: "0 0 1.4em", outline: selected ? "2px solid var(--rule)" : "none" }}
    >
      <StoredImage path={src} alt={alt} width={number(node.attrs.width)} height={number(node.attrs.height)} />
    </NodeViewWrapper>
  );
}

/**
 * Photos are stored as bucket paths, which a bare <img src> cannot load, so the
 * editor renders them through the same signed-URL component the reader uses.
 */
export const StoredImageNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      height: { default: null },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(View);
  },
});
