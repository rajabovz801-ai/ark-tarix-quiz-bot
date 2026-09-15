import { getEnv } from "../../src/config/env.ts";
import { setWebhook } from "../../src/lib/telegram.ts";

export default async function handler(req: any, res: any) {
  if (!["GET", "POST"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const env = getEnv();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  if (!host) return res.status(400).json({ ok: false, error: "Missing host" });

  const webhook = `https://${host}/api/telegram/webhook`;
  const result = await setWebhook(webhook, env.TELEGRAM_WEBHOOK_SECRET);

  return res.status(200).json({ ok: true, webhook, result });
}
