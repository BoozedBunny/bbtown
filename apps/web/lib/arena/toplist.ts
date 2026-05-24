export type ArenaMode = "SP" | "MP";

export type PostMatchEntry = {
  playerId: string;
  displayName: string;
  roundsReached: number;
  eliminationOrder: number | null;
  eliminatedAtMs: number | null;
};

export type ToplistEntry = PostMatchEntry & {
  rank: number;
  tieBreakReason: string | null;
};

export type ToplistSnapshot = {
  rankingVersion: string;
  computedAt: number;
  entries: ToplistEntry[];
};

export const RANKING_VERSION = "v1_rounds_elimorder";

const getEliminationSortValue = (entry: PostMatchEntry): number => {
  if (entry.eliminationOrder === null) {
    return Number.POSITIVE_INFINITY;
  }
  return entry.eliminationOrder;
};

const getEliminatedAtSortValue = (entry: PostMatchEntry): number => {
  if (entry.eliminatedAtMs === null) {
    return Number.POSITIVE_INFINITY;
  }
  return entry.eliminatedAtMs;
};

export const compareToplistEntries = (a: PostMatchEntry, b: PostMatchEntry): number => {
  if (a.roundsReached !== b.roundsReached) {
    return b.roundsReached - a.roundsReached;
  }

  const eliminationDiff = getEliminationSortValue(a) - getEliminationSortValue(b);
  if (eliminationDiff !== 0) {
    return eliminationDiff;
  }

  const eliminatedAtDiff = getEliminatedAtSortValue(a) - getEliminatedAtSortValue(b);
  if (eliminatedAtDiff !== 0) {
    return eliminatedAtDiff;
  }

  return a.playerId.localeCompare(b.playerId);
};

export const rankToplistEntries = (entries: PostMatchEntry[]): ToplistEntry[] => {
  const sorted = [...entries].sort(compareToplistEntries);
  return sorted.map((entry, index, list) => {
    const previous = list[index - 1];
    const next = list[index + 1];
    const tieBreakReason =
      (previous && previous.roundsReached === entry.roundsReached) ||
      (next && next.roundsReached === entry.roundsReached)
        ? "Eliminated earlier"
        : null;

    return {
      ...entry,
      rank: index + 1,
      tieBreakReason,
    };
  });
};

const globalStore = globalThis as typeof globalThis & {
  __arenaGlobalToplist?: ToplistSnapshot;
};

export const getGlobalToplist = (): ToplistSnapshot => {
  if (!globalStore.__arenaGlobalToplist) {
    globalStore.__arenaGlobalToplist = {
      rankingVersion: RANKING_VERSION,
      computedAt: Date.now(),
      entries: [],
    };
  }

  return globalStore.__arenaGlobalToplist;
};

export const setGlobalToplist = (entries: PostMatchEntry[]): ToplistSnapshot => {
  const ranked = rankToplistEntries(entries);
  const snapshot: ToplistSnapshot = {
    rankingVersion: RANKING_VERSION,
    computedAt: Date.now(),
    entries: ranked,
  };

  globalStore.__arenaGlobalToplist = snapshot;
  return snapshot;
};
