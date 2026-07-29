// Derives the responsive painting assets shipped in public/paintings from the
// full-size sources in assets/paintings. Run with `npm run paintings`.
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = path.join(process.cwd(), "assets", "paintings");
const OUT_DIR = path.join(process.cwd(), "public", "paintings");
const WIDTHS = [1600, 1024, 640];

await mkdir(OUT_DIR, { recursive: true });

const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith(".png"));

for (const file of files) {
  const slug = path.basename(file, ".png");
  const source = path.join(SOURCE_DIR, file);

  for (const width of WIDTHS) {
    const base = sharp(source).resize({ width, withoutEnlargement: true });
    await base
      .clone()
      .avif({ quality: 55, effort: 6 })
      .toFile(path.join(OUT_DIR, `${slug}-${width}.avif`));
    await base
      .clone()
      .webp({ quality: 78 })
      .toFile(path.join(OUT_DIR, `${slug}-${width}.webp`));
  }

  const { width, height } = await sharp(source).metadata();
  console.log(`${slug}: ${width}x${height} -> ${WIDTHS.join("/")}`);
}
