import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("registration migration creates users and registration states", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260916_history_web_users.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.history_users/i);
  assert.match(sql, /telegram_user_id bigint not null unique/i);
  assert.match(sql, /awaiting_first_name/i);
  assert.match(sql, /awaiting_last_name/i);
  assert.match(sql, /enable row level security/i);
});

test("registration copy uses Rustam and Usmonov as the examples", async () => {
  const { registrationFirstNameText, registrationLastNameText, registrationCompleteText } = await import("../src/history/ui.ts");
  assert.match(registrationFirstNameText(), /<code>Rustam<\/code>/);
  assert.doesNotMatch(registrationFirstNameText(), /Zuhriddin/);
  assert.match(registrationLastNameText("Rustam"), /familiya/i);
  assert.match(registrationLastNameText("Rustam"), /<code>Usmonov<\/code>/);
  assert.doesNotMatch(registrationLastNameText("Rustam"), /Rajabov/);
  assert.match(registrationCompleteText("Rustam", "Usmonov"), /Rustam Usmonov/);
  assert.match(registrationCompleteText("Rustam", "Usmonov"), /Ilovani ochish/i);
});

test("registration names are normalized and validated", async () => {
  const { normalizeRegistrationName } = await import("../src/history/user-service.ts");
  assert.equal(normalizeRegistrationName("  rustam  "), "Rustam");
  assert.equal(normalizeRegistrationName("O‘TKIR"), "O‘tkir");
  assert.throws(() => normalizeRegistrationName("A"), /kamida 2/i);
  assert.throws(() => normalizeRegistrationName("12345"), /harf/i);
});

test("private start gates the persistent Web App menu until registration completes", async () => {
  const source = await readFile(new URL("../api/telegram/webhook.ts", import.meta.url), "utf8");
  assert.match(source, /getHistoryUser/);
  assert.match(source, /awaiting_first_name/);
  assert.match(source, /awaiting_last_name/);
  assert.match(source, /upsertHistoryUser/);
  assert.match(source, /registrationCompleteText/);
  assert.match(source, /disableWebAppMenuForChat/);
  assert.match(source, /enableWebAppMenuForChat/);
});
