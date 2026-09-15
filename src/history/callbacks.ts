import type { OptionKey } from "./types.ts";

export type AnswerCallback = { sessionId: number; questionId: number; option: OptionKey };
export type AdminCallback = { action: string; quizId: number; arg?: string };

export function encodeAnswerCallback(sessionId: number, questionId: number, option: OptionKey): string {
  return `a:${sessionId}:${questionId}:${option}`;
}

export function decodeAnswerCallback(value: string): AnswerCallback | null {
  const m = /^a:(\d+):(\d+):([ABCD])$/.exec(value);
  if (!m) return null;
  return { sessionId: Number(m[1]), questionId: Number(m[2]), option: m[3] as OptionKey };
}

export function encodeAdminCallback(action: string, quizId: number, arg?: string): string {
  return ["m", action, String(quizId), arg].filter((v) => v !== undefined).join(":");
}

export function decodeAdminCallback(value: string): AdminCallback | null {
  const parts = value.split(":");
  if (parts[0] !== "m" || parts.length < 3 || !/^\d+$/.test(parts[2])) return null;
  return { action: parts[1], quizId: Number(parts[2]), ...(parts[3] !== undefined ? { arg: parts.slice(3).join(":") } : {}) };
}
