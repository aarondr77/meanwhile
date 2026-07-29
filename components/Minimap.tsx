"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDots, type Dot } from "@/lib/journal";
import { fromIsoDate, monthBounds, monthGrid, MONTH_NAMES, todayIso } from "@/lib/dates";
import type { Profile } from "@/lib/database.types";
import styles from "./minimap.module.css";

/** Months either side of the reading position, oldest last, like the stream itself. */
const SPAN = 1;

function monthsAround(iso: string): { year: number; month: number }[] {
  const anchor = fromIsoDate(`${iso.slice(0, 7)}-01`);
  const months = [];
  for (let offset = SPAN; offset >= -SPAN; offset -= 1) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
    months.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
  }
  return months;
}

/**
 * A scaled-down view of the journal in the left margin: one cell per day, tinted
 * where somebody wrote, with the day being read marked. Clicking a cell jumps.
 */
export function Minimap({
  activeDate,
  profiles,
  onJump,
}: {
  activeDate: string;
  profiles: Profile[];
  onJump: (date: string) => void;
}) {
  const today = todayIso();
  const months = useMemo(() => monthsAround(activeDate), [activeDate]);
  const [dots, setDots] = useState<Dot[]>([]);

  const span = useMemo(() => {
    const first = months[months.length - 1];
    const last = months[0];
    return { start: monthBounds(first.year, first.month).start, end: monthBounds(last.year, last.month).end };
  }, [months]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void fetchDots(supabase, span.start, span.end).then((loaded) => {
      if (active) setDots(loaded);
    });
    return () => {
      active = false;
    };
  }, [span.end, span.start]);

  const authorsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const dot of dots) {
      const list = map.get(dot.entry_date) ?? [];
      if (!list.includes(dot.author_id)) list.push(dot.author_id);
      map.set(dot.entry_date, list);
    }
    return map;
  }, [dots]);

  const colourOf = (authorId: string) =>
    profiles.find((profile) => profile.id === authorId)?.colour ?? "var(--ink-muted)";

  return (
    <nav className={`chrome ${styles.map}`} aria-label="Jump to a day">
      {months.map(({ year, month }) => {
        const prefix = `${year}-${String(month).padStart(2, "0")}`;
        return (
          <div key={prefix} className={styles.month}>
            <span className={styles.label}>{MONTH_NAMES[month - 1].slice(0, 3)}</span>
            <div className={styles.grid}>
              {monthGrid(year, month)
                .flat()
                .map((date) => {
                  if (!date.startsWith(prefix)) return <span key={date} className={styles.blank} />;
                  const authors = authorsByDate.get(date) ?? [];
                  return (
                    <button
                      key={date}
                      type="button"
                      className={`${styles.cell} ${date === activeDate ? styles.active : ""} ${
                        date === today ? styles.today : ""
                      }`}
                      title={date}
                      aria-label={date}
                      aria-current={date === activeDate ? "true" : undefined}
                      onClick={() => onJump(date)}
                    >
                      {authors.map((authorId) => (
                        <span key={authorId} className={styles.dot} style={{ background: colourOf(authorId) }} />
                      ))}
                    </button>
                  );
                })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
