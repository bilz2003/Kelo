/**
 * The app treats 2 Aug 2026, 2:32pm as "now" throughout — matching the
 * fictional current date/time the whole prototype (and this port) is set
 * in. Swap this for `new Date()` once wired to a real backend/clock.
 */
export const NOW = new Date(2026, 7, 2, 14, 32);

export const MIN_BOOKING_HOURS = 1;
export const MAX_BOOKING_HOURS = 24; // cap on how far "done by" can extend past arrival
export const MAX_ADVANCE_DAYS = 90; // how far ahead a driver can book an arrival date

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const dayEndOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 45);

export const isSameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
export const dayLabel = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

/** "4 Aug 2026" for a single day, "4–9 Aug 2026" within a month, "28 Jul – 4 Aug, 2026" across months. */
export const formatRangeLabel = (start: Date, end: Date): string => {
  if (isSameDate(start, end)) return `${dayLabel(start)} ${start.getFullYear()}`;
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${dayLabel(start)} – ${dayLabel(end)}, ${end.getFullYear()}`;
};

/**
 * Earliest a driver can select for arrival — rounds up to the next full
 * hour (not just the next 15 minutes), so a host always gets a real
 * amount of notice rather than, say, 2 minutes if it's 2:43pm.
 */
export const nextFullHour = (d: Date): Date => {
  const rounded = new Date(d);
  rounded.setSeconds(0, 0);
  if (rounded.getMinutes() !== 0) {
    rounded.setMinutes(0);
    rounded.setHours(rounded.getHours() + 1);
  }
  return rounded;
};

export const formatTimeOfDay = (d: Date): string => {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")}${ampm}`;
};

/**
 * Same as formatTimeOfDay, but flags when a time falls on a different
 * calendar day than the given anchor — critical once "done by" can run
 * past midnight, so there's never ambiguity about which day is meant.
 */
export const formatTimeWithDay = (d: Date, anchor: Date): string =>
  isSameDate(d, anchor) ? formatTimeOfDay(d) : `${formatTimeOfDay(d)} (${WEEKDAY_NAMES[d.getDay()]})`;

/** Today / Tomorrow / "Tue, 4 Aug" — for the arrival date picker and summaries. */
export const dateLabel = (d: Date): string => {
  const today = startOfDay(NOW);
  const tomorrow = new Date(today.getTime() + 86400000);
  if (isSameDate(d, today)) return "Today";
  if (isSameDate(d, tomorrow)) return "Tomorrow";
  return `${WEEKDAY_NAMES[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
};

/** Every 15-minute slot from min to max inclusive. */
export const timeSlots = (min: Date, max: Date): Date[] => {
  const slots: Date[] = [];
  let t = new Date(min);
  while (t <= max) {
    slots.push(new Date(t));
    t = new Date(t.getTime() + 15 * 60000);
  }
  return slots;
};

/** 7-wide grid of Date | null (Monday-first) for a given month. */
export const calendarCells = (monthDate: Date): (Date | null)[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export const formatDuration = (hours: number): string => {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const defaultTimeRange = () => ({
  mode: "month" as const,
  start: startOfMonth(NOW),
  end: endOfMonth(NOW),
  label: monthLabel(NOW),
});
