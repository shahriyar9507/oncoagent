// Formatting with a fixed locale and time zone, so the server render and the browser render match
// (a browser in Bangla locale or GMT+6 would otherwise produce different text and break hydration).
export const CLINIC_TZ = "Asia/Dhaka";

export function fmtDateTime(iso: string): string {
  try {
    return `${new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TZ })} GMT+6`;
  } catch {
    return iso;
  }
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TZ });
  } catch {
    return iso;
  }
}

/** "2026-11-17" -> "17 Nov 2026". Dates without a time are calendar dates, so they are formatted in UTC. */
export function fmtDate(isoDate: string): string {
  try {
    return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return isoDate;
  }
}

export function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

/** Whole months between two ISO dates, for therapy-line durations. */
export function monthsBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24 * 30.4375));
}
