import { paintingAlt, paintingFallback, paintingSrcSet, type PaintingSlug } from "@/lib/paintings";

export function Painting({
  slug,
  sizes,
  className,
  decorative = false,
}: {
  slug: PaintingSlug;
  sizes: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <picture>
      <source type="image/avif" srcSet={paintingSrcSet(slug, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={paintingSrcSet(slug, "webp")} sizes={sizes} />
      <img
        src={paintingFallback(slug)}
        alt={decorative ? "" : paintingAlt(slug)}
        aria-hidden={decorative || undefined}
        className={className}
        width={1536}
        height={1024}
      />
    </picture>
  );
}
