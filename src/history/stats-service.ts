import { dbSelect } from "../lib/supabase.ts";

export function summarizeAdminStats(input: {
  quizzes: any[];
  groups: any[];
  sessions: any[];
  players: any[];
  answers: any[];
}) {
  return {
    totalQuizzes: input.quizzes.length,
    totalGroups: input.groups.length,
    completedSessions: input.sessions.length,
    uniquePlayers: new Set(input.players.map((row) => String(row.telegram_user_id))).size,
    storedAnswers: input.answers.length,
  };
}

export async function getAdminStats() {
  const [quizzes, groups, sessions, players, answers] = await Promise.all([
    dbSelect<any>("history_quizzes", { status: "neq.archived", select: "id" }),
    dbSelect<any>("history_groups", { is_active: "eq.true", select: "id" }),
    dbSelect<any>("history_sessions", { status: "eq.finished", select: "id" }),
    dbSelect<any>("history_players", { select: "telegram_user_id" }),
    dbSelect<any>("history_answers", { select: "id" }),
  ]);
  return summarizeAdminStats({ quizzes, groups, sessions, players, answers });
}
