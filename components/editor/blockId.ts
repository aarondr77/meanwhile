import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "codeBlock",
  "horizontalRule",
  "image",
];

/**
 * Gives every top-level block a UUID that survives editing. Comments anchor to
 * these ids, so splitting a block must mint a new one rather than duplicate.
 */
export const BlockId = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-id"),
            renderHTML: (attributes) => (attributes.id ? { "data-id": attributes.id } : {}),
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockId"),
        appendTransaction: (_transactions, _oldState, newState) => {
          const seen = new Set<string>();
          const missing: { pos: number; attrs: Record<string, unknown> }[] = [];

          newState.doc.forEach((node, offset) => {
            if (!TYPES.includes(node.type.name)) return;
            const id = node.attrs.id as string | null;
            if (!id || seen.has(id)) {
              missing.push({ pos: offset, attrs: node.attrs });
            } else {
              seen.add(id);
            }
          });

          if (missing.length === 0) return null;

          const tr = newState.tr;
          for (const { pos, attrs } of missing) {
            tr.setNodeMarkup(pos, undefined, { ...attrs, id: crypto.randomUUID() });
          }
          return tr.setMeta("addToHistory", false);
        },
      }),
    ];
  },
});
