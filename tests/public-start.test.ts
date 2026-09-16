import test from "node:test";
import assert from "node:assert/strict";

test("public welcome shows a visible Web App button and no public/admin menu clutter", async () => {
  const { welcomeText, welcomeMenu } = await import("../src/history/ui.ts");
  const text = welcomeText("Rustam");
  const url = "https://ark-tarix-web-app.vercel.app";

  assert.match(text, /Xush kelibsiz, <b>Rustam<\/b>/);
  assert.match(text, /ilova/i);
  assert.doesNotMatch(text, /Quyidagi menyudan/);
  assert.deepEqual(welcomeMenu(false, url), {
    reply_markup: {
      inline_keyboard: [[
        { text: "🚀 Ilovani ochish", web_app: { url } },
      ]],
    },
  });
  assert.deepEqual(welcomeMenu(true, url), welcomeMenu(false, url));
});

test("welcome button uses configured WEB_APP_URL when webhook calls welcomeMenu normally", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123:abc";
  process.env.ADMIN_TELEGRAM_IDS = "1";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
  process.env.WEB_APP_URL = "https://ark-tarix-web-app.vercel.app/";

  const { welcomeMenu } = await import("../src/history/ui.ts");
  const markup = welcomeMenu(false);
  assert.equal(markup.reply_markup.inline_keyboard[0][0].text, "🚀 Ilovani ochish");
  assert.deepEqual(markup.reply_markup.inline_keyboard[0][0], {
    text: "🚀 Ilovani ochish",
    web_app: { url: "https://ark-tarix-web-app.vercel.app" },
  });
});
