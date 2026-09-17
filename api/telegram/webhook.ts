import legacyHandler from "./legacy-webhook.ts";
import { getEnv } from "../../src/config/env.ts";
import { getAdminState, setAdminState } from "../../src/history/admin-state.ts";
import {
  registrationCompleteText,
  registrationConfirmationMenu,
  registrationConfirmationText,
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
  answerCallbackQuery,
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
    } catch {
      await sendMessage(chatId, "⚠️ Ism noto‘g‘ri kiritildi. Iltimos, haqiqiy ismingizni yozing.");
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
      await setAdminState(userId, "awaiting_confirmation", { firstName, lastName });
      await sendMessage(chatId, registrationConfirmationText(firstName, lastName), {
        parse_mode: "HTML",
        ...registrationConfirmationMenu(),
      });
    } catch {
      await sendMessage(chatId, "⚠️ Familiya noto‘g‘ri kiritildi. Iltimos, haqiqiy familiyangizni yozing.");
    }
    return true;
  }

  return false;
}

async function handleRegistrationCallback(callback: any): Promise<boolean> {
  const data = String(callback?.data || "");
  if (data !== "registration:confirm" && data !== "registration:edit") return false;
  if (callback?.message?.chat?.type !== "private") return false;

  const userId = Number(callback?.from?.id || 0);
  const chatId = Number(callback?.message?.chat?.id || 0);
  if (!userId || !chatId) return false;

  const state = await getAdminState(userId);
  if (state.state !== "awaiting_confirmation") {
    await answerCallbackQuery(callback.id, "Bu tasdiqlash so‘rovi eskirgan. /start ni qayta yuboring.");
    return true;
  }

  const firstName = String(state.payload?.firstName || "").trim();
  const lastName = String(state.payload?.lastName || "").trim();
  if (!firstName || !lastName) {
    await answerCallbackQuery(callback.id, "Ma’lumotlarni qayta kiriting.");
    await setAdminState(userId, "awaiting_first_name");
    await disableWebAppMenuForChat(chatId);
    await sendMessage(chatId, registrationFirstNameText(), { parse_mode: "HTML" });
    return true;
  }

  if (data === "registration:edit") {
    await answerCallbackQuery(callback.id, "Ma’lumotlarni qayta kiriting.");
    await setAdminState(userId, "awaiting_first_name");
    await disableWebAppMenuForChat(chatId);
    await sendMessage(chatId, registrationFirstNameText(), { parse_mode: "HTML" });
    return true;
  }

  const user = await upsertHistoryUser({
    telegramUserId: userId,
    telegramUsername: callback.from?.username || null,
    telegramFirstName: callback.from?.first_name || null,
    telegramLastName: callback.from?.last_name || null,
    firstName,
    lastName,
  });
  await setAdminState(userId, "idle");
  await enableWebAppMenuForChat(chatId);
  await answerCallbackQuery(callback.id, "Tasdiqlandi ✅");
  await sendMessage(chatId, registrationCompleteText(user.first_name, user.last_name), {
    parse_mode: "HTML",
    ...welcomeMenu(false),
  });
  return true;
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
    if (update?.callback_query) {
      if (!isAuthorizedTelegramRequest(req)) return res.status(401).json({ ok: false });
      const handled = await handleRegistrationCallback(update.callback_query);
      if (handled) return res.status(200).json({ ok: true, registration: true });
    }
    return legacyHandler(req, res);
  } catch (error: any) {
    console.error("registration_webhook_error", error?.message || error, error?.stack || "");
    return res.status(200).json({ ok: false, handled: true });
  }
}
