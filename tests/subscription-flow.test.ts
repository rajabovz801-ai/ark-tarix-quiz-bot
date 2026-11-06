import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/telegram/webhook.ts";

test("registration sends a demo offer and only an admin can grant paid access", async (t) => {
  Object.assign(process.env, {
    TELEGRAM_BOT_TOKEN: "test", ADMIN_TELEGRAM_IDS: "100",
    SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_ROLE_KEY: "test",
    TELEGRAM_WEBHOOK_SECRET: "test-secret", WEB_APP_URL: "https://app.example.test",
  });
  let user: Record<string, unknown> | undefined;
  let subscription: Record<string, unknown> | undefined;
  let state: Record<string, unknown> = { state: "awaiting_confirmation", payload_json: { firstName: "Sinov", lastName: "O‘quvchi" } };
  const messages: Array<{ chat_id: number; text: string; reply_markup?: { inline_keyboard: Array<Array<Record<string, unknown>>> } }> = [];
  t.mock.method(globalThis, "fetch", async (raw: string, init: RequestInit = {}) => {
    const url = new URL(raw);
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (url.hostname === "api.telegram.org") {
      if (url.pathname.endsWith("/sendMessage")) messages.push(body);
      return Response.json({ ok: true, result: true });
    }
    const table = url.pathname.split("/").at(-1);
    if (table === "history_bot_state") {
      if (body) state = body;
      return Response.json([state]);
    }
    if (table === "history_users") {
      if (body) user = body;
      return Response.json(user ? [user] : []);
    }
    if (table === "history_admins") return Response.json([]);
    assert.equal(table, "history_bot_subscriptions");
    if (init.method === "POST") subscription = { ...body, status: "pending", expires_at: null };
    if (init.method === "PATCH" && subscription?.status === "pending") subscription = { ...subscription, ...body };
    return Response.json(subscription ? [subscription] : []);
  });

  async function callback(id: number, data: string) {
    let result: unknown;
    await handler({
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "test-secret" },
      body: { callback_query: { id: "callback", from: { id }, message: { chat: { type: "private", id } }, data } },
    }, { status: () => ({ json: (value: unknown) => { result = value; } }) });
    assert.deepEqual(result, { ok: true, registration: true });
  }

  await callback(200, "registration:confirm");
  const offer = messages.find((message) => message.chat_id === 200);
  assert.match(offer?.text ?? "", /35 000/);
  assert.deepEqual(offer?.reply_markup?.inline_keyboard[0][0].web_app, { url: "https://app.example.test" });
  assert.equal(messages.some((message) => message.chat_id === 100), true);
  await callback(200, "sub:paid:200:0");
  assert.equal(subscription?.status, "pending");

  const before = Date.now();
  await callback(100, "sub:paid:200:0");
  const expiry = Date.parse(String(subscription?.expires_at));
  assert.equal(subscription?.status, "paid");
  assert.ok(expiry >= before + 30 * 86400000 && expiry <= Date.now() + 30 * 86400000);
  assert.match(messages.at(-1)?.text ?? "", /Obunangiz faollashtirildi/);
  await callback(100, "sub:paid:200:0");
  assert.equal(Date.parse(String(subscription?.expires_at)), expiry);
});
