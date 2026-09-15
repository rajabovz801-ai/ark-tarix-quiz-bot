import test from "node:test";
import assert from "node:assert/strict";

test("temporary bootstrap endpoint module exists", async () => {
  await assert.doesNotReject(() => import("../api/telegram/bootstrap.ts"));
});

test("temporary bootstrap endpoint registers the fixed Telegram webhook without exposing secrets", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.ADMIN_TELEGRAM_IDS = "123";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.TELEGRAM_WEBHOOK_SECRET = "telegram-secret";
  process.env.SETUP_SECRET = "setup-secret";

  let telegramRequest: { url: string; body: any } | null = null;
  globalThis.fetch = async (input: any, init?: any) => {
    telegramRequest = {
      url: String(input),
      body: JSON.parse(String(init?.body || "{}")),
    };
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const { default: handler } = await import("../api/telegram/bootstrap.ts");
  let statusCode = 200;
  let responseBody: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      responseBody = body;
      return body;
    },
  };

  await handler({ method: "GET", headers: { host: "ark-tarix-quiz-bot.vercel.app" } }, res);

  assert.equal(statusCode, 200);
  assert.equal(responseBody.ok, true);
  assert.equal(responseBody.webhook, "https://ark-tarix-quiz-bot.vercel.app/api/telegram/webhook");
  assert.equal(JSON.stringify(responseBody).includes("telegram-secret"), false);
  assert.equal(JSON.stringify(responseBody).includes("test-token"), false);
  assert.deepEqual(telegramRequest, {
    url: "https://api.telegram.org/bottest-token/setWebhook",
    body: {
      url: "https://ark-tarix-quiz-bot.vercel.app/api/telegram/webhook",
      secret_token: "telegram-secret",
      allowed_updates: ["message", "callback_query", "poll", "poll_answer"],
      drop_pending_updates: true,
    },
  });
});
