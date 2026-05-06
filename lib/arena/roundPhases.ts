export type RoundPhase =
  | "PRE_ROUND_BREATHING"
  | "ROUND_ANNOUNCE"
  | "ACTIVE_ROUND"
  | "ROUND_END";

export type RoundTransitionConfig = {
  enabled: boolean;
  totalRounds: number;
  roundDurationMs: number;
  preRoundBreathingMs: number;
  betweenRoundBreathingMs: number;
  announceInMs: number;
  announceHoldMs: number;
  announceOutMs: number;
};

export type RoundPhaseState = {
  roundIndex: number;
  phase: RoundPhase;
  phaseStartTimeMs: number;
  phaseDurationMs: number;
  obstaclesEnabled: boolean;
};

export const DEFAULT_ROUND_TRANSITION_CONFIG: RoundTransitionConfig = {
  enabled: (process.env.NEXT_PUBLIC_ROUND_BREATHING_WINDOW_V1 ?? "true") !== "false",
  totalRounds: 30,
  roundDurationMs: 30_000,
  preRoundBreathingMs: 1_200,
  betweenRoundBreathingMs: 1_000,
  announceInMs: 100,
  announceHoldMs: 700,
  announceOutMs: 250,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function getRoundPhaseStateAt(
  nowMs: number,
  startedAtMs: number,
  config: RoundTransitionConfig = DEFAULT_ROUND_TRANSITION_CONFIG,
): RoundPhaseState {
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const announceDurationMs = config.announceInMs + config.announceHoldMs + config.announceOutMs;

  if (!config.enabled) {
    const roundIndex = clamp(
      Math.floor(elapsedMs / config.roundDurationMs) + 1,
      1,
      config.totalRounds,
    );

    return {
      roundIndex,
      phase: "ACTIVE_ROUND",
      phaseStartTimeMs: startedAtMs + (roundIndex - 1) * config.roundDurationMs,
      phaseDurationMs: config.roundDurationMs,
      obstaclesEnabled: true,
    };
  }

  let offsetMs = 0;

  for (let roundIndex = 1; roundIndex <= config.totalRounds; roundIndex += 1) {
    const breathingMs = roundIndex === 1 ? config.preRoundBreathingMs : config.betweenRoundBreathingMs;
    const breathingStart = offsetMs;
    const activeStart = breathingStart + breathingMs;
    const activeEnd = activeStart + config.roundDurationMs;

    if (elapsedMs < activeStart) {
      const announceStart = breathingStart + config.announceInMs;
      const announceEnd = announceStart + announceDurationMs;
      const inAnnounce = elapsedMs >= announceStart && elapsedMs < announceEnd;
      return {
        roundIndex,
        phase: inAnnounce ? "ROUND_ANNOUNCE" : "PRE_ROUND_BREATHING",
        phaseStartTimeMs: startedAtMs + (inAnnounce ? announceStart : breathingStart),
        phaseDurationMs: inAnnounce ? announceDurationMs : breathingMs,
        obstaclesEnabled: false,
      };
    }

    if (elapsedMs < activeEnd) {
      return {
        roundIndex,
        phase: "ACTIVE_ROUND",
        phaseStartTimeMs: startedAtMs + activeStart,
        phaseDurationMs: config.roundDurationMs,
        obstaclesEnabled: true,
      };
    }

    offsetMs = activeEnd;
  }

  return {
    roundIndex: config.totalRounds,
    phase: "ROUND_END",
    phaseStartTimeMs: startedAtMs + offsetMs,
    phaseDurationMs: 0,
    obstaclesEnabled: false,
  };
}
