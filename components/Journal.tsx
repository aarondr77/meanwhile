"use client";

import { useEffect, useState } from "react";
import { isValidIsoDate } from "@/lib/dates";
import type { Profile } from "@/lib/database.types";
import { Calendar } from "./Calendar";
import { Stream } from "./Stream";

function hashDate(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.location.hash.replace(/^#/, "");
  return isValidIsoDate(value) ? value : null;
}

/** One route: the calendar, unless the fragment names a day. */
export function Journal({ me, profiles }: { me: Profile; profiles: Profile[] }) {
  const [date, setDate] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDate(hashDate());
    setReady(true);
    const onHashChange = () => setDate(hashDate());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (!ready) return null;

  if (date) {
    return (
      <Stream
        key={date}
        me={me}
        profiles={profiles}
        initialDate={date}
        onBack={() => {
          history.replaceState(null, "", window.location.pathname);
          setDate(null);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <Calendar
      profiles={profiles}
      onOpenDay={(day) => {
        window.location.hash = day;
      }}
    />
  );
}
