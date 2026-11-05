export interface LevelProgress {
  level: number;
  total_xp: number;
  level_xp: number;
  next_level_xp: number;
  into_level: number;
  progress: number;
}

/** Level 1 starts at 0. Level 2 at 100, Level 3 at 300, Level 4 at 600. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * level * (level - 1);
}

export function levelForXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;

  const levelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - levelXp);
  const intoLevel = xp - levelXp;

  return {
    level,
    total_xp: xp,
    level_xp: levelXp,
    next_level_xp: nextLevelXp,
    into_level: intoLevel,
    progress: Math.min(1, intoLevel / span),
  };
}

export function completionXp(estimatedMinutes: number | null, onTime: boolean): number {
  const minutes = Math.max(5, Math.min(60, estimatedMinutes ?? 15));
  return minutes + (onTime ? 5 : 0);
}

export const BIN_PUT_OUT_XP = 5;
