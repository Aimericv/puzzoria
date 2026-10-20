import test from 'node:test';
import assert from 'node:assert/strict';
import { closedUtcDayWindow } from './utc-window.mjs';

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
