export function getLevelFromXP(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export function getXPForLevel(level: number): number {
  return Math.pow(Math.max(1, level) - 1, 2) * 100;
}

export function getNextLevelXP(xp: number): number {
  const currentLevel = getLevelFromXP(xp);
  return getXPForLevel(currentLevel + 1);
}
