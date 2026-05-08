import test from "node:test";
import assert from "node:assert/strict";
import { compareToplistEntries, rankToplistEntries } from "../lib/arena/toplist.ts";

test("sorts by rounds reached descending", () => {
  const ranked = rankToplistEntries([
    { playerId: "a", displayName: "A", roundsReached: 3, eliminationOrder: 1, eliminatedAtMs: 3 },
    { playerId: "b", displayName: "B", roundsReached: 7, eliminationOrder: 1, eliminatedAtMs: 1 },
  ]);

  assert.equal(ranked[0].playerId, "b");
  assert.equal(ranked[0].rank, 1);
});

test("applies falls-first tie-break and keeps deterministic fallback", () => {
  const rows = [
    { playerId: "z", displayName: "Z", roundsReached: 5, eliminationOrder: 2, eliminatedAtMs: 2000 },
    { playerId: "a", displayName: "A", roundsReached: 5, eliminationOrder: 1, eliminatedAtMs: 1000 },
    { playerId: "w", displayName: "W", roundsReached: 5, eliminationOrder: null, eliminatedAtMs: null },
  ];

  const sorted = [...rows].sort(compareToplistEntries);
  assert.deepEqual(
    sorted.map((row) => row.playerId),
    ["a", "z", "w"],
  );

  const ranked = rankToplistEntries(rows);
  assert.ok(ranked.every((entry) => entry.tieBreakReason === "Eliminated earlier"));
});
