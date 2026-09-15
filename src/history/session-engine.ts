import { DatabaseError, dbInsert, dbSelect, dbUpdate, dbUpsert } from "../lib/supabase.ts";
import { sendMessage, sendQuizPoll } from "../lib/telegram.ts";
import { getGroup } from "./group-service.ts";
import { getQuiz, getQuizQuestions } from "./quiz-service.ts";
import { calculateScore } from "./scoring.ts";
import { rankPlayers } from "./statistics.ts";
import type { OptionKey, TelegramUser } from "./types.ts";
import { formatCompletedQuizMessage } from "./ui.ts";

function shuffled<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function startSession(quizId: number, groupId: number, adminId: number) {
  const quiz = await getQuiz(quizId);
  if (!quiz || quiz.status === "archived") throw new Error("Quiz topilmadi.");
  const group = await getGroup(groupId);
  if (!group) throw new Error("Guruh topilmadi.");
  const active = await dbSelect<any>("history_sessions", { group_id: `eq.${groupId}`, status: "eq.running", limit: "1" });
  if (active.length) throw new Error("Bu guruhda allaqachon quiz ketmoqda.");
  const questions = await getQuizQuestions(quizId);
  if (!questions.length) throw new Error("Quizda savollar yo‘q.");
  const order = quiz.shuffle_questions ? shuffled(questions.map((q) => q.id)) : questions.map((q) => q.id);
  const rows = await dbInsert<any>("history_sessions", {
    quiz_id: quizId,
    group_id: groupId,
    status: "running",
    current_question_index: 0,
    question_order: order,
    default_time_limit: quiz.default_time_limit,
    started_by: adminId,
    started_at: new Date().toISOString(),
  });
  const session = rows[0];
  await sendMessage(group.telegram_chat_id, `🏛 <b>${escapeHtml(quiz.title)}</b>\n\nQuiz boshlandi! ${questions.length} ta savol. Har bir savol uchun ${quiz.default_time_limit} soniya.`, { parse_mode: "HTML" });
  await openQuestion(session.id);
  return session;
}

export async function openQuestion(sessionId: number) {
  const session = (await dbSelect<any>("history_sessions", { id: `eq.${sessionId}`, status: "eq.running", limit: "1" }))[0];
  if (!session) return;
  const order: number[] = session.question_order || [];
  const index = session.current_question_index;
  if (index >= order.length) return finishSession(sessionId);
  const questionId = order[index];
  const question = (await dbSelect<any>("history_questions", { id: `eq.${questionId}`, limit: "1" }))[0];
  const quiz = await getQuiz(session.quiz_id);
  const group = await getGroup(session.group_id);
  if (!question || !quiz || !group) throw new Error("Session data incomplete");
  const seconds = question.time_limit_seconds || session.default_time_limit || 20;
  const openedAt = new Date();
  const deadline = new Date(openedAt.getTime() + seconds * 1000);

  const baseOptions: Array<{ key: OptionKey; text: string }> = [
    { key: "A", text: question.option_a },
    { key: "B", text: question.option_b },
    { key: "C", text: question.option_c },
    { key: "D", text: question.option_d },
  ];
  const displayed = quiz.shuffle_options ? shuffled(baseOptions) : baseOptions;
  const correctIndex = displayed.findIndex((item) => item.key === question.correct_option);
  const optionOrder = displayed.map((item) => item.key);

  const result = await sendQuizPoll({
    chatId: group.telegram_chat_id,
    question: `${index + 1}/${order.length}. ${question.question_text}`,
    options: displayed.map((item) => item.text),
    correctIndex,
    openPeriod: seconds,
    explanation: question.explanation,
  });
  await dbUpdate("history_sessions", { id: `eq.${sessionId}`, status: "eq.running" }, {
    current_question_id: questionId,
    current_poll_id: result.poll?.id,
    current_message_id: result.message_id,
    current_question_opened_at: openedAt.toISOString(),
    current_question_deadline_at: deadline.toISOString(),
    current_option_order: optionOrder,
  });
}

export async function submitPollAnswer(pollId: string, user: TelegramUser, optionIds: number[]) {
  const session = (await dbSelect<any>("history_sessions", { current_poll_id: `eq.${pollId}`, status: "eq.running", limit: "1" }))[0];
  if (!session || !session.current_question_id || !optionIds.length) return { accepted: false, reason: "inactive" };
  const now = Date.now();
  const deadline = new Date(session.current_question_deadline_at).getTime();
  if (now > deadline + 1500) return { accepted: false, reason: "late" };
  const question = (await dbSelect<any>("history_questions", { id: `eq.${session.current_question_id}`, limit: "1" }))[0];
  if (!question) return { accepted: false, reason: "missing-question" };
  const optionOrder: OptionKey[] = Array.isArray(session.current_option_order) && session.current_option_order.length === 4
    ? session.current_option_order
    : ["A", "B", "C", "D"];
  const option = optionOrder[optionIds[0]];
  if (!option) return { accepted: false, reason: "invalid-option" };
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || String(user.id);
  const player = (await dbUpsert<any>("history_players", {
    session_id: session.id,
    telegram_user_id: user.id,
    username: user.username || null,
    display_name: displayName,
  }, "session_id,telegram_user_id"))[0];
  const correct = option === question.correct_option;
  const opened = new Date(session.current_question_opened_at).getTime();
  const responseTimeMs = Math.max(0, now - opened);
  const score = calculateScore({ correct, answeredAtMs: now, openedAtMs: opened, deadlineAtMs: deadline });
  try {
    await dbInsert("history_answers", {
      session_id: session.id,
      question_id: question.id,
      player_id: player.id,
      selected_option: option,
      is_correct: correct,
      response_time_ms: responseTimeMs,
      score_awarded: score,
    });
  } catch (error) {
    if (error instanceof DatabaseError && error.status === 409) return { accepted: false, reason: "duplicate" };
    throw error;
  }
  const fresh = (await dbSelect<any>("history_players", { id: `eq.${player.id}`, limit: "1" }))[0];
  await dbUpdate("history_players", { id: `eq.${player.id}` }, {
    total_score: (fresh.total_score || 0) + score,
    correct_count: (fresh.correct_count || 0) + (correct ? 1 : 0),
    wrong_count: (fresh.wrong_count || 0) + (correct ? 0 : 1),
    total_response_ms: Number(fresh.total_response_ms || 0) + responseTimeMs,
  });
  return { accepted: true, correct, score };
}

export async function handlePollClosed(pollId: string) {
  const session = (await dbSelect<any>("history_sessions", { current_poll_id: `eq.${pollId}`, status: "eq.running", limit: "1" }))[0];
  if (!session) return;
  const order: number[] = session.question_order || [];
  const nextIndex = Number(session.current_question_index) + 1;
  const updated = await dbUpdate<any>("history_sessions", { id: `eq.${session.id}`, current_poll_id: `eq.${pollId}`, status: "eq.running" }, {
    current_question_index: nextIndex,
    current_poll_id: null,
    current_message_id: null,
    current_question_id: null,
    current_option_order: ["A", "B", "C", "D"],
  });
  if (!updated.length) return;
  if (nextIndex >= order.length) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await finishSession(session.id);
  } else {
    await openQuestion(session.id);
  }
}

export async function finishSession(sessionId: number) {
  const session = (await dbSelect<any>("history_sessions", { id: `eq.${sessionId}`, limit: "1" }))[0];
  if (!session || session.status === "finished") return;
  const players = await dbSelect<any>("history_players", { session_id: `eq.${sessionId}` });
  const rankable = players.map((p) => ({
    playerId: p.id,
    displayName: p.display_name,
    score: p.total_score || 0,
    correctCount: p.correct_count || 0,
    averageResponseMs: (p.correct_count || 0) + (p.wrong_count || 0) > 0 ? Math.round(Number(p.total_response_ms || 0) / ((p.correct_count || 0) + (p.wrong_count || 0))) : Number.MAX_SAFE_INTEGER,
    joinedAt: p.joined_at,
  }));
  const ranked = rankPlayers(rankable);
  if (ranked.length) {
    const resultRows = ranked.map((r) => {
      const original = players.find((p) => p.id === r.playerId)!;
      const answered = (original.correct_count || 0) + (original.wrong_count || 0);
      return {
        session_id: sessionId,
        player_id: r.playerId,
        rank: r.rank,
        score: r.score,
        correct_count: original.correct_count || 0,
        wrong_count: original.wrong_count || 0,
        accuracy_percent: answered ? Math.round(((original.correct_count || 0) / answered) * 10000) / 100 : 0,
        average_response_ms: r.averageResponseMs === Number.MAX_SAFE_INTEGER ? 0 : r.averageResponseMs,
      };
    });
    try { await dbInsert("history_results", resultRows); } catch (e) { if (!(e instanceof DatabaseError && e.status === 409)) throw e; }
  }
  await dbUpdate("history_sessions", { id: `eq.${sessionId}` }, { status: "finished", ended_at: new Date().toISOString() });
  const group = await getGroup(session.group_id);
  const quiz = await getQuiz(session.quiz_id);
  if (group) {
    await sendMessage(group.telegram_chat_id, formatCompletedQuizMessage({
      quizTitle: quiz?.title || "Tarix Quiz",
      groupTitle: group.title || "Guruh",
      participantCount: ranked.length,
      ranked: ranked.map((row) => ({ rank: row.rank, displayName: row.displayName, score: row.score })),
    }), { parse_mode: "HTML" });
  }
  if (session.started_by) {
    const answers = await dbSelect<any>("history_answers", { session_id: `eq.${sessionId}` });
    const total = answers.length;
    const correct = answers.filter((a) => a.is_correct).length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    await sendMessage(session.started_by, `📊 Quiz yakunlandi.\nQatnashchilar: ${ranked.length}\nJavoblar: ${total}\nUmumiy aniqlik: ${accuracy}%`);
  }
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
