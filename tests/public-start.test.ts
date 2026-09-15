import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public welcome points users to the app and exposes no inline public/admin menu", async () => {
  const { welcomeText } = await import("../src/history/ui.ts");
  const text = welcomeText("Rustam");
  assert.match(text, /Xush kelibsiz, <b>Rustam<\/b>/);
  assert.match(text, /ilova/i);
  assert.doesNotMatch(text, /Quyidagi menyudan/);

  const webhook = await readFile(new URL("../api/telegram/webhook.ts", import.meta.url), "utf8");
  assert.doesNotMatch(webhook, /welcomeMenu\(access\.isAdmin\)/);
});
