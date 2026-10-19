export const DAY_MS = 86_400_000;
export const ARCHIVE_START = "2026-09-01";
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
export function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    utcDay(new Date(date)) === date
  );
}
export function previousDay(date: string): string {
  return utcDay(new Date(Date.parse(date) - DAY_MS));
}
export function publishedDate(date: string, today = utcDay()): boolean {
  return validDate(date) && date >= ARCHIVE_START && date <= today;
}
export function challengeNumber(date: string): number {
  return (
    Math.floor((Date.parse(date) - Date.parse(ARCHIVE_START)) / DAY_MS) + 1
  );
}
export function dateLabel(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
export function archiveDates(today = utcDay(), limit = 31): string[] {
  const dates: string[] = [];
  for (
    let date = previousDay(today);
    dates.length < limit && date >= ARCHIVE_START;
    date = previousDay(date)
  )
    dates.push(date);
  return dates;
}
