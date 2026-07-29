"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BubbleMenu, EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { createClient } from "@/lib/supabase/client";
import { uploadEntryImage } from "@/lib/images";
import { isEmptyBody } from "@/lib/blocks";
import type { BlockNode, Entry, Profile } from "@/lib/database.types";
import { BlockId } from "./editor/blockId";
import { StoredImageNode } from "./editor/StoredImageNode";
import styles from "./editor.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

export function EntryEditor({
  date,
  me,
  entry,
  placeholder,
  onEntryChange,
}: {
  date: string;
  me: Profile;
  entry: Entry | null;
  placeholder: string;
  onEntryChange: (entry: Entry) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const entryRef = useRef<Entry | null>(entry);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState(false);

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  const persist = useCallback(
    async (body: BlockNode[]) => {
      setSaveState("saving");
      const existing = entryRef.current;
      const payload = existing
        ? { id: existing.id, author_id: me.id, entry_date: date, body }
        : { author_id: me.id, entry_date: date, body };

      const { data, error } = await supabase
        .from("entries")
        .upsert(payload, { onConflict: "author_id,entry_date" })
        .select()
        .single();

      if (error || !data) {
        setSaveState("error");
        return;
      }

      entryRef.current = data as Entry;
      onEntryChange(data as Entry);
      setSaveState("saved");
      setSavedAt(
        new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      );
    },
    [date, me.id, onEntryChange, supabase],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      BlockId,
      Link.configure({ openOnClick: false, autolink: true }),
      StoredImageNode.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: entry?.body?.length ? ({ type: "doc", content: entry.body } as JSONContent) : "",
    editorProps: {
      attributes: { class: styles.prose },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        void handleFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const dragEvent = event as DragEvent;
        const files = Array.from(dragEvent.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        void handleFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      if (timer.current) clearTimeout(timer.current);
      const body = (instance.getJSON().content ?? []) as BlockNode[];
      timer.current = setTimeout(() => void persist(body), 800);
    },
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0 || !editor) return;

      setUploadError(false);
      let current = entryRef.current;
      if (!current) {
        const body = (editor.getJSON().content ?? []) as BlockNode[];
        await persist(body);
        current = entryRef.current;
      }
      if (!current) return;

      for (const file of images) {
        const objectUrl = URL.createObjectURL(file);
        editor.chain().focus().setImage({ src: objectUrl, alt: "" }).run();
        try {
          const uploaded = await uploadEntryImage(supabase, me.id, current.id, file);
          const { state, view } = editor;
          state.doc.descendants((node, pos) => {
            if (node.type.name === "image" && node.attrs.src === objectUrl) {
              view.dispatch(
                state.tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  src: uploaded.path,
                  width: uploaded.width,
                  height: uploaded.height,
                }),
              );
              return false;
            }
            return true;
          });
        } catch {
          setUploadError(true);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }

      void persist((editor.getJSON().content ?? []) as BlockNode[]);
    },
    [editor, me.id, persist, supabase],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const publish = async () => {
    if (!editor) return;
    if (timer.current) clearTimeout(timer.current);
    const body = (editor.getJSON().content ?? []) as BlockNode[];
    await persist(body);
    const current = entryRef.current;
    if (!current) return;

    const { data } = await supabase
      .from("entries")
      .update({ published_at: new Date().toISOString() })
      .eq("id", current.id)
      .select()
      .single();
    if (data) {
      entryRef.current = data as Entry;
      onEntryChange(data as Entry);
    }
  };

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link", previous ?? "https://");
    if (href === null) return;
    if (href === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const draft = !entryRef.current?.published_at;
  const empty = !editor || isEmptyBody((editor.getJSON().content ?? []) as BlockNode[]);

  return (
    <div className={styles.wrap}>
      {editor ? (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className={`chrome ${styles.bubble}`}>
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
            <strong>B</strong>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
            <em>I</em>
          </button>
          <button type="button" onClick={setLink} aria-label="Link">
            Link
          </button>
        </BubbleMenu>
      ) : null}

      <EditorContent editor={editor} />

      {draft && !empty ? (
        <div className={styles.publishRow}>
          <button type="button" className={`chrome ${styles.publish}`} onClick={() => void publish()}>
            Publish
          </button>
          <span className={`chrome ${styles.private}`}>Only you can see this</span>
        </div>
      ) : null}

      <div className={`chrome ${styles.status}`} aria-live="polite">
        {saveState === "saving" ? "Saving" : null}
        {saveState === "saved" && savedAt ? `Saved ${savedAt}` : null}
        {saveState === "error" ? "Not saved" : null}
        {uploadError ? (
          <button type="button" className={styles.retry} onClick={() => setUploadError(false)}>
            Image failed — dismiss
          </button>
        ) : null}
      </div>

      {editor ? (
        <div className={`chrome ${styles.accessory}`}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}>
            <strong>B</strong>
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <em>I</em>
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={setLink}>
            Link
          </button>
        </div>
      ) : null}
    </div>
  );
}
