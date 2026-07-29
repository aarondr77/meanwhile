"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDots, type Dot } from "@/lib/journal";
import { MONTH_NAMES, monthBounds, monthGrid, todayIso } from "@/lib/dates";
import { paintingForMonth } from "@/lib/paintings";
import type { Profile } from "@/lib/database.types";
import { Painting } from "./Painting";
import styles from "./calendar.module.css";

const DAY_INITIALS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function monthCacheKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function Calendar({ profiles, onOpenDay }: { profiles: Profile[]; onOpenDay: (date: string) => void }) {
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [dotsByMonth, setDotsByMonth] = useState<Record<string, Dot[]>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const loadMonth = useCallback(async (year: number, month: number) => {
    const key = monthCacheKey(year, month);
    let already = false;
    setDotsByMonth((prev) => {
      already = key in prev;
      return prev;
    });
    if (already) return;

    const { start, end } = monthBounds(year, month);
    const supabase = createClient();
    const dots = await fetchDots(supabase, start, end);
    setDotsByMonth((prev) => ({ ...prev, [key]: dots }));
  }, []);

  useEffect(() => {
    const { year, month } = cursor;
    void loadMonth(year, month);
    // Adjacent months are prefetched so dots are already there on navigation.
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    void loadMonth(prev.year, prev.month);
    void loadMonth(next.year, next.month);
  }, [cursor, loadMonth]);

  const dotsByDate = useMemo(() => {
    const dots = dotsByMonth[monthCacheKey(cursor.year, cursor.month)] ?? [];
    const map = new Map<string, string[]>();
    for (const dot of dots) {
      const list = map.get(dot.entry_date) ?? [];
      list.push(dot.author_id);
      map.set(dot.entry_date, list);
    }
    return map;
  }, [cursor, dotsByMonth]);

  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const monthPrefix = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;

  const step = (delta: number) => {
    setCursor(({ year, month }) => {
      const next = month + delta;
      if (next < 1) return { year: year - 1, month: 12 };
      if (next > 12) return { year: year + 1, month: 1 };
      return { year, month: next };
    });
  };

  const onKeyDown = (event: React.KeyboardEvent, date: string) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();

    const flat = weeks.flat();
    const index = flat.indexOf(date);
    const target = flat[index + delta];
    if (!target) return;
    setFocused(target);
    const node = gridRef.current?.querySelector<HTMLElement>(`[data-date="${target}"]`);
    node?.focus();
  };

  return (
    <main className={styles.page}>
      <div className={styles.calendar}>
        <div className={styles.binding} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={styles.ring} />
          ))}
        </div>

        <Painting
          slug={paintingForMonth(cursor.month)}
          sizes="(max-width: 640px) 100vw, 928px"
          className={styles.painting}
        />

        <header className={styles.header}>
          <h1 className={styles.title}>
            {MONTH_NAMES[cursor.month - 1]} <span className={styles.year}>{cursor.year}</span>
          </h1>
          <div className={styles.nav}>
            <button type="button" className={`chrome ${styles.arrow}`} onClick={() => step(-1)} aria-label="Previous month">
              ←
            </button>
            <button type="button" className={`chrome ${styles.arrow}`} onClick={() => step(1)} aria-label="Next month">
              →
            </button>
          </div>
        </header>

        <div className={styles.grid} ref={gridRef} role="grid" aria-label={`${MONTH_NAMES[cursor.month - 1]} ${cursor.year}`}>
          {DAY_INITIALS.map((day) => (
            <div key={day} className={`chrome ${styles.dayName}`} role="columnheader">
              <span className={styles.dayNameFull}>{day}</span>
              <span className={styles.dayNameShort}>{day.slice(0, 1)}</span>
            </div>
          ))}

          {weeks.flat().map((date) => {
            const inMonth = date.startsWith(monthPrefix);
            const isToday = date === today;
            const isFuture = date > today;
            const authors = dotsByDate.get(date) ?? [];
            const clickable = inMonth && !isFuture;

            return (
              <div
                key={date}
                role="gridcell"
                data-date={date}
                tabIndex={clickable && (focused === date || (!focused && isToday)) ? 0 : -1}
                aria-disabled={!clickable}
                className={[styles.cell, inMonth ? "" : styles.outside, clickable ? styles.clickable : ""].join(" ")}
                onClick={clickable ? () => onOpenDay(date) : undefined}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    if (!clickable) return;
                    event.preventDefault();
                    onOpenDay(date);
                    return;
                  }
                  onKeyDown(event, date);
                }}
              >
                <span className={`chrome ${styles.number} ${isToday ? styles.today : ""}`}>
                  {Number(date.slice(8, 10))}
                </span>
                {authors.length > 0 ? (
                  <span className={styles.dots}>
                    {profiles
                      .filter((profile) => authors.includes(profile.id))
                      .map((profile) => (
                        <span
                          key={profile.id}
                          className={styles.dot}
                          style={{ background: profile.colour }}
                          title={profile.display_name}
                        />
                      ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <footer className={`chrome ${styles.legend}`}>
          {profiles.map((profile) => (
            <span key={profile.id} className={styles.legendItem}>
              <span className={styles.dot} style={{ background: profile.colour }} />
              {profile.display_name}
            </span>
          ))}
        </footer>
      </div>
    </main>
  );
}
