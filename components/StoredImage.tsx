"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const cache = new Map<string, string>();

/** Entry photos live in a private bucket; every render needs a fresh signed URL. */
export function useSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? (cache.get(path) ?? null) : null));

  useEffect(() => {
    if (!path) return;
    if (path.startsWith("blob:") || path.startsWith("http")) {
      setUrl(path);
      return;
    }
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }

    let active = true;
    const supabase = createClient();
    supabase.storage
      .from("entry-images")
      .createSignedUrl(path, 60 * 60 * 8)
      .then(({ data }) => {
        if (!active || !data?.signedUrl) return;
        cache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });

    return () => {
      active = false;
    };
  }, [path]);

  return url;
}

export function StoredImage({
  path,
  alt,
  width,
  height,
}: {
  path: string;
  alt: string;
  width?: number;
  height?: number;
}) {
  const url = useSignedUrl(path);
  const ratio = width && height ? `${width} / ${height}` : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url ?? undefined}
      alt={alt}
      style={{
        width: "100%",
        height: "auto",
        aspectRatio: ratio,
        background: url ? "transparent" : "var(--rule)",
        display: "block",
      }}
    />
  );
}
