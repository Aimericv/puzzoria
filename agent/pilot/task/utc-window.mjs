/**
 * Return the previous fully elapsed UTC day as [from, to) ISO timestamps.
 * `now` must be a valid Date; omitted input uses the current time.
 * The supplied Date is never mutated.
 */
export function closedUtcDayWindow(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('now must be a valid Date');
  }

  const to = new Date(now.getTime());
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to.getTime());
  from.setUTCDate(from.getUTCDate() - 1);
  if (!Number.isFinite(from.getTime())) {
    throw new RangeError('previous UTC day is outside the supported Date range');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}
