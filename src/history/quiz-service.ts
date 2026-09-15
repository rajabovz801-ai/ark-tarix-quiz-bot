import { dbInsert, dbSelect, dbUpdate } from "../lib/supabase.ts";
import { parseQuizText } from "./parser.ts";
import { assertAllowedQuizTime, getSettings } from "./settings-service.ts";

export async function createQuizFromText(input: string, adminId: number) {
  const parsed = parseQuizText(input);
  const settings = await getSettings();
  const quizRows = await dbInsert<any>("history_quizzes", {
    title: parsed.title,
    created_by: adminId,
    status: "draft",
    question_count: parsed.questions.length,
    default_time_limit: settings.defaultTimeLimit,
    shuffle_questions: settings.shuffleQuestions,
    shuffle_options: settings.shuffleOptions,
  });
  const quiz = quizRows[0];
  const questionRows = parsed.questions.map((question, index) => ({
    quiz_id: quiz.id,
    position: index + 1,
    question_text: question.text,
    option_a: question.options.A,
    option_b: question.options.B,
    option_c: question.options.C,
    option_d: question.options.D,
    correct_option: question.correctOption,
  }));
  await dbInsert("history_questions", questionRows);
  return quiz;
}

export async function getQuiz(quizId: number) {
  return (await dbSelect<any>("history_quizzes", { id: `eq.${quizId}`, limit: "1" }))[0] || null;
}

export async function getQuizQuestions(quizId: number) {
  return dbSelect<any>("history_questions", { quiz_id: `eq.${quizId}`, order: "position.asc" });
}

export async function updateQuizTime(quizId: number, seconds: number) {
  assertAllowedQuizTime(seconds);
  const rows = await dbUpdate<any>("history_quizzes", { id: `eq.${quizId}` }, { default_time_limit: seconds, updated_at: new Date().toISOString() });
  return rows[0];
}

export async function archiveQuiz(quizId: number) {
  await dbUpdate("history_quizzes", { id: `eq.${quizId}` }, { status: "archived", updated_at: new Date().toISOString() });
}

export async function listRecentQuizzes(adminId: number) {
  return dbSelect<any>("history_quizzes", { created_by: `eq.${adminId}`, status: "neq.archived", order: "created_at.desc", limit: "10" });
}

export async function listManageQuizzes(limit = 20) {
  return dbSelect<any>("history_quizzes", { status: "neq.archived", order: "created_at.desc", limit: String(Math.max(1, Math.min(limit, 30))) });
}
