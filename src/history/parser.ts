import type { OptionKey, ParsedQuestion, ParsedQuiz } from "./types.ts";

export class QuizParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizParseError";
  }
}

const optionKeys: OptionKey[] = ["A", "B", "C", "D"];

export function parseQuizText(input: string): ParsedQuiz {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (!normalized) throw new QuizParseError("Quiz matni bo‘sh.");

  const lines = normalized.split("\n").map((line) => line.trim());
  let title = "Tarix Quiz";
  let start = 0;
  const titleMatch = lines[0]?.match(/^quiz\s*:\s*(.+)$/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
    start = 1;
  }

  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines.slice(start)) {
    if (!line) continue;
    if (/^\d+[.)]\s+/.test(line) && current.length) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);

  if (!blocks.length) throw new QuizParseError("Hech qanday savol topilmadi.");

  const questions = blocks.map((block, index) => parseQuestion(block, index + 1));
  return { title, questions };
}

function parseQuestion(block: string[], number: number): ParsedQuestion {
  const questionLine = block.find((line) => /^\d+[.)]\s+/.test(line));
  if (!questionLine) throw new QuizParseError(`${number}-savol: savol matni topilmadi.`);
  const text = questionLine.replace(/^\d+[.)]\s+/, "").trim();
  if (!text) throw new QuizParseError(`${number}-savol: savol matni bo‘sh.`);

  const options = {} as Record<OptionKey, string>;
  for (const key of optionKeys) {
    const line = block.find((item) => new RegExp(`^${key}\\s*[).:-]\\s*`, "i").test(item));
    if (!line) throw new QuizParseError(`${number}-savol: ${key} varianti topilmadi.`);
    const value = line.replace(new RegExp(`^${key}\\s*[).:-]\\s*`, "i"), "").trim();
    if (!value) throw new QuizParseError(`${number}-savol: ${key} varianti bo‘sh.`);
    options[key] = value;
  }

  const answerLine = block.find((line) => /^(javob|answer)\s*:/i.test(line));
  if (!answerLine) throw new QuizParseError(`${number}-savol: to‘g‘ri javob ko‘rsatilmagan.`);
  const answer = answerLine.split(":").slice(1).join(":").trim().toUpperCase();
  if (!optionKeys.includes(answer as OptionKey)) {
    throw new QuizParseError(`${number}-savol: javob A, B, C yoki D bo‘lishi kerak.`);
  }

  return { text, options, correctOption: answer as OptionKey };
}
