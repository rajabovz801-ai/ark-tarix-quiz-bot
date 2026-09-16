import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel packages shared TypeScript source and delegated webhook helper", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const includeFiles = String(config.functions["api/**/*.ts"].includeFiles || "");
  assert.match(includeFiles, /src\/\*\*/);
  assert.match(includeFiles, /api\/telegram\/legacy-webhook\.ts/);
});
