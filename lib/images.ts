import type { Client } from "@/lib/journal";

const LONG_EDGE = 2000;

export interface UploadedImage {
  path: string;
  width: number;
  height: number;
}

/**
 * Re-encodes through a canvas, which resizes to a 2000px long edge and drops
 * every EXIF field (GPS included) as a side effect of the decode.
 */
async function resize(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("encode failed");
  return { blob, width, height };
}

export async function uploadEntryImage(
  supabase: Client,
  userId: string,
  entryId: string,
  file: File,
): Promise<UploadedImage> {
  const { blob, width, height } = await resize(file);
  const path = `${userId}/${entryId}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage.from("entry-images").upload(path, blob, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw error;

  await supabase.from("images").insert({ entry_id: entryId, storage_path: path, width, height, alt: null });

  return { path, width, height };
}
