"use client";

import { useEffect, useState } from "react";
import styles from "./stream.module.css";

const POLL_MS = 20_000;
/** Roughly twenty minutes of polling: a drawing that slow is not coming. */
const MAX_POLLS = 60;

interface MarkResponse {
  state: "ready" | "pending" | "failed" | "none";
  svg: string | null;
}

/**
 * The day's mark, drawn once by a Devin session when the day is first published.
 * Absent, unfinished and failed marks all render as nothing: the heading is the page.
 */
export function DayMark({ date, published }: { date: string; published: boolean }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!published || svg) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Everything but a drawn mark and an admitted failure is worth another look: a
    // just-published day is briefly unclaimed, and a dropped request means nothing.
    const tick = async () => {
      polls += 1;
      let again = true;
      try {
        const response = await fetch(`/api/day-mark?date=${date}`);
        if (response.ok) {
          const mark = (await response.json()) as MarkResponse;
          if (cancelled) return;
          if (mark.state === "ready" && mark.svg) {
            setSvg(mark.svg);
            return;
          }
          again = mark.state !== "failed";
        }
      } catch {
        // Offline or mid-deploy: try again on the next tick.
      }
      if (again && polls < MAX_POLLS) timer = setTimeout(() => void tick(), POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [date, published, svg]);

  if (!svg) return null;

  // Server-sanitised against a small drawing subset of SVG before it was stored.
  return <span className={styles.mark} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}
