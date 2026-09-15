import { dbSelect, dbUpdate } from "../lib/supabase.ts";

export const ALLOWED_QUIZ_TIMES = [10, 15, 20, 30, 45, 60] as const;

export type QuizSettings = {
  defaultTimeLimit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};

export function assertAllowedQuizTime(seconds: number): void {
  if (!ALLOWED_QUIZ_TIMES.includes(seconds as any)) throw new Error("Unsupported quiz time");
}

export function normalizeSettings(row: any): QuizSettings {
  return {
    defaultTimeLimit: row?.default_time_limit ?? 20,
    shuffleQuestions: Boolean(row?.shuffle_questions),
    shuffleOptions: Boolean(row?.shuffle_options),
  };
}

export async function getSettings(): Promise<QuizSettings> {
  const rows = await dbSelect<any>("history_settings", { id: "eq.1", limit: "1" });
  return normalizeSettings(rows[0] || null);
}

export async function updateDefaultTime(seconds: number, updatedBy: number): Promise<QuizSettings> {
  assertAllowedQuizTime(seconds);
  const rows = await dbUpdate<any>("history_settings", { id: "eq.1" }, {
    default_time_limit: seconds,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  return normalizeSettings(rows[0]);
}

export async function toggleShuffleQuestions(updatedBy: number): Promise<QuizSettings> {
  const current = await getSettings();
  const rows = await dbUpdate<any>("history_settings", { id: "eq.1" }, {
    shuffle_questions: !current.shuffleQuestions,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  return normalizeSettings(rows[0]);
}

export async function toggleShuffleOptions(updatedBy: number): Promise<QuizSettings> {
  const current = await getSettings();
  const rows = await dbUpdate<any>("history_settings", { id: "eq.1" }, {
    shuffle_options: !current.shuffleOptions,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  return normalizeSettings(rows[0]);
}
