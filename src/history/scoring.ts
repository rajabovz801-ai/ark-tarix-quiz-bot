export function calculateScore(params: {
  correct: boolean;
  answeredAtMs: number;
  openedAtMs: number;
  deadlineAtMs: number;
}): number {
  if (!params.correct) return 0;
  const duration = Math.max(1, params.deadlineAtMs - params.openedAtMs);
  const remaining = Math.max(0, params.deadlineAtMs - params.answeredAtMs);
  const ratio = Math.min(1, remaining / duration);
  return 100 + Math.round(50 * ratio);
}
