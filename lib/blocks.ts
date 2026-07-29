import type { BlockNode } from "@/lib/database.types";

export function newBlockId(): string {
  return crypto.randomUUID();
}

/** Every top-level block carries a stable UUID; comments anchor to it. */
export function withBlockIds(blocks: BlockNode[]): BlockNode[] {
  return blocks.map((block) => (block.id ? block : { ...block, id: newBlockId() }));
}

export function isEmptyBody(body: BlockNode[] | null | undefined): boolean {
  if (!body || body.length === 0) return true;
  return body.every((block) => block.type === "paragraph" && !blockText(block).trim());
}

export function blockText(block: BlockNode): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as { text?: string; content?: unknown[] };
    if (typeof record.text === "string") parts.push(record.text);
    record.content?.forEach(walk);
  };
  walk(block);
  return parts.join("");
}
