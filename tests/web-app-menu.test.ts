import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Telegram Web App menu button uses the configured HTTPS app URL", async () => {
  const { buildWebAppMenuButton } = await import("../src/history/web-app-menu.ts");
  assert.deepEqual(buildWebAppMenuButton("https://tarix-app.vercel.app"), {
    type: "web_app",
    text: "🚀 Ilovani ochish",
    web_app: { url: "https://tarix-app.vercel.app" },
  });
  assert.throws(() => buildWebAppMenuButton("http://localhost:3000"), /HTTPS/);
});

test("runtime env exposes an optional WEB_APP_URL without breaking the existing bot", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123:abc";
  process.env.ADMIN_TELEGRAM_IDS = "1";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
  process.env.WEB_APP_URL = "https://tarix-app.vercel.app/";
  const { getEnv } = await import("../src/config/env.ts");
  assert.equal(getEnv().WEB_APP_URL, "https://tarix-app.vercel.app");
});

test("Telegram setup configures the persistent web-app menu button and preserves webhook setup", async () => {
  const setup = await readFile(new URL("../api/telegram/setup.ts", import.meta.url), "utf8");
  assert.match(setup, /setWebhook/);
  assert.match(setup, /setChatMenuButton/);
  assert.match(setup, /WEB_APP_URL/);
});
