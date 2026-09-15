import test from "node:test";
import assert from "node:assert/strict";

test("getEnv derives a webhook secret from the bot token when TELEGRAM_WEBHOOK_SECRET is absent", async (t) => {
  const original = { ...process.env };
  t.after(() => { process.env = original; });

  process.env.TELEGRAM_BOT_TOKEN = "123456:ABC_test-token";
  process.env.ADMIN_TELEGRAM_IDS = "123";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.SETUP_SECRET;

  const { getEnv } = await import("../src/config/env.ts");
  const env = getEnv();

  assert.match(env.TELEGRAM_WEBHOOK_SECRET, /^[a-f0-9]{64}$/);
  assert.notEqual(env.TELEGRAM_WEBHOOK_SECRET, process.env.TELEGRAM_BOT_TOKEN);
  assert.equal(env.SETUP_SECRET, "");
});
