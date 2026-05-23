import test from "node:test";
import assert from "node:assert/strict";
import { getRoundPhaseStateAt } from "../lib/arena/roundPhases.ts";
import type { RoundTransitionConfig } from "../lib/arena/roundPhases.ts";

const testConfig: RoundTransitionConfig = {
  enabled: true,
  totalRounds: 2,
  roundDurationMs: 10000,
  preRoundBreathingMs: 2000,
  betweenRoundBreathingMs: 1500,
  announceInMs: 100,
  announceHoldMs: 500,
  announceOutMs: 200, // total announce = 800
};

test("getRoundPhaseStateAt", async (t) => {
  await t.test("when disabled, returns ACTIVE_ROUND", () => {
    const config = { ...testConfig, enabled: false };

    // Start at 0, round 1
    let state = getRoundPhaseStateAt(0, 0, config);
    assert.equal(state.phase, "ACTIVE_ROUND");
    assert.equal(state.roundIndex, 1);

    // 5s in, still round 1
    state = getRoundPhaseStateAt(5000, 0, config);
    assert.equal(state.phase, "ACTIVE_ROUND");
    assert.equal(state.roundIndex, 1);

    // 15s in, round 2
    state = getRoundPhaseStateAt(15000, 0, config);
    assert.equal(state.phase, "ACTIVE_ROUND");
    assert.equal(state.roundIndex, 2);

    // 25s in, clamped to totalRounds (2)
    state = getRoundPhaseStateAt(25000, 0, config);
    assert.equal(state.phase, "ACTIVE_ROUND");
    assert.equal(state.roundIndex, 2);
  });

  await t.test("Round 1 phases", () => {
    // 0 to 99: PRE_ROUND_BREATHING
    let state = getRoundPhaseStateAt(50, 0, testConfig);
    assert.equal(state.phase, "PRE_ROUND_BREATHING");
    assert.equal(state.roundIndex, 1);
    assert.equal(state.obstaclesEnabled, false);

    // 100 to 899: ROUND_ANNOUNCE
    state = getRoundPhaseStateAt(150, 0, testConfig);
    assert.equal(state.phase, "ROUND_ANNOUNCE");
    assert.equal(state.roundIndex, 1);
    assert.equal(state.obstaclesEnabled, false);

    // 900 to 1999: PRE_ROUND_BREATHING
    state = getRoundPhaseStateAt(1000, 0, testConfig);
    assert.equal(state.phase, "PRE_ROUND_BREATHING");
    assert.equal(state.roundIndex, 1);
    assert.equal(state.obstaclesEnabled, false);

    // 2000 to 11999: ACTIVE_ROUND
    state = getRoundPhaseStateAt(2000, 0, testConfig);
    assert.equal(state.phase, "ACTIVE_ROUND");
    assert.equal(state.roundIndex, 1);
    assert.equal(state.obstaclesEnabled, true);

    state = getRoundPhaseStateAt(5000, 0, testConfig);
    assert.equal(state.phase, "ACTIVE_ROUND");
    assert.equal(state.roundIndex, 1);
    assert.equal(state.obstaclesEnabled, true);
  });

  await t.test("Round 2 phases", () => {
    // Round 1 ended at 12000.
    // Round 2 breathing: 12000 to 13499
    // Round 2 active: 13500 to 23499

    // 12000 to 12099: PRE_ROUND_BREATHING
    let state = getRoundPhaseStateAt(12050, 0, testConfig);
    assert.equal(state.phase, "PRE_ROUND_BREATHING");
    assert.equal(state.roundIndex, 2);

    // 12100 to 12899: ROUND_ANNOUNCE
    state = getRoundPhaseStateAt(12150, 0, testConfig);
    assert.equal(state.phase, "ROUND_ANNOUNCE");
    assert.equal(state.roundIndex, 2);

    // 12900 to 13499: PRE_ROUND_BREATHING
    state = getRoundPhaseStateAt(13000, 0, testConfig);
    assert.equal(state.phase, "PRE_ROUND_BREATHING");
    assert.equal(state.roundIndex, 2);

    // 13500 to 23499: ACTIVE_ROUND
    state = getRoundPhaseStateAt(14000, 0, testConfig);
    assert.equal(state.phase, "ACTIVE_ROUND");
    assert.equal(state.roundIndex, 2);
  });

  await t.test("ROUND_END phase", () => {
    // Round 2 ends at 23500
    let state = getRoundPhaseStateAt(23500, 0, testConfig);
    assert.equal(state.phase, "ROUND_END");
    assert.equal(state.roundIndex, 2);
    assert.equal(state.obstaclesEnabled, false);

    state = getRoundPhaseStateAt(50000, 0, testConfig);
    assert.equal(state.phase, "ROUND_END");
    assert.equal(state.roundIndex, 2);
    assert.equal(state.obstaclesEnabled, false);
  });
});
