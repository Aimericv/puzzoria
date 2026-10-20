/**
 * Return the previous `days` fully elapsed UTC days as [from, to) ISO timestamps.
 * `now` must be a valid Date; omitted input uses the current time.
 * `days` must be a positive integer and defaults to 1.
 * The supplied Date is never mutated.
 */
export function closedUtcDayWindow(now = new Date(), days = 1) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('now must be a valid Date');
  }
  if (!Number.isInteger(days) || days <= 0) {
    throw new TypeError('days must be a positive integer');
  }

  const to = new Date(now.getTime());
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to.getTime());
  from.setUTCDate(from.getUTCDate() - days);
  if (!Number.isFinite(from.getTime())) {
    throw new RangeError('UTC window is outside the supported Date range');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}
