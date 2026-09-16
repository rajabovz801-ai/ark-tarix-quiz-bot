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

test("registration copy asks first name then last name and confirms app access", async () => {
  const { registrationFirstNameText, registrationLastNameText, registrationCompleteText } = await import("../src/history/ui.ts");
  assert.match(registrationFirstNameText(), /ism/i);
  assert.match(registrationLastNameText("Zuhriddin"), /familiya/i);
  assert.match(registrationLastNameText("Zuhriddin"), /Zuhriddin/);
  assert.match(registrationCompleteText("Zuhriddin", "Rajabov"), /Zuhriddin Rajabov/);
  assert.match(registrationCompleteText("Zuhriddin", "Rajabov"), /Ilovani ochish/i);
});

test("registration names are normalized and validated", async () => {
  const { normalizeRegistrationName } = await import("../src/history/user-service.ts");
  assert.equal(normalizeRegistrationName("  zuhriddin  "), "Zuhriddin");
  assert.equal(normalizeRegistrationName("O‘TKIR"), "O‘tkir");
  assert.throws(() => normalizeRegistrationName("A"), /kamida 2/i);
  assert.throws(() => normalizeRegistrationName("12345"), /harf/i);
});
