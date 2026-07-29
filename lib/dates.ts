export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** YYYY-MM-DD in the viewer's local time. Dates are calendar squares, never instants. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = fromIsoDate(value);
  return toIsoDate(date) === value;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "Tuesday 14 July" — the stream's day heading. */
export function formatDayHeading(iso: string): string {
  const date = fromIsoDate(iso);
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export function formatMonthYear(iso: string): string {
  const date = fromIsoDate(`${iso.slice(0, 7)}-01`);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Six Sunday-first weeks covering the given month. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const weeks: string[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w += 1) {
    const week: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(toIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  return {
    start: toIsoDate(new Date(year, month - 1, 1)),
    end: toIsoDate(new Date(year, month, 0)),
  };
}
