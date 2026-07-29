export type PaintingSlug =
  | "winter-path"
  | "twilight-birch-grove"
  | "rainy-spring-garden"
  | "alpine-valley"
  | "coastal-dunes"
  | "fall-harvest"
  | "misty-morning"
  | "autum-path";

// Month number (1-12) to painting. Repeats are intentional.
const BY_MONTH: Record<number, PaintingSlug> = {
  1: "winter-path",
  2: "winter-path",
  3: "twilight-birch-grove",
  4: "rainy-spring-garden",
  5: "rainy-spring-garden",
  6: "alpine-valley",
  7: "coastal-dunes",
  8: "fall-harvest",
  9: "misty-morning",
  10: "autum-path",
  11: "autum-path",
  12: "winter-path",
};

const ALT: Record<PaintingSlug, string> = {
  "winter-path": "A track through snow-covered fields under a pale winter sky.",
  "twilight-birch-grove": "A birch grove at twilight, pink sky between white trunks.",
  "rainy-spring-garden": "Rain falling on a cottage garden of peonies and hydrangeas.",
  "alpine-valley": "A wildflower meadow above a hazy alpine valley at dawn.",
  "coastal-dunes": "Sea grass on dunes above a calm sea at sunset.",
  "fall-harvest": "Haystacks and a cart track in a gold field on a still day.",
  "misty-morning": "A lone willow in a misty meadow at first light.",
  "autum-path": "A dirt path between orange trees on a soft autumn morning.",
};

export const PAINTING_WIDTHS = [640, 1024, 1600] as const;

export function paintingForMonth(month: number): PaintingSlug {
  return BY_MONTH[month];
}

export function paintingAlt(slug: PaintingSlug): string {
  return ALT[slug];
}

export function paintingSrcSet(slug: PaintingSlug, ext: "avif" | "webp"): string {
  return PAINTING_WIDTHS.map((w) => `/paintings/${slug}-${w}.${ext} ${w}w`).join(", ");
}

export function paintingFallback(slug: PaintingSlug): string {
  return `/paintings/${slug}-1024.webp`;
}
