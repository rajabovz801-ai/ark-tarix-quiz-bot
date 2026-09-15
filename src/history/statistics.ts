export type RankablePlayer = {
  playerId: number;
  displayName: string;
  score: number;
  correctCount: number;
  averageResponseMs: number;
  joinedAt: string;
};

export type RankedPlayer = RankablePlayer & { rank: number };

export function rankPlayers(rows: RankablePlayer[]): RankedPlayer[] {
  return [...rows]
    .sort((a, b) =>
      b.score - a.score ||
      b.correctCount - a.correctCount ||
      a.averageResponseMs - b.averageResponseMs ||
      new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
