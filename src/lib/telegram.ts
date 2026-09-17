import { getEnv } from "../config/env.ts";
import { buildWebAppMenuButton } from "../history/web-app-menu.ts";

export class TelegramApiError extends Error {
  method: string;
  description: string;
  constructor(method: string, description: string) {
    super(`Telegram ${method}: ${description}`);
    this.name = "TelegramApiError";
    this.method = method;
    this.description = description;
  }
}

export async function telegram<T = any>(method: string, payload: Record<string, unknown>): Promise<T> {
  const { TELEGRAM_BOT_TOKEN } = getEnv();
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as any;
  if (!response.ok || !data.ok) throw new TelegramApiError(method, data.description || `HTTP ${response.status}`);
  return data.result as T;
}

export async function sendMessage(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  return telegram("sendMessage", { chat_id: chatId, text, ...extra });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return telegram("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

export function editMessageText(chatId: number | string, messageId: number, text: string, extra: Record<string, unknown> = {}) {
  return telegram("editMessageText", { chat_id: chatId, message_id: messageId, text, ...extra });
}

export function sendQuizPoll(params: {
  chatId: number;
  question: string;
  options: string[];
  correctIndex: number;
  openPeriod: number;
  explanation?: string | null;
}) {
  return telegram<any>("sendPoll", {
    chat_id: params.chatId,
    question: params.question.slice(0, 300),
    options: params.options.map((text) => ({ text: text.slice(0, 100) })),
    is_anonymous: false,
    type: "quiz",
    allows_multiple_answers: false,
    correct_option_id: params.correctIndex,
    open_period: params.openPeriod,
    ...(params.explanation ? { explanation: params.explanation.slice(0, 200) } : {}),
  });
}

export function setWebhook(url: string, secretToken: string) {
  return telegram("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query", "poll", "poll_answer"],
    drop_pending_updates: true,
  });
}

export function setChatMenuButton(menuButton: Record<string, unknown>, chatId?: number | string) {
  return telegram("setChatMenuButton", {
    ...(chatId ? { chat_id: chatId } : {}),
    menu_button: menuButton,
  });
}

export function disableWebAppMenuForChat(chatId: number | string) {
  return setChatMenuButton({ type: "commands" }, chatId);
}

export function enableWebAppMenuForChat(chatId: number | string) {
  const { WEB_APP_URL } = getEnv();
  return setChatMenuButton(buildWebAppMenuButton(WEB_APP_URL), chatId);
}
