import test from "node:test";
import assert from "node:assert/strict";
import { applyArenaResult } from "../lib/bff/serverRuntimeService.ts";

test("applyArenaResult - multiplayer reward suppression", async (t) => {
  // Save environment and global.fetch
  const originalToken = process.env.STRAPI_API_TOKEN;
  process.env.STRAPI_API_TOKEN = "mock-token";
  
  const originalFetch = global.fetch;
  let fetchCount = 0;
  
  // Custom mock response to simulate a standard fetch call
  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    fetchCount++;
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    await t.test("multiplayer, roundsReached < 2: does not award anything (early return)", async () => {
      fetchCount = 0;
      await applyArenaResult({
        winner: "winnerPlayer",
        loser: "loserPlayer",
        reward: 1000,
        isSolo: false,
        roundsReached: 1,
      });
      // Should return early, so fetch is never called
      assert.equal(fetchCount, 0, "fetch should not have been called");
    });

    await t.test("multiplayer, roundsReached >= 2: attempts to fetch profile and award rewards", async () => {
      fetchCount = 0;
      try {
        await applyArenaResult({
          winner: "winnerPlayer",
          loser: "loserPlayer",
          reward: 1000,
          isSolo: false,
          roundsReached: 2,
        });
      } catch (err) {
        // We might get an error because the mock fetch returned empty/invalid profile data,
        // but the fact that fetch was called proves it did not return early.
      }
      assert.ok(fetchCount > 0, "fetch should have been called to retrieve player profiles");
    });

    await t.test("solo match: does not return early even if roundsReached < 2", async () => {
      fetchCount = 0;
      try {
        await applyArenaResult({
          winner: "winnerPlayer",
          reward: 0,
          isSolo: true,
          roundsReached: 1,
        });
      } catch (err) {
        // Mock fetch might cause subsequent errors, but the call to fetch proves it didn't return early.
      }
      assert.ok(fetchCount > 0, "fetch should have been called for solo match profile sync");
    });

  } finally {
    // Restore
    process.env.STRAPI_API_TOKEN = originalToken;
    global.fetch = originalFetch;
  }
});
