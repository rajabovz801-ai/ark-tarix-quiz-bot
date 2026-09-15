import test from "node:test";
import assert from "node:assert/strict";

test("public welcome points users to the app and exposes no inline public/admin menu", async () => {
  const { welcomeText, welcomeMenu } = await import("../src/history/ui.ts");
  const text = welcomeText("Rustam");

  assert.match(text, /Xush kelibsiz, <b>Rustam<\/b>/);
  assert.match(text, /ilova/i);
  assert.doesNotMatch(text, /Quyidagi menyudan/);
  assert.deepEqual(welcomeMenu(false), {});
  assert.deepEqual(welcomeMenu(true), {});
});
