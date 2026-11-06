import { getEnv } from "../config/env.ts";
import { DatabaseError, dbInsert, dbSelect, dbUpdate } from "../lib/supabase.ts";
import { answerCallbackQuery, disableWebAppMenuForChat, enableWebAppMenuForChat, sendMessage } from "../lib/telegram.ts";
import { getAdminAccess } from "./admin-service.ts";
import { escapeHtml, welcomeMenu } from "./ui.ts";
import { getHistoryUser } from "./user-service.ts";

const table = "history_bot_subscriptions";
const duration = 30 * 24 * 60 * 60 * 1000;

type Subscription = {
  telegram_user_id: number;
  status: "pending" | "paid" | "center";
  expires_at: string | null;
};

export function subscriptionState(row: Subscription, now = Date.now()) {
  if (row.status === "paid" && Date.parse(row.expires_at ?? "") <= now) return "expired";
  return row.status;
}

export async function getSubscription(userId: number) {
  const [row] = await dbSelect<Subscription>(table, { telegram_user_id: `eq.${userId}` });
  return row;
}

export async function requestSubscription(userId: number) {
  try {
    await dbInsert(table, { telegram_user_id: userId });
    return true;
  } catch (error) {
    if (error instanceof DatabaseError && (error.detail as { code?: string })?.code === "23505") return false;
    throw error;
  }
}

export async function sendSubscriptionOffer(chatId: number, intro: string, expired = false) {
  await disableWebAppMenuForChat(chatId);
  const payment = [{
    text: expired ? "Obunani yangilash" : "To‘lov uchun yozish",
    url: "https://t.me/rustam_usmon0v",
  }];
  const platform = [{ text: "🏛 Platformaga kirish", web_app: { url: getEnv().WEB_APP_URL } }];
  await sendMessage(chatId, `🏛 <b>Ark Education | Tarix</b>\n\n${intro}\n\n${expired ? "🔒 Obunangizni yangilashingiz mumkin." : "⏳ Testlarga kirish super admin tasdig‘idan keyin ochiladi."}\n\n💳 <b>1 oylik obuna — 35 000 so‘m</b>\nBog‘lanish: @rustam_usmon0v`, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: expired ? [payment] : [platform, payment] },
  });
}

async function showRequest(chatId: number, userId: number, newRegistration = false) {
  const user = await getHistoryUser(userId);
  if (!user) return false;

  const row = await getSubscription(userId);
  const state = row ? subscriptionState(row) : "pending";
  const version = row?.expires_at ? Date.parse(row.expires_at) : 0;
  const name = escapeHtml(`${user.first_name} ${user.last_name}`);
  const approval = state === "pending" || state === "expired" ? [
      [{ text: "💳 1 oylik obunani tasdiqlash", callback_data: `sub:paid:${userId}:${version}` }],
      [{ text: "🎓 Markaz o‘quvchisi · bepul", callback_data: `sub:center:${userId}:${version}` }],
  ] : [];
  const buttons = { reply_markup: { inline_keyboard: [...approval, [{ text: "🗑 O‘quvchini o‘chirish", callback_data: `sub:remove:${userId}` }]] } };
  const labels = { pending: "Tasdiq kutilmoqda", expired: "Obuna tugagan", paid: "Obuna faol", center: "Markaz o‘quvchisi" };
  await sendMessage(chatId, `${newRegistration ? "👤 <b>Yangi ro‘yxatdan o‘tish</b>" : "📋 <b>Foydalanuvchi obunasi</b>"}\n\n<b>Ism-familiya:</b> ${name}\n<b>Telegram ID:</b> <code>${userId}</code>\n<b>Holat:</b> ${newRegistration && state === "pending" ? "Tasdiq kutilmoqda" : labels[state]}`, {
    parse_mode: "HTML",
    ...buttons,
  });
  return true;
}

export async function notifySubscriptionAdmins(userId: number) {
  await Promise.allSettled([...getEnv().ADMIN_TELEGRAM_IDS].map((id) => showRequest(Number(id), userId, true)));
}

export async function handleSubscriptionAdmin(update: any, isCallback: boolean) {
  const chat = isCallback ? update?.message?.chat : update?.chat;
  if (chat?.type !== "private") return false;

  const userId = Number(update?.from?.id);
  const input = String(isCallback ? update?.data : update?.text ?? "").trim();
  const command = /^\/admin(?:\s+(\d+))?$/.exec(input);
  if (isCallback ? !input.startsWith("sub:") : !command) return false;

  const { isSuperAdmin } = await getAdminAccess(userId, getEnv().ADMIN_TELEGRAM_IDS);
  if (!isSuperAdmin) {
    if (isCallback) await answerCallbackQuery(update.id, "Bu amal faqat super adminlar uchun.");
    else await sendMessage(chat.id, "Bu bo‘lim faqat super adminlar uchun.");
    return true;
  }

  if (!isCallback) {
    if (command?.[1]) {
      if (!await showRequest(chat.id, Number(command[1]))) await sendMessage(chat.id, "Foydalanuvchi topilmadi.");
      return true;
    }
    const rows = await dbSelect<Subscription>(table, { status: "eq.pending", order: "requested_at.asc", limit: "10" });
    await sendMessage(chat.id, rows.length
      ? "Obunalar · Tasdiq kutayotgan arizalar\nFoydalanuvchini ID bo‘yicha ochish: /admin TELEGRAM_ID"
      : "Hozircha yangi ariza yo‘q.\nFoydalanuvchini ID bo‘yicha ochish: /admin TELEGRAM_ID");
    for (const row of rows) await showRequest(chat.id, row.telegram_user_id);
    return true;
  }

  const removal = /^sub:(remove|confirm-remove):(\d+)$/.exec(input);
  if (removal) {
    const target = Number(removal[2]);
    const profile = Number.isSafeInteger(target) ? await getHistoryUser(target) : null;
    if (!profile || (await getAdminAccess(target, getEnv().ADMIN_TELEGRAM_IDS)).isAdmin) {
      await answerCallbackQuery(update.id, "Bu profilni o‘chirib bo‘lmaydi.");
      return true;
    }
    await answerCallbackQuery(update.id, removal[1] === "remove" ? "Tasdiqlash kerak." : "So‘rov qabul qilindi.");
    if (removal[1] === "remove") {
      await sendMessage(chat.id, `🗑 <b>${escapeHtml(profile.first_name + " " + profile.last_name)}</b> profilini nofaol qilasizmi?`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "O‘chirishni tasdiqlash", callback_data: `sub:confirm-remove:${target}` }]] },
      });
      return true;
    }
    await requestSubscription(target);
    await dbUpdate(table, { telegram_user_id: `eq.${target}` }, { status: "pending", expires_at: null, approved_by: null });
    await dbUpdate("history_users", { telegram_user_id: `eq.${target}` }, { is_active: false });
    await disableWebAppMenuForChat(target).catch(() => undefined);
    await sendMessage(chat.id, "✅ O‘quvchi profili nofaol qilindi va kirish ruxsati bekor qilindi.");
    return true;
  }

  const action = /^sub:(paid|center):(\d+):(\d+)$/.exec(input);
  const target = Number(action?.[2]);
  if (!action || !Number.isSafeInteger(target) || !await getHistoryUser(target)) {
    await answerCallbackQuery(update.id, "Ariza topilmadi.");
    return true;
  }
  const current = await getSubscription(target);
  const now = Date.now();
  const version = current?.expires_at ? Date.parse(current.expires_at) : 0;
  const state = current ? subscriptionState(current, now) : "pending";
  if (Number(action[3]) !== version || (state !== "pending" && state !== "expired")) {
    await answerCallbackQuery(update.id, "Bu tugma eskirgan. /admin orqali arizani qayta oching.");
    return true;
  }
  if (!current) await requestSubscription(target);
  const status = action[1];
  const expiresAt = status === "paid" ? new Date(now + duration).toISOString() : null;
  const [updated] = await dbUpdate<Subscription>(table, {
    telegram_user_id: `eq.${target}`,
    status: state === "expired" ? "eq.paid" : "eq.pending",
    expires_at: current?.expires_at ? `eq.${current.expires_at}` : "is.null",
  }, { status, expires_at: expiresAt, approved_by: userId });
  if (!updated) {
    await answerCallbackQuery(update.id, "Kirish allaqachon faollashtirilgan.");
    return true;
  }

  await answerCallbackQuery(update.id, "Kirish faollashtirildi.");
  const expiry = expiresAt && new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tashkent",
  }).format(new Date(expiresAt));
  try {
    await enableWebAppMenuForChat(target);
    await sendMessage(target, expiry
      ? `✅ Obunangiz faollashtirildi.\nAmal qilish muddati: ${expiry} (Toshkent vaqti).`
      : "✅ Markaz o‘quvchisi sifatida sizga bepul kirish berildi.", welcomeMenu(false));
  } catch {
    await sendMessage(chat.id, "Kirish faollashtirildi. Tasdiq xabarini yetkazib bo‘lmadi. Foydalanuvchi /start orqali kirishi mumkin.");
  }
  return true;
}
