import test from "node:test";
import assert from "node:assert/strict";
import { isAdmin } from "../src/history/auth.ts";
import { parseAdminIds } from "../src/config/env.ts";
import { parseQuizText, QuizParseError } from "../src/history/parser.ts";
import { encodeAdminCallback, decodeAdminCallback } from "../src/history/callbacks.ts";
import { calculateScore } from "../src/history/scoring.ts";
import { rankPlayers } from "../src/history/statistics.ts";

test("admin IDs are parsed and checked", () => {
  const ids = parseAdminIds("123, 456,123");
  assert.deepEqual([...ids], ["123", "456"]);
  assert.equal(isAdmin(123, ids), true);
  assert.equal(isAdmin(999, ids), false);
});

test("quiz parser accepts A-D quiz format", () => {
  const quiz = parseQuizText(`Quiz: Amir Temur\n1. Amir Temur qachon tug‘ilgan?\nA) 1336\nB) 1338\nC) 1340\nD) 1342\nJavob: A`);
  assert.equal(quiz.title, "Amir Temur");
  assert.equal(quiz.questions[0].correctOption, "A");
});

test("quiz parser rejects missing option", () => {
  assert.throws(() => parseQuizText(`Quiz: Test\n1. Savol?\nA) 1\nB) 2\nC) 3\nJavob: A`), QuizParseError);
});

test("admin callback round trips", () => {
  const encoded = encodeAdminCallback("time", 7, "30");
  assert.deepEqual(decodeAdminCallback(encoded), { action: "time", quizId: 7, arg: "30" });
});

test("scoring rewards correctness and speed", () => {
  assert.equal(calculateScore({ correct: false, openedAtMs: 0, answeredAtMs: 100, deadlineAtMs: 1000 }), 0);
  assert.equal(calculateScore({ correct: true, openedAtMs: 0, answeredAtMs: 0, deadlineAtMs: 1000 }), 150);
  assert.equal(calculateScore({ correct: true, openedAtMs: 0, answeredAtMs: 1000, deadlineAtMs: 1000 }), 100);
});

test("leaderboard ranking is stable", () => {
  const ranked = rankPlayers([
    { playerId: 1, displayName: "A", score: 200, correctCount: 2, averageResponseMs: 4000, joinedAt: "2026-01-01T00:00:02Z" },
    { playerId: 2, displayName: "B", score: 300, correctCount: 2, averageResponseMs: 5000, joinedAt: "2026-01-01T00:00:01Z" }
  ]);
  assert.deepEqual(ranked.map(x => x.playerId), [2, 1]);
});
