import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

test("registration migration creates users and registration states", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260916_history_web_users.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.history_users/i);
  assert.match(sql, /telegram_user_id bigint not null unique/i);
  assert.match(sql, /awaiting_first_name/i);
  assert.match(sql, /awaiting_last_name/i);
  assert.match(sql, /enable row level security/i);
});

test("registration copy uses the polished Ark Education wording and Rustam/Usmonov examples", async () => {
  const { registrationFirstNameText, registrationLastNameText, registrationCompleteText, welcomeText } = await import("../src/history/ui.ts");
  assert.match(registrationFirstNameText(), /Ark Education \| Tarix/);
  assert.match(registrationFirstNameText(), /Ark Education’ning Tarix platformasiga xush kelibsiz!/);
  assert.match(registrationFirstNameText(), /Platformadan foydalanish uchun avval qisqa ro‘yxatdan o‘ting/);
  assert.match(registrationFirstNameText(), /<code>Rustam<\/code>/);
  assert.doesNotMatch(registrationFirstNameText(), /Zuhriddin/);

  assert.match(registrationLastNameText("Rustam"), /Ismingiz qabul qilindi/);
  assert.match(registrationLastNameText("Rustam"), /familiya/i);
  assert.match(registrationLastNameText("Rustam"), /<code>Usmonov<\/code>/);
  assert.doesNotMatch(registrationLastNameText("Rustam"), /Rajabov/);

  assert.match(registrationCompleteText("Rustam", "Usmonov"), /Rustam Usmonov/);
  assert.match(registrationCompleteText("Rustam", "Usmonov"), /Ro‘yxatdan o‘tish muvaffaqiyatli yakunlandi/);
  assert.match(registrationCompleteText("Rustam", "Usmonov"), /Ark Education’ning Tarix platformasiga xush kelibsiz!/);
  assert.match(registrationCompleteText("Rustam", "Usmonov"), /Platformaga kirish/);
  assert.doesNotMatch(registrationCompleteText("Rustam", "Usmonov"), /Ilovani ochish/);

  assert.match(welcomeText("Rustam"), /Ark Education \| Tarix/);
  assert.match(welcomeText("Rustam"), /Platformaga kirish/);
});

test("registration asks for confirmation before saving the student", async () => {
  const ui = await import("../src/history/ui.ts");
  assert.equal(typeof (ui as any).registrationConfirmationText, "function");
  assert.equal(typeof (ui as any).registrationConfirmationMenu, "function");
  if (typeof (ui as any).registrationConfirmationText === "function") {
    const text = (ui as any).registrationConfirmationText("Rustam", "Usmonov");
    assert.match(text, /Ma’lumotlaringizni tekshiring/);
    assert.match(text, /Rustam Usmonov/);
  }
  if (typeof (ui as any).registrationConfirmationMenu === "function") {
    const menu = (ui as any).registrationConfirmationMenu();
    assert.deepEqual(menu.reply_markup.inline_keyboard, [[
      { text: "✅ Tasdiqlash", callback_data: "registration:confirm" },
      { text: "✏️ Tahrirlash", callback_data: "registration:edit" },
    ]]);
  }

  const webhook = await readFile(new URL("../api/telegram/webhook.ts", import.meta.url), "utf8");
  const stateSource = await readFile(new URL("../src/history/admin-state.ts", import.meta.url), "utf8");
  assert.match(webhook, /awaiting_confirmation/);
  assert.match(webhook, /registration:confirm/);
  assert.match(webhook, /registration:edit/);
  assert.match(stateSource, /awaiting_confirmation/);

  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  const migrationNames = await readdir(migrationDir);
  const migrationText = (await Promise.all(migrationNames.map((name) => readFile(new URL(name, migrationDir), "utf8")))).join("\n");
  assert.match(migrationText, /awaiting_confirmation/);
});

test("registration hides technical validation rules behind friendly guidance", async () => {
  const webhook = await readFile(new URL("../api/telegram/webhook.ts", import.meta.url), "utf8");
  assert.match(webhook, /Ism noto‘g‘ri kiritildi\. Iltimos, haqiqiy ismingizni yozing\./);
  assert.match(webhook, /Familiya noto‘g‘ri kiritildi\. Iltimos, haqiqiy familiyangizni yozing\./);
  assert.doesNotMatch(webhook, /error\?\.message \|\| "Ism noto‘g‘ri/);
  assert.doesNotMatch(webhook, /error\?\.message \|\| "Familiya noto‘g‘ri/);
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
  assert.match(source, /awaiting_confirmation/);
  assert.match(source, /upsertHistoryUser/);
  assert.match(source, /registrationCompleteText/);
  assert.match(source, /disableWebAppMenuForChat/);
  assert.match(source, /enableWebAppMenuForChat/);
});
