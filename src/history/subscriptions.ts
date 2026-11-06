import { getEnv } from "../config/env.ts";
import { DatabaseError, dbInsert, dbSelect, dbUpdate } from "../lib/supabase.ts";
import { answerCallbackQuery, disableWebAppMenuForChat, enableWebAppMenuForChat, sendMessage } from "../lib/telegram.ts";
import { getAdminState, setAdminState } from "./admin-state.ts";
import { getAdminAccess } from "./admin-service.ts";
import { escapeHtml, welcomeMenu } from "./ui.ts";
import { getHistoryUser, type HistoryUser } from "./user-service.ts";

const table = "history_bot_subscriptions";
const duration = 30 * 24 * 60 * 60 * 1000;

type Subscription = {
  telegram_user_id: number;
  status: "pending" | "paid" | "center";
  expires_at: string | null;
  requested_at?: string;
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
  await sendMessage(chatId, `🏛 <b>Ark Education | Tarix</b>\n\n${intro}\n\n${expired ? "🔒 Obunangizni yangilashingiz mumkin." : "⏳ Testlarga kirish super admin tasdig‘idan keyin ochiladi."}\n\n💳 <b>1 oylik obuna — 35 000 so‘m</b>\nBog‘lanish: @rustam_usmon0v`, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [payment] },
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
  const buttons = { reply_markup: { inline_keyboard: [...approval, [{ text: "🗑 O‘quvchini o‘chirish", callback_data: `sub:remove:${userId}` }], [{ text: "⬅️ Admin menyusi", callback_data: "sub:menu" }]] } };
  const formatDate = (value?: string | null) => value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("uz-UZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tashkent" }).format(new Date(value))
    : "—";
  const expiry = state === "center" ? "Muddatsiz" : formatDate(row?.expires_at);
  const labels = { pending: "Tasdiq kutilmoqda", expired: "Obuna tugagan", paid: "Obuna faol", center: "Markaz o‘quvchisi" };
  await sendMessage(chatId, `${newRegistration ? "👤 <b>Yangi ro‘yxatdan o‘tish</b>" : "📋 <b>Foydalanuvchi obunasi</b>"}\n\n<b>Ism-familiya:</b> ${name}\n<b>Telegram ID:</b> <code>${userId}</code>\n📅 <b>Ro‘yxatdan o‘tgan:</b> ${formatDate(user.registered_at)}\n📥 <b>Ariza vaqti:</b> ${formatDate(row?.requested_at)}\n⏳ <b>Obuna tugashi:</b> ${expiry}\n<b>Holat:</b> ${newRegistration && state === "pending" ? "Tasdiq kutilmoqda" : labels[state]}`, {
    parse_mode: "HTML",
    ...buttons,
  });
  return true;
}

export async function notifySubscriptionAdmins(userId: number) {
  await Promise.allSettled([...getEnv().ADMIN_TELEGRAM_IDS].map((id) => showRequest(Number(id), userId, true)));
}

const backButton = { text: "⬅️ Admin menyusi", callback_data: "sub:menu" };

async function showAdminMenu(chatId: number) {
  await sendMessage(chatId, "🛠 <b>Tarix · Super admin</b>\n\nArizalar, obunalar va o‘quvchi profillarini boshqaring.", {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [
      [{ text: "📥 Yangi arizalar", callback_data: "sub:list:pending:0" }],
      [{ text: "💳 Faol obunalar", callback_data: "sub:list:paid:0" }, { text: "⏳ 7 kunda tugaydi", callback_data: "sub:list:soon:0" }],
      [{ text: "🎓 Markaz o‘quvchilari", callback_data: "sub:list:center:0" }],
      [{ text: "🔎 Foydalanuvchini qidirish", callback_data: "sub:search" }],
    ] },
  });
}

async function showSearchResults(chatId: number, input: string) {
  const words = input.replace(/^@/, "").match(/[\p{L}\p{N}_’'-]+/gu) ?? [];
  const filters: Record<string, string> = { is_active: "eq.true", limit: "10", order: "first_name.asc,last_name.asc" };
  if (/^\d+$/.test(input) && Number.isSafeInteger(Number(input))) {
    filters.telegram_user_id = `eq.${input}`;
  } else if (words.length >= 2) {
    filters.first_name = `ilike.*${words[0]}*`;
    filters.last_name = `ilike.*${words.slice(1).join(" ")}*`;
  } else if (words[0]) {
    const term = words[0];
    filters.or = `(first_name.ilike.*${term}*,last_name.ilike.*${term}*,telegram_username.ilike.*${term}*)`;
  } else {
    await sendMessage(chatId, "Qidiruv uchun ism, @username yoki Telegram ID yozing.", { reply_markup: { inline_keyboard: [[backButton]] } });
    return;
  }
  const users = await dbSelect<HistoryUser>("history_users", filters);
  await sendMessage(chatId, users.length ? "🔎 <b>Qidiruv natijalari</b>\nProfilni tanlang." : "🔎 Foydalanuvchi topilmadi.", {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [
      ...users.map((user) => [{ text: `${user.first_name} ${user.last_name} · ${user.telegram_user_id}`, callback_data: `sub:profile:${user.telegram_user_id}` }]),
      [{ text: "🔎 Qayta qidirish", callback_data: "sub:search" }, backButton],
    ] },
  });
}

export async function handleSubscriptionAdmin(update: any, isCallback: boolean) {
  const chat = isCallback ? update?.message?.chat : update?.chat;
  if (chat?.type !== "private") return false;

  const userId = Number(update?.from?.id);
  const input = String(isCallback ? update?.data : update?.text ?? "").trim();
  const command = /^\/admin(?:\s+(\d+))?$/.exec(input);
  const isSearchReply = !isCallback && !!input && !input.startsWith("/")
    && getEnv().ADMIN_TELEGRAM_IDS.has(String(userId))
    && (await getAdminState(userId)).payload.subscriptionSearch === true;
  if (isCallback ? !input.startsWith("sub:") : !command && !isSearchReply) return false;

  const { isSuperAdmin } = await getAdminAccess(userId, getEnv().ADMIN_TELEGRAM_IDS);
  if (!isSuperAdmin) {
    if (isCallback) await answerCallbackQuery(update.id, "Bu amal faqat super adminlar uchun.");
    else await sendMessage(chat.id, "Bu bo‘lim faqat super adminlar uchun.");
    return true;
  }

  if (!isCallback) {
    await setAdminState(userId, "idle");
    if (isSearchReply) await showSearchResults(chat.id, input);
    else if (command?.[1]) {
      if (!await showRequest(chat.id, Number(command[1]))) await sendMessage(chat.id, "Foydalanuvchi topilmadi.");
    } else await showAdminMenu(chat.id);
    return true;
  }

  if (input === "sub:menu" || input === "sub:search") {
    await answerCallbackQuery(update.id, "");
    await setAdminState(userId, "idle", input === "sub:search" ? { subscriptionSearch: true } : {});
    if (input === "sub:menu") await showAdminMenu(chat.id);
    else await sendMessage(chat.id, "🔎 Ism-familiya, @username yoki Telegram ID yuboring.", {
      reply_markup: { inline_keyboard: [[{ ...backButton, text: "Bekor qilish" }]] },
    });
    return true;
  }
  const profile = /^sub:profile:(\d+)$/.exec(input);
  if (profile) {
    await answerCallbackQuery(update.id, "");
    if (!await showRequest(chat.id, Number(profile[1]))) await sendMessage(chat.id, "Foydalanuvchi topilmadi.");
    return true;
  }
  const list = /^sub:list:(pending|paid|soon|center):(\d+)$/.exec(input);
  if (list) {
    await answerCallbackQuery(update.id, "");
    const [, section, page] = list;
    const offset = Number(page);
    const now = new Date();
    const expires = section === "soon"
      ? { and: `(expires_at.gt.${now.toISOString()},expires_at.lte.${new Date(now.getTime() + 7 * 86400000).toISOString()})` }
      : section === "paid" ? { expires_at: `gt.${now.toISOString()}` } : {};
    const rows = await dbSelect<Subscription>(table, {
      status: `eq.${section === "soon" ? "paid" : section}`,
      order: section === "paid" || section === "soon" ? "expires_at.asc,telegram_user_id.asc" : "requested_at.asc,telegram_user_id.asc",
      offset: String(offset), limit: "6", ...expires,
    });
    const labels: Record<string, string> = { pending: "📥 Yangi arizalar", paid: "💳 Faol obunalar", soon: "⏳ 7 kunda tugaydigan obunalar", center: "🎓 Markaz o‘quvchilari" };
    const cards = await Promise.all(rows.slice(0, 5).map((row) => getHistoryUser(row.telegram_user_id)));
    const visible = cards.filter((user): user is HistoryUser => !!user);
    await sendMessage(chat.id, `<b>${labels[section]}</b>\n\n${visible.length ? "Profilni tanlang." : "Bu sahifada faol profil yo‘q."}`, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [
        ...visible.map((user) => [{ text: `${user.first_name} ${user.last_name}`, callback_data: `sub:profile:${user.telegram_user_id}` }]),
        ...(offset > 0 ? [[{ text: "⬅️ Oldingi", callback_data: `sub:list:${section}:${Math.max(0, offset - 5)}` }]] : []),
        ...(rows.length > 5 ? [[{ text: "Keyingi ➡️", callback_data: `sub:list:${section}:${offset + 5}` }]] : []),
        [backButton],
      ] },
    });
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
