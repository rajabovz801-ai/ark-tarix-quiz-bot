import legacyHandler from "./legacy-webhook.ts";
import { getEnv } from "../../src/config/env.ts";
import { getAdminState, setAdminState } from "../../src/history/admin-state.ts";
import {
  registrationCompleteText,
  registrationFirstNameText,
  registrationLastNameText,
  welcomeMenu,
  welcomeText,
} from "../../src/history/ui.ts";
import {
  getHistoryUser,
  normalizeRegistrationName,
  upsertHistoryUser,
} from "../../src/history/user-service.ts";
import {
  disableWebAppMenuForChat,
  enableWebAppMenuForChat,
  sendMessage,
} from "../../src/lib/telegram.ts";

function isAuthorizedTelegramRequest(req: any): boolean {
  const env = getEnv();
  const secret = String(req.headers?.["x-telegram-bot-api-secret-token"] || "");
  return secret === env.TELEGRAM_WEBHOOK_SECRET;
}

async function handleRegistrationMessage(message: any): Promise<boolean> {
  if (message?.chat?.type !== "private") return false;

  const userId = Number(message?.from?.id || 0);
  const chatId = Number(message?.chat?.id || 0);
  if (!userId || !chatId) return false;

  const text = String(message?.text || "").trim();

  if (text.startsWith("/start")) {
    const existing = await getHistoryUser(userId);
    if (existing) {
      await setAdminState(userId, "idle");
      await enableWebAppMenuForChat(chatId);
      await sendMessage(chatId, welcomeText(existing.first_name), {
        parse_mode: "HTML",
        ...welcomeMenu(false),
      });
      return true;
    }

    await disableWebAppMenuForChat(chatId);
    await setAdminState(userId, "awaiting_first_name");
    await sendMessage(chatId, registrationFirstNameText(), { parse_mode: "HTML" });
    return true;
  }

  if (!text || text.startsWith("/")) return false;

  const state = await getAdminState(userId);

  if (state.state === "awaiting_first_name") {
    try {
      const firstName = normalizeRegistrationName(text);
      await setAdminState(userId, "awaiting_last_name", { firstName });
      await sendMessage(chatId, registrationLastNameText(firstName), { parse_mode: "HTML" });
    } catch (error: any) {
      await sendMessage(chatId, `❌ ${String(error?.message || "Ism noto‘g‘ri.")}\n\nIsmingizni qayta yozing.`);
    }
    return true;
  }

  if (state.state === "awaiting_last_name") {
    const firstName = String(state.payload?.firstName || "").trim();
    if (!firstName) {
      await setAdminState(userId, "awaiting_first_name");
      await sendMessage(chatId, registrationFirstNameText(), { parse_mode: "HTML" });
      return true;
    }

    try {
      const lastName = normalizeRegistrationName(text);
      const user = await upsertHistoryUser({
        telegramUserId: userId,
        telegramUsername: message.from?.username || null,
        telegramFirstName: message.from?.first_name || null,
        telegramLastName: message.from?.last_name || null,
        firstName,
        lastName,
      });
      await setAdminState(userId, "idle");
      await enableWebAppMenuForChat(chatId);
      await sendMessage(chatId, registrationCompleteText(user.first_name, user.last_name), {
        parse_mode: "HTML",
        ...welcomeMenu(false),
      });
    } catch (error: any) {
      await sendMessage(chatId, `❌ ${String(error?.message || "Familiya noto‘g‘ri.")}\n\nFamiliyangizni qayta yozing.`);
    }
    return true;
  }

  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  try {
    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (update?.message) {
      if (!isAuthorizedTelegramRequest(req)) return res.status(401).json({ ok: false });
      const handled = await handleRegistrationMessage(update.message);
      if (handled) return res.status(200).json({ ok: true, registration: true });
    }
    return legacyHandler(req, res);
  } catch (error: any) {
    console.error("registration_webhook_error", error?.message || error, error?.stack || "");
    return res.status(200).json({ ok: false, handled: true });
  }
}
