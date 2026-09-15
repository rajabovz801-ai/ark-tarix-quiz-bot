import { dbSelect } from "../lib/supabase.ts";

export function buildResultDetail(session: any, quiz: any, group: any, players: any[], results: any[]) {
  const playerMap = new Map(players.map((player) => [Number(player.id), player]));
  const leaderboard = [...results]
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .map((row) => ({
      rank: Number(row.rank),
      displayName: playerMap.get(Number(row.player_id))?.display_name || `Player ${row.player_id}`,
      score: Number(row.score || 0),
      correctCount: Number(row.correct_count || 0),
      wrongCount: Number(row.wrong_count || 0),
      accuracyPercent: Number(row.accuracy_percent || 0),
      averageResponseMs: Number(row.average_response_ms || 0),
    }));
  return {
    sessionId: Number(session.id),
    quizTitle: quiz?.title || "Tarix Quiz",
    groupTitle: group?.title || "Noma’lum guruh",
    startedAt: session.started_at || null,
    endedAt: session.ended_at || null,
    participantCount: leaderboard.length,
    leaderboard,
  };
}

export async function listRecentResults(limit = 10) {
  const sessions = await dbSelect<any>("history_sessions", {
    status: "eq.finished",
    order: "ended_at.desc",
    limit: String(Math.max(1, Math.min(limit, 25))),
  });
  return Promise.all(sessions.map(async (session) => {
    const [quizRows, groupRows, resultRows] = await Promise.all([
      dbSelect<any>("history_quizzes", { id: `eq.${session.quiz_id}`, limit: "1" }),
      dbSelect<any>("history_groups", { id: `eq.${session.group_id}`, limit: "1" }),
      dbSelect<any>("history_results", { session_id: `eq.${session.id}`, select: "id" }),
    ]);
    return {
      sessionId: Number(session.id),
      quizTitle: quizRows[0]?.title || "Tarix Quiz",
      groupTitle: groupRows[0]?.title || "Noma’lum guruh",
      participantCount: resultRows.length,
      endedAt: session.ended_at || session.started_at,
    };
  }));
}

export async function getResultDetail(sessionId: number) {
  const sessions = await dbSelect<any>("history_sessions", { id: `eq.${sessionId}`, status: "eq.finished", limit: "1" });
  const session = sessions[0];
  if (!session) return null;
  const [quizRows, groupRows, players, results] = await Promise.all([
    dbSelect<any>("history_quizzes", { id: `eq.${session.quiz_id}`, limit: "1" }),
    dbSelect<any>("history_groups", { id: `eq.${session.group_id}`, limit: "1" }),
    dbSelect<any>("history_players", { session_id: `eq.${sessionId}` }),
    dbSelect<any>("history_results", { session_id: `eq.${sessionId}`, order: "rank.asc" }),
  ]);
  return buildResultDetail(session, quizRows[0], groupRows[0], players, results);
}
