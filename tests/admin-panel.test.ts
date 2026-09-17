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

test("public welcome stays simple while admin panel remains available through admin flow", async () => {
  const { welcomeText, welcomeMenu, adminPanelMenu } = await import("../src/history/ui.ts");
  const welcome = welcomeText("Rustam");
  const url = "https://ark-tarix-web-app.vercel.app";
  assert.match(welcome, /Xush kelibsiz, <b>Rustam<\/b>/);
  assert.match(welcome, /platforma/i);
  assert.deepEqual(welcomeMenu(false, url), {
    reply_markup: {
      inline_keyboard: [[{ text: "🚀 Platformaga kirish", web_app: { url } }]],
    },
  });
  assert.deepEqual(welcomeMenu(true, url), welcomeMenu(false, url));

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
  assert.equal(detail.leaderboard[0].displayName, "Ali");
  assert.equal(detail.leaderboard[0].rank, 1);
});
