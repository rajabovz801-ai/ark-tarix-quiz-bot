import { getEnv } from "../../src/config/env.ts";
import { setChatMenuButton, setWebhook } from "../../src/lib/telegram.ts";
import { buildWebAppMenuButton } from "../../src/history/web-app-menu.ts";

export default async function handler(req: any, res: any) {
  if (!["GET", "POST"].includes(req.method || "")) return res.status(405).json({ ok: false });
  const env = getEnv();
  const auth = String(req.headers.authorization || "");
  if (auth !== `Bearer ${env.SETUP_SECRET}`) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  if (!host) return res.status(400).json({ ok: false, error: "Missing host" });
  const url = `https://${host}/api/telegram/webhook`;
  const result = await setWebhook(url, env.TELEGRAM_WEBHOOK_SECRET);
  let menuButtonConfigured = false;
  if (env.WEB_APP_URL) {
    await setChatMenuButton(buildWebAppMenuButton(env.WEB_APP_URL));
    menuButtonConfigured = true;
  }
  return res.status(200).json({ ok: true, webhook: url, menuButtonConfigured, result });
}
