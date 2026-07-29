"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchComments, fetchEntries, sortEntriesForDay } from "@/lib/journal";
import { addDays, formatDayHeading, formatMonthYear, MONTH_NAMES, todayIso } from "@/lib/dates";
import { paintingForMonth } from "@/lib/paintings";
import type { Comment, Entry, Profile } from "@/lib/database.types";
import { EntryArticle } from "./EntryArticle";
import { Painting } from "./Painting";
import styles from "./stream.module.css";

const WINDOW_DAYS = 14;

export function Stream({
  me,
  profiles,
  initialDate,
  onBack,
}: {
  me: Profile;
  profiles: Profile[];
  initialDate: string;
  onBack: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const today = todayIso();
  const [range, setRange] = useState({ start: addDays(initialDate, -(WINDOW_DAYS - 1)), end: initialDate });
  const [entries, setEntries] = useState<Entry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [topMonth, setTopMonth] = useState(initialDate);
  const loading = useRef(false);
  const anchorHeight = useRef<number | null>(null);

  const load = useCallback(
    async (start: string, end: string) => {
      const loaded = await fetchEntries(supabase, start, end);
      setEntries((prev) => {
        const byId = new Map(prev.map((entry) => [entry.id, entry]));
        loaded.forEach((entry) => byId.set(entry.id, entry));
        return [...byId.values()];
      });
      const fresh = await fetchComments(
        supabase,
        loaded.map((entry) => entry.id),
      );
      setComments((prev) => {
        const byId = new Map(prev.map((comment) => [comment.id, comment]));
        fresh.forEach((comment) => byId.set(comment.id, comment));
        return [...byId.values()];
      });
    },
    [supabase],
  );

  const refreshComments = useCallback(async () => {
    const ids = entries.map((entry) => entry.id);
    const fresh = await fetchComments(supabase, ids);
    setComments(fresh);
  }, [entries, supabase]);

  useEffect(() => {
    void load(range.start, range.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extendOlder = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const nextStart = addDays(range.start, -WINDOW_DAYS);
    await load(nextStart, addDays(range.start, -1));
    setRange((prev) => ({ ...prev, start: nextStart }));
    loading.current = false;
  }, [load, range.start]);

  const extendNewer = useCallback(async () => {
    if (loading.current || range.end >= today) return;
    loading.current = true;
    const nextEnd = addDays(range.end, WINDOW_DAYS) > today ? today : addDays(range.end, WINDOW_DAYS);
    // Measure before insertion so the viewport does not jump when content is prepended.
    anchorHeight.current = document.documentElement.scrollHeight;
    await load(addDays(range.end, 1), nextEnd);
    setRange((prev) => ({ ...prev, end: nextEnd }));
    loading.current = false;
  }, [load, range.end, today]);

  useLayoutEffect(() => {
    if (anchorHeight.current === null) return;
    const delta = document.documentElement.scrollHeight - anchorHeight.current;
    anchorHeight.current = null;
    if (delta > 0) window.scrollBy(0, delta);
  }, [range.end]);

  const days = useMemo(() => {
    const byDate = new Map<string, Entry[]>();
    for (const entry of entries) {
      if (entry.entry_date < range.start || entry.entry_date > range.end) continue;
      const list = byDate.get(entry.entry_date) ?? [];
      list.push(entry);
      byDate.set(entry.entry_date, list);
    }
    if (initialDate >= range.start && initialDate <= range.end && !byDate.has(initialDate)) {
      byDate.set(initialDate, []);
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({ date, entries: sortEntriesForDay(list) }));
  }, [entries, initialDate, range.end, range.start]);

  // The fragment always names the day at the top of the viewport; never pushState.
  useEffect(() => {
    const onScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>("[data-day]");
      let current: string | null = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 80) current = section.dataset.day ?? null;
      }
      if (current) {
        setTopMonth(current);
        if (window.location.hash !== `#${current}`) {
          history.replaceState(null, "", `#${current}`);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [days]);

  const topSentinel = useRef<HTMLDivElement>(null);
  const bottomSentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          if (record.target === topSentinel.current) void extendNewer();
          if (record.target === bottomSentinel.current) void extendOlder();
        }
      },
      { rootMargin: "600px 0px" },
    );
    if (topSentinel.current) observer.observe(topSentinel.current);
    if (bottomSentinel.current) observer.observe(bottomSentinel.current);
    return () => observer.disconnect();
  }, [extendNewer, extendOlder]);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-day="${initialDate}"]`);
    target?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length > 0]);

  const upsertEntry = (entry: Entry) => {
    setEntries((prev) => {
      const next = prev.filter((existing) => existing.id !== entry.id);
      next.push(entry);
      return next;
    });
  };

  return (
    <div className={styles.page}>
      <Link
        href="/"
        className={`chrome ${styles.back}`}
        onClick={(event) => {
          event.preventDefault();
          onBack();
        }}
      >
        ← {formatMonthYear(topMonth)}
      </Link>

      <div ref={topSentinel} />

      {days.map(({ date, entries: dayEntries }, index) => {
        const next = days[index + 1];
        const crossesMonth = next && next.date.slice(0, 7) !== date.slice(0, 7);
        const ownEntry = dayEntries.find((entry) => entry.author_id === me.id) ?? null;
        const others = dayEntries.filter((entry) => entry.author_id !== me.id && entry.published_at);
        const writable = date <= today;

        return (
          <div key={date}>
            <section className={styles.day} data-day={date} id={date}>
              <h2 className={styles.dayHeading}>{formatDayHeading(date)}</h2>

              {sortEntriesForDay([...others, ...(ownEntry ? [ownEntry] : [])]).map((entry) => {
                const author = profiles.find((profile) => profile.id === entry.author_id);
                if (!author) return null;
                const mine = entry.author_id === me.id;
                return (
                  <EntryArticle
                    key={entry.id}
                    entry={entry}
                    date={date}
                    author={author}
                    me={me}
                    profiles={profiles}
                    comments={comments.filter((comment) => comment.entry_id === entry.id)}
                    editable={mine}
                    placeholder={`Write about ${formatDayHeading(date).split(" ")[0]}…`}
                    onEntryChange={upsertEntry}
                    onCommentsChange={() => void refreshComments()}
                  />
                );
              })}

              {!ownEntry && writable ? (
                <EntryArticle
                  entry={null}
                  date={date}
                  author={me}
                  me={me}
                  profiles={profiles}
                  comments={[]}
                  editable
                  placeholder={`Write about ${formatDayHeading(date).split(" ")[0]}…`}
                  onEntryChange={upsertEntry}
                  onCommentsChange={() => void refreshComments()}
                />
              ) : null}
            </section>

            {crossesMonth ? (
              <div className={styles.seam}>
                <Painting
                  slug={paintingForMonth(Number(next.date.slice(5, 7)))}
                  sizes="100vw"
                  className={styles.seamImage}
                  decorative
                />
                <span className={styles.seamLabel}>{MONTH_NAMES[Number(next.date.slice(5, 7)) - 1]}</span>
              </div>
            ) : null}
          </div>
        );
      })}

      <div ref={bottomSentinel} />
    </div>
  );
}
