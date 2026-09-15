import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin role resolution protects environment super admins", async () => {
  const { resolveAdminRole } = await import("../src/history/admin-service.ts");
  const superIds = new Set(["100"]);
  const dynamicIds = new Set(["200"]);
  assert.deepEqual(resolveAdminRole(100, superIds, dynamicIds), { isAdmin: true, isSuperAdmin: true, role: "super_admin" });
  assert.deepEqual(resolveAdminRole(200, superIds, dynamicIds), { isAdmin: true, isSuperAdmin: false, role: "admin" });
  assert.deepEqual(resolveAdminRole(300, superIds, dynamicIds), { isAdmin: false, isSuperAdmin: false, role: "user" });
});

test("settings normalize defaults and only allow supported quiz times", async () => {
  const { normalizeSettings, assertAllowedQuizTime } = await import("../src/history/settings-service.ts");
  assert.deepEqual(normalizeSettings(null), {
    defaultTimeLimit: 20,
    shuffleQuestions: false,
    shuffleOptions: false,
  });
  assert.deepEqual(normalizeSettings({ default_time_limit: 45, shuffle_questions: true, shuffle_options: true }), {
    defaultTimeLimit: 45,
    shuffleQuestions: true,
    shuffleOptions: true,
  });
  assert.doesNotThrow(() => assertAllowedQuizTime(30));
  assert.throws(() => assertAllowedQuizTime(25), /Unsupported quiz time/);
});

test("welcome menu is role aware and does not expose student results", async () => {
  const { welcomeText, welcomeMenu, adminPanelMenu } = await import("../src/history/ui.ts");
  assert.match(welcomeText("Zuhriddin"), /Xush kelibsiz, <b>Zuhriddin<\/b>/);

  const student = JSON.stringify(welcomeMenu(false));
  assert.match(student, /📚 Quizlar/);
  assert.match(student, /ℹ️ Bot haqida/);
  assert.doesNotMatch(student, /Natijalar/);
  assert.doesNotMatch(student, /Admin panel/);

  const admin = JSON.stringify(welcomeMenu(true));
  assert.match(admin, /⚙️ Admin panel/);

  const panel = JSON.stringify(adminPanelMenu(true));
  for (const label of ["➕ Test qo‘shish", "📚 Testlar", "👥 Guruhlar", "🏆 Natijalar", "📊 Statistika", "👑 Adminlar", "⚙️ Sozlamalar", "🏠 Bosh menyu"]) {
    assert.match(panel, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("completed quiz group message includes podium and persistence note", async () => {
  const { formatCompletedQuizMessage } = await import("../src/history/ui.ts");
  const text = formatCompletedQuizMessage({
    quizTitle: "Amir Temur davri",
    groupTitle: "404-guruh",
    participantCount: 3,
    ranked: [
      { rank: 1, displayName: "Ali", score: 500 },
      { rank: 2, displayName: "Vali", score: 450 },
      { rank: 3, displayName: "Sami", score: 400 },
    ],
  });
  assert.match(text, /🏁 <b>QUIZ YAKUNLANDI!<\/b>/);
  assert.match(text, /🥇 Ali — <b>500<\/b> ball/);
  assert.match(text, /🥈 Vali — <b>450<\/b> ball/);
  assert.match(text, /🥉 Sami — <b>400<\/b> ball/);
  assert.match(text, /Natijalar bazaga saqlandi/);
});

test("admin panel migration creates admins, settings and admin input state", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260915_history_admin_panel.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.history_admins/i);
  assert.match(sql, /create table if not exists public\.history_settings/i);
  assert.match(sql, /awaiting_admin_id/i);
  assert.match(sql, /enable row level security/i);
});

test("result detail joins session metadata with ranked players", async () => {
  const { buildResultDetail } = await import("../src/history/result-service.ts");
  const detail = buildResultDetail(
    { id: 9, started_at: "2026-09-15T10:00:00Z", ended_at: "2026-09-15T10:10:00Z" },
    { title: "Temuriylar" },
    { title: "404" },
    [{ id: 5, display_name: "Ali" }],
    [{ player_id: 5, rank: 1, score: 700, correct_count: 6, wrong_count: 1, accuracy_percent: 85.71, average_response_ms: 4200 }],
  );
  assert.equal(detail.quizTitle, "Temuriylar");
  assert.equal(detail.groupTitle, "404");
  assert.equal(detail.participantCount, 1);
  assert.equal(detail.leaderboard[0].displayName, "Ali");
  assert.equal(detail.leaderboard[0].score, 700);
});

test("admin statistics count unique Telegram players", async () => {
  const { summarizeAdminStats } = await import("../src/history/stats-service.ts");
  const stats = summarizeAdminStats({
    quizzes: [{ id: 1 }, { id: 2 }],
    groups: [{ id: 1 }],
    sessions: [{ id: 1 }, { id: 2 }, { id: 3 }],
    players: [{ telegram_user_id: 10 }, { telegram_user_id: 10 }, { telegram_user_id: 11 }],
    answers: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
  });
  assert.deepEqual(stats, { totalQuizzes: 2, totalGroups: 1, completedSessions: 3, uniquePlayers: 2, storedAnswers: 4 });
});

test("webhook wires admin panel, persistent results and confirmation actions", async () => {
  const webhook = await readFile(new URL("../api/telegram/webhook.ts", import.meta.url), "utf8");
  const session = await readFile(new URL("../src/history/session-engine.ts", import.meta.url), "utf8");
  const quiz = await readFile(new URL("../src/history/quiz-service.ts", import.meta.url), "utf8");
  assert.match(webhook, /\/admin/);
  assert.match(webhook, /panel:results/);
  assert.match(webhook, /awaiting_admin_id/);
  assert.match(webhook, /delete_confirm/);
  assert.match(webhook, /getAdminAccess/);
  assert.match(session, /formatCompletedQuizMessage/);
  assert.match(quiz, /getSettings/);
});
