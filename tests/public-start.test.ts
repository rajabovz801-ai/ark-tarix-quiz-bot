import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

test("webhook passes the configured Web App URL into the visible welcome button", async () => {
  const webhook = await readFile(new URL("../api/telegram/webhook.ts", import.meta.url), "utf8");
  assert.match(webhook, /welcomeMenu\([^)]*WEB_APP_URL/);
});
