// Dates for Ryan's notification (#346), on Denver's clock.  The due date
// counts REPLY_DUE_BUSINESS_DAYS business days from receipt, skipping
// Saturdays and Sundays.  Holidays are NOT skipped (#346 "Accepted as
// proposed: no holiday calendar in the due date").

const ZONE = "America/Denver";

/** The calendar date `at` falls on in Denver, as a UTC-midnight Date. */
function denverDay(at: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(Date.UTC(n("year"), n("month") - 1, n("day")));
}

/** `days` business days after the Denver date of `at`, e.g. "Wed Oct 21". */
export function dueBy(at: Date, days: number): string {
  const d = denverDay(at);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  // The weekday and month come from Intl; the comma it puts between them
  // is not in the prompt's "Wed Oct 21", so the parts are joined by hand.
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(d);
  return `${fmt({ weekday: "short" })} ${fmt({ month: "short" })} ${d.getUTCDate()}`;
}

/** When the submission arrived, in Denver, e.g. "Sat, Oct 17, 2026, 11:05 AM MDT". */
export function receivedAt(at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(at);
}
