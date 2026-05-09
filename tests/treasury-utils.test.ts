import test from "node:test";
import assert from "node:assert/strict";
import {
  toUtcDateKey,
  addUtcDays,
  dateKeyToUtcDate,
  seededPercent,
  clamp,
  roundInt,
} from "../lib/treasury/utils.ts";

test("toUtcDateKey returns YYYY-MM-DD format", () => {
  const date1 = new Date("2024-05-08T12:34:56Z");
  assert.equal(toUtcDateKey(date1), "2024-05-08");

  const date2 = new Date("2023-12-31T23:59:59Z");
  assert.equal(toUtcDateKey(date2), "2023-12-31");

  const date3 = new Date("2023-01-01T00:00:00Z");
  assert.equal(toUtcDateKey(date3), "2023-01-01");
});

test("addUtcDays correctly adds and subtracts days", () => {
  const baseDate = new Date("2024-05-08T12:00:00Z");

  const nextDay = addUtcDays(baseDate, 1);
  assert.equal(nextDay.toISOString(), "2024-05-09T12:00:00.000Z");

  const prevDay = addUtcDays(baseDate, -1);
  assert.equal(prevDay.toISOString(), "2024-05-07T12:00:00.000Z");

  const sameDay = addUtcDays(baseDate, 0);
  assert.equal(sameDay.toISOString(), "2024-05-08T12:00:00.000Z");

  // Month boundary
  const endOfMonth = new Date("2024-05-31T12:00:00Z");
  const nextMonth = addUtcDays(endOfMonth, 1);
  assert.equal(nextMonth.toISOString(), "2024-06-01T12:00:00.000Z");

  // Leap year
  const leapDay = new Date("2024-02-28T12:00:00Z");
  const afterLeap = addUtcDays(leapDay, 1);
  assert.equal(afterLeap.toISOString(), "2024-02-29T12:00:00.000Z");
});

test("dateKeyToUtcDate converts YYYY-MM-DD back to UTC Date", () => {
  const date1 = dateKeyToUtcDate("2024-05-08");
  assert.equal(date1.toISOString(), "2024-05-08T00:00:00.000Z");

  const date2 = dateKeyToUtcDate("2023-12-31");
  assert.equal(date2.toISOString(), "2023-12-31T00:00:00.000Z");
});

test("seededPercent returns deterministic values within range", () => {
  const seed1 = "test-seed-1";
  const seed2 = "test-seed-2";

  const val1 = seededPercent(seed1, 0, 100);
  const val1Again = seededPercent(seed1, 0, 100);
  assert.equal(val1, val1Again, "Should be deterministic for same seed");
  assert.ok(val1 >= 0 && val1 <= 100, "Should be within range");

  const val2 = seededPercent(seed2, 10, 20);
  assert.ok(val2 >= 10 && val2 <= 20, "Should be within range");

  const val3 = seededPercent(seed1, -50, 50);
  assert.ok(val3 >= -50 && val3 <= 50, "Should be within range for negatives");
});

test("clamp keeps values within specified bounds", () => {
  assert.equal(clamp(5, 0, 10), 5, "Value inside bounds");
  assert.equal(clamp(-5, 0, 10), 0, "Value below min");
  assert.equal(clamp(15, 0, 10), 10, "Value above max");
  assert.equal(clamp(0, 0, 10), 0, "Value on min boundary");
  assert.equal(clamp(10, 0, 10), 10, "Value on max boundary");
  assert.equal(clamp(-15, -20, -10), -15, "Negative bounds");
});

test("roundInt correctly rounds numbers", () => {
  assert.equal(roundInt(5.1), 5);
  assert.equal(roundInt(5.5), 6);
  assert.equal(roundInt(5.9), 6);
  assert.equal(roundInt(-5.1), -5);
  assert.equal(roundInt(-5.5), -5); // Math.round(-5.5) is -5 in JS
  assert.equal(roundInt(-5.9), -6);
  assert.equal(roundInt(0), 0);
});
