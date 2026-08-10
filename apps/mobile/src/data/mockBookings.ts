import { Booking } from "@kelo/core";
import { monthKey, startOfMonth } from "@kelo/core";

export const BOOKINGS: Booking[] = [
  { id: 1, title: "Wallbox Pulsar Plus", host: "Priya · SM5", date: "Tomorrow, 9:00am", status: "Upcoming", cost: null, dateISO: "2026-08-03" },
  { id: 2, title: "Ohme Home Pro", host: "James · SM5", date: "1 Aug, 6:20pm", status: "Completed", cost: "£4.87", dateISO: "2026-08-01" },
  { id: 3, title: "Zaptec Go", host: "Tom · SM4", date: "29 Jul, 8:05am", status: "Completed", cost: "£7.12", dateISO: "2026-07-29" },
  { id: 4, title: "Pod Point Solo 3", host: "Aisha · SM5", date: "22 Jul, 1:00pm", status: "Cancelled", cost: null, dateISO: "2026-07-22" },
  { id: 5, title: "Easee One", host: "Michael · SM1", date: "30 Jun, 7:15pm", status: "Completed", cost: "£9.40", dateISO: "2026-06-30" },
  { id: 6, title: "myenergi Zappi", host: "Grace · SM5", date: "14 Jun, 11:30am", status: "Completed", cost: "£3.62", dateISO: "2026-06-14" },
  { id: 7, title: "Hypervolt Home 3", host: "Fatima · SM3", date: "2 Jun, 5:00pm", status: "Cancelled", cost: null, dateISO: "2026-06-02" },
  { id: 8, title: "EO Mini Pro 3", host: "Daniel · SM6", date: "20 May, 8:45am", status: "Completed", cost: "£5.28", dateISO: "2026-05-20" },
  { id: 9, title: "Ohme Home Pro", host: "Oliver · SM2", date: "6 May, 6:10pm", status: "Completed", cost: "£8.05", dateISO: "2026-05-06" },
  { id: 10, title: "Wallbox Pulsar Plus", host: "Sana · CR4", date: "22 Apr, 9:30am", status: "Completed", cost: "£4.15", dateISO: "2026-04-22" },
  { id: 11, title: "Zaptec Go", host: "Liam · SM7", date: "9 Apr, 7:00pm", status: "Completed", cost: "£6.30", dateISO: "2026-04-09" },
  { id: 12, title: "Pod Point Solo 3", host: "Ruth · CR0", date: "27 Feb, 3:20pm", status: "Completed", cost: "£7.85", dateISO: "2026-02-27" },
];

// Mock monthly aggregates for the host's My Chargers dashboard.
export const MONTHLY_STATS: Record<string, { sessions: number; kwh: number; earned: number }> = {
  "2025-09": { sessions: 5, kwh: 32.1, earned: 9.8 },
  "2025-10": { sessions: 7, kwh: 45.6, earned: 13.2 },
  "2025-11": { sessions: 6, kwh: 39.4, earned: 11.75 },
  "2025-12": { sessions: 9, kwh: 58.2, earned: 17.4 },
  "2026-01": { sessions: 8, kwh: 52.0, earned: 15.6 },
  "2026-02": { sessions: 10, kwh: 66.3, earned: 19.85 },
  "2026-03": { sessions: 11, kwh: 71.8, earned: 21.5 },
  "2026-04": { sessions: 13, kwh: 84.5, earned: 25.3 },
  "2026-05": { sessions: 12, kwh: 79.0, earned: 23.7 },
  "2026-06": { sessions: 15, kwh: 98.4, earned: 29.6 },
  "2026-07": { sessions: 16, kwh: 103.7, earned: 31.2 },
  "2026-08": { sessions: 14, kwh: 96.2, earned: 29.1 },
};

/** Sums whichever months a selected month/range/all-time selection touches. */
export function statsForRange(start: Date, end: Date) {
  const startKey = monthKey(startOfMonth(start));
  const endKey = monthKey(startOfMonth(end));
  let sessions = 0;
  let kwh = 0;
  let earned = 0;
  Object.keys(MONTHLY_STATS).forEach((key) => {
    if (key >= startKey && key <= endKey) {
      const s = MONTHLY_STATS[key];
      sessions += s.sessions;
      kwh += s.kwh;
      earned += s.earned;
    }
  });
  return { sessions, kwh: +kwh.toFixed(1), earned: +earned.toFixed(2) };
}
