import test from "node:test";
import assert from "node:assert/strict";
import { filterRecipients } from "../lib/chat/suggestions.ts";

const MOCK_RECIPIENTS: any[] = [
  { playerId: "1", label: "Alice", normalizedLabel: "alice" },
  { playerId: "2", label: "Bob", normalizedLabel: "bob" },
  { playerId: "3", label: "Charlie", normalizedLabel: "charlie" },
  { playerId: "4", label: "Alana", normalizedLabel: "alana" },
  { playerId: "5", label: "Al", normalizedLabel: "al" },
];

test("filterRecipients: excludes self", () => {
  const result = filterRecipients(MOCK_RECIPIENTS, "a", "1");
  assert.strictEqual(result.find((r) => r.playerId === "1"), undefined);
});

test("filterRecipients: matches by prefix", () => {
  const result = filterRecipients(MOCK_RECIPIENTS, "al", null);
  const labels = result.map((r) => r.normalizedLabel);
  assert.ok(labels.includes("alice"));
  assert.ok(labels.includes("alana"));
  assert.ok(labels.includes("al"));
  assert.strictEqual(labels.includes("bob"), false);
});

test("filterRecipients: is case-insensitive and trims prefix", () => {
  const result = filterRecipients(MOCK_RECIPIENTS, "  AL  ", null);
  assert.strictEqual(result.length, 3);
  assert.ok(result.every((r) => r.normalizedLabel.startsWith("al")));
});

test("filterRecipients: sorts by string distance (shortest match first)", () => {
  const result = filterRecipients(MOCK_RECIPIENTS, "a", null);
  // Matches: "al" (len 2, dist 1), "alana" (len 5, dist 4), "alice" (len 5, dist 4)
  assert.strictEqual(result[0].normalizedLabel, "al");
});

test("filterRecipients: sorts alphabetically when distance is equal", () => {
  const result = filterRecipients(MOCK_RECIPIENTS, "a", null);
  // distance 4: "alana", "alice"
  // alana should be before alice
  const dist4 = result.filter((r) => r.normalizedLabel.length === 5);
  assert.strictEqual(dist4[0].normalizedLabel, "alana");
  assert.strictEqual(dist4[1].normalizedLabel, "alice");
});

test("filterRecipients: sorts by playerId as fallback", () => {
  const recipients: any[] = [
    { playerId: "z", label: "Duplicate", normalizedLabel: "duplicate" },
    { playerId: "a", label: "Duplicate", normalizedLabel: "duplicate" },
  ];
  const result = filterRecipients(recipients, "dupl", null);
  assert.strictEqual(result[0].playerId, "a");
  assert.strictEqual(result[1].playerId, "z");
});
