/** The two author colours, pulled from the paintings; a mark may use nothing else. */
export const VIOLET = "#7A6E9E";
export const TERRACOTTA = "#C2653A";

const ALLOWED_TAGS = new Set(["svg", "g", "path", "circle", "ellipse", "line", "polyline"]);

const ALLOWED_ATTRS = new Set([
  "viewBox",
  "xmlns",
  "fill",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "opacity",
  "transform",
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "y1",
  "x2",
  "y2",
  "points",
]);

const ALLOWED_COLOURS = new Set([VIOLET.toLowerCase(), TERRACOTTA.toLowerCase(), "none", "currentcolor"]);

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z-]+(?::[a-zA-Z-]+)?\s*=\s*"[^"<>]*")*)\s*\/?>/g;
const ATTR = /([a-zA-Z-]+(?::[a-zA-Z-]+)?)\s*=\s*"([^"<>]*)"/g;

/**
 * Marks arrive as SVG source from a language model, so they are treated as
 * untrusted input: anything outside the drawing subset below is a rejection
 * rather than a strip, since a mark that needs editing is not a good mark.
 */
export function sanitiseMark(raw: string): string | null {
  const svg = raw.trim();
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) return null;
  if (svg.length > 20_000) return null;
  // No text nodes, comments, doctypes, entities or CDATA: only elements and whitespace.
  if (/<[!?]/.test(svg)) return null;
  if (svg.replace(TAG, "").trim() !== "") return null;

  let usesViolet = false;
  let usesTerracotta = false;

  for (const [, tag, attrs] of svg.matchAll(TAG)) {
    if (!ALLOWED_TAGS.has(tag)) return null;
    for (const [, name, value] of attrs.matchAll(ATTR)) {
      if (!ALLOWED_ATTRS.has(name)) return null;
      if (/[<>]|url\(|javascript:|&#/i.test(value)) return null;
      if (name === "fill" || name === "stroke") {
        const colour = value.trim().toLowerCase();
        if (!ALLOWED_COLOURS.has(colour)) return null;
        if (colour === VIOLET.toLowerCase()) usesViolet = true;
        if (colour === TERRACOTTA.toLowerCase()) usesTerracotta = true;
      }
    }
  }

  if (!/viewBox="[\d.\s-]+"/.test(svg)) return null;
  if (!usesViolet || !usesTerracotta) return null;

  return svg;
}

export interface MarkOutput {
  svg: string;
}

export const MARK_OUTPUT_SCHEMA = {
  type: "object",
  properties: { svg: { type: "string" } },
  required: ["svg"],
  additionalProperties: false,
} as const;

/**
 * The day is the only variation the drawing gets: same brief, different mark,
 * so two people's journal accumulates a private alphabet rather than a logo.
 */
export function markPrompt(date: string): string {
  return `Draw a small hand-drawn mark for one day of a private journal kept by two people. The day is ${date} — use it only as a seed for variation; never draw the date, letters, numbers or words.

The mark: two abstract figures side by side, each one continuous gestural line (or a couple of lines) that reads as a figure, each with exactly one small filled dot (a head or a resting point). The two figures share a rhythm without being identical twins: one may lean, coil or open a little differently, and they need not be mirror images. They are two people sitting beside each other, so keep them close and roughly the same size.

Pick the gesture from the day of the month in the date above: take the day number modulo 4 and draw that family for both figures — 0: a spiral that opens outward, its tail curling away; 1: a leaning seed or leaf shape with the dot floating just above it like a head; 2: a soft closed loop with the dot resting inside; 3: a tall coil that unwinds upward, the dot at its top. Within the family let the date shape the particulars: the lean, the number of turns, where the line ends.

Feel: peaceful, intimate, hand-drawn. Lines like a soft brush pen — even weight, moderately thick, every end and join rounded. Slightly imperfect and warm: the imperfection lives in the overall shape, not in the line itself, so a stroke is at most six long smooth curve segments and never has lumps, kinks, facets or little corners along it. Let a loop lean or not quite close, avoid perfect circles, symmetry, grids or anything that looks vector-precise. No frame, no background, no shading, no gradients, no text.

Hard requirements for the SVG you return:
- A single self-contained <svg> element with viewBox="0 0 120 72", no width/height attributes, xmlns="http://www.w3.org/2000/svg".
- Only these elements: g, path, circle, ellipse, line, polyline. No <style>, <defs>, <text>, <filter>, <use>, comments or CSS.
- Exactly two colours, as literal attributes: the left figure in ${VIOLET}, the right figure in ${TERRACOTTA}. Every element has fill="none" or fill set to its figure's colour (dots are filled); stroke is that figure's colour or "none".
- Strokes: stroke-width between 4 and 5.5 (a soft brush pen, generously thick against the 120×72 frame), stroke-linecap="round", stroke-linejoin="round". Each figure's dot is one filled circle with r between 2.5 and 4, clearly separated from the stroke so it reads as a head or a resting point.
- Draw the strokes with cubic bezier curves (C/S commands) so the lines are fluid; no straight polylines pretending to be curves.
- The pair must fill the viewBox: each figure spans at least 46 of the 72 units of height and at least 34 units of width, the two are separated by a gap of only 6–14 units, and together they sit centred with a margin of 4–8 units on every side. No large empty areas — a figure floating small in its half is wrong.
- Keep all geometry inside x 5–115, y 5–67, with the left figure to the left of the gap and the right figure to its right. Nothing may touch or cross the viewBox edge.
- It must still read at 22px tall (a favicon-sized pair of gestures) and at 300px.

Verify before answering: render the SVG to PNG at 24px and at 320px tall (e.g. with sharp or rsvg-convert), look at both, and iterate on the curves until the pair looks like a warm handwritten mark of two figures rather than a geometric icon. Check that nothing is clipped, that the drawing fills the frame rather than floating small inside it, that the two figures are balanced beside each other, and that the colours are exactly the two above.

Return structured output {"svg": "<svg …>…</svg>"} with the final SVG as one line. Do not open a pull request or modify any repository.`;
}
