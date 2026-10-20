import test from 'node:test';
import assert from 'node:assert/strict';
import { closedUtcDayWindow } from './utc-window.mjs';

for (const [name, input, days, from, to] of [
  ['7 days across year boundary', '2026-01-03T14:30:00Z', 7, '2025-12-27', '2026-01-03'],
  ['30 days across leap day', '2024-03-15T23:59:59Z', 30, '2024-02-14', '2024-03-15'],
  ['7 days across DST', '2026-03-10T03:30:00-04:00', 7, '2026-03-03', '2026-03-10'],
  ['30 days with UTC date rollover', '2026-01-01T00:30:00+14:00', 30, '2025-12-01', '2025-12-31'],
]) {
  test(name, () => {
    const now = new Date(input);
    const original = now.getTime();
    const result = closedUtcDayWindow(now, days);
    assert.deepEqual(result, { from: `${from}T00:00:00.000Z`, to: `${to}T00:00:00.000Z` });
    assert.equal(Date.parse(result.to) - Date.parse(result.from), days * 86_400_000);
    assert.ok(Date.parse(result.to) <= original);
    assert.equal(now.getTime(), original);
  });
}

test('days defaults to one, including explicit undefined', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  assert.deepEqual(closedUtcDayWindow(now, 1), closedUtcDayWindow(now));
  assert.deepEqual(closedUtcDayWindow(now, undefined), closedUtcDayWindow(now));
});

test('invalid days are rejected without coercion or mutation', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const original = now.getTime();
  for (const days of [0, -0, -1, 1.5, NaN, Infinity, -Infinity, null, true, '7', {}, [], 7n, Symbol('days')]) {
    assert.throws(() => closedUtcDayWindow(now, days), TypeError);
    assert.equal(now.getTime(), original);
  }
});

test('unrepresentable windows throw without mutating now', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  for (const days of [200_000_001, Number.MAX_SAFE_INTEGER, Number.MAX_VALUE]) {
    assert.throws(() => closedUtcDayWindow(now, days), RangeError);
  }
  const nearMinimum = new Date(-8.64e15 + 7 * 86_400_000);
  assert.equal(closedUtcDayWindow(nearMinimum, 7).from, new Date(-8.64e15).toISOString());
  assert.throws(() => closedUtcDayWindow(nearMinimum, 8), RangeError);
  assert.equal(now.toISOString(), '2026-10-20T12:00:00.000Z');
});

const cases = [
  ['ordinary day', '2026-10-20T14:12:01.123Z', '2026-10-19', '2026-10-20'],
  ['month boundary', '2026-05-01T12:00:00Z', '2026-04-30', '2026-05-01'],
  ['year boundary', '2026-01-01T00:00:00Z', '2025-12-31', '2026-01-01'],
  ['leap day', '2024-03-01T23:59:59.999Z', '2024-02-29', '2024-03-01'],
  ['non-leap century', '2100-03-01T00:00:00Z', '2100-02-28', '2100-03-01'],
  ['leap century', '2000-03-01T00:00:00Z', '2000-02-29', '2000-03-01'],
  ['positive offset crosses UTC date', '2026-01-01T00:30:00+14:00', '2025-12-30', '2025-12-31'],
  ['negative offset crosses UTC date', '2025-12-31T23:30:00-12:00', '2025-12-31', '2026-01-01'],
  ['DST offset', '2026-03-08T03:30:00-04:00', '2026-03-07', '2026-03-08'],
  ['year below 100', '0099-01-01T00:00:00Z', '0098-12-31', '0099-01-01'],
];
for (const [name, input, from, to] of cases) {
  test(name, () => {
    const now = new Date(input);
    const original = now.getTime();
    const result = closedUtcDayWindow(now);
    assert.deepEqual(result, { from: `${from}T00:00:00.000Z`, to: `${to}T00:00:00.000Z` });
    assert.equal(Date.parse(result.to) - Date.parse(result.from), 86_400_000);
    assert.ok(Date.parse(result.to) <= original);
    assert.equal(now.getTime(), original);
  });
}

test('inclusive from and exclusive to at UTC midnight', () => {
  const before = closedUtcDayWindow(new Date('2026-10-19T23:59:59.999Z'));
  const at = closedUtcDayWindow(new Date('2026-10-20T00:00:00.000Z'));
  assert.equal(before.to, at.from);
  assert.equal(at.to, '2026-10-20T00:00:00.000Z');
});

test('invalid input is rejected without coercion', () => {
  for (const value of [new Date(NaN), null, true, 0, '', '2026-10-20', {}, []]) {
    assert.throws(() => closedUtcDayWindow(value), TypeError);
  }
  assert.throws(() => closedUtcDayWindow(new Date(-8.64e15)), RangeError);
});

test('omitted now uses current UTC day', () => {
  const before = Date.now();
  const result = closedUtcDayWindow();
  const after = Date.now();
  const dayStart = (time) => new Date(time).setUTCHours(0, 0, 0, 0);
  assert.ok([dayStart(before), dayStart(after)].includes(Date.parse(result.to)));
  assert.equal(Date.parse(result.to) - Date.parse(result.from), 86_400_000);
});
