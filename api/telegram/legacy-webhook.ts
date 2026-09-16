import { getEnv } from "../../src/config/env.ts";
import { getAdminAccess, addAdmin, deactivateAdmin, listAdmins, type AdminAccess } from "../../src/history/admin-service.ts";
import { decodeAdminCallback, encodeAdminCallback } from "../../src/history/callbacks.ts";
import { getAdminState, setAdminState } from "../../src/history/admin-state.ts";
import { archiveQuiz, createQuizFromText, getQuiz, getQuizQuestions, listManageQuizzes, updateQuizTime } from "../../src/history/quiz-service.ts";
import { listGroups, registerGroup } from "../../src/history/group-service.ts";
import { handlePollClosed, startSession, submitPollAnswer } from "../../src/history/session-engine.ts";
import { getResultDetail, listRecentResults } from "../../src/history/result-service.ts";
import { getAdminStats } from "../../src/history/stats-service.ts";
import { ALLOWED_QUIZ_TIMES, getSettings, toggleShuffleOptions, toggleShuffleQuestions, updateDefaultTime } from "../../src/history/settings-service.ts";
import { adminPanelMenu, adminPanelText, escapeHtml, inlineKeyboard, settingsText, welcomeMenu, welcomeText } from "../../src/history/ui.ts";
import { answerCallbackQuery, sendMessage } from "../../src/lib/telegram.ts";
import { QuizParseError } from "../../src/history/parser.ts";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("uz-UZ", {
      timeZone: "Asia/Tashkent",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function sendWelcome(chatId: number, firstName: string | undefined, access: AdminAccess) {
  return sendMessage(chatId, welcomeText(firstName), { parse_mode: "HTML", ...welcomeMenu(access.isAdmin) });
}

async function showAdminPanel(chatId: number, access: AdminAccess) {
  if (!access.isAdmin) return sendMessage(chatId, "⛔️ Admin panelga kirish uchun ruxsat yo‘q.");
  return sendMessage(chatId, adminPanelText(access.isSuperAdmin ? "super_admin" : "admin"), {
    parse_mode: "HTML",
    ...adminPanelMenu(access.isSuperAdmin),
  });
}

async function showQuizPreview(chatId: number, quizId: number) {
  const quiz = await getQuiz(quizId);
  if (!quiz || quiz.status === "archived") return sendMessage(chatId, "Quiz topilmadi.");
  return sendMessage(chatId,
    `✅ <b>TEST TAYYOR</b>\n\n📘 ${escapeHtml(quiz.title)}\n❓ ${quiz.question_count} ta savol\n⏱ ${quiz.default_time_limit} soniya\n🔀 Savollar: ${quiz.shuffle_questions ? "ON" : "OFF"}\n🔁 Variantlar: ${quiz.shuffle_options ? "ON" : "OFF"}`,
    { parse_mode: "HTML", ...inlineKeyboard([
      [{ text: "👁 Savollarni ko‘rish", callback_data: encodeAdminCallback("preview", quizId) }],
      [{ text: "👥 Guruhni tanlash", callback_data: encodeAdminCallback("groups", quizId) }],
      [{ text: "⏱ Vaqtni o‘zgartirish", callback_data: encodeAdminCallback("times", quizId) }],
      [{ text: "🗑 Testni o‘chirish", callback_data: encodeAdminCallback("delete_confirm", quizId) }],
      [{ text: "⬅️ Testlar", callback_data: "panel:quizzes" }, { text: "⚙️ Admin panel", callback_data: "panel:home" }],
    ]) });
}

async function showManageQuizzes(chatId: number) {
  const quizzes = await listManageQuizzes(20);
  if (!quizzes.length) {
    return sendMessage(chatId, "📚 Hali test yaratilmagan.", inlineKeyboard([
      [{ text: "➕ Test qo‘shish", callback_data: "panel:newquiz" }],
      [{ text: "⬅️ Admin panel", callback_data: "panel:home" }],
    ]));
  }
  const rows = quizzes.map((q) => [{
    text: `📘 ${q.title} · ${q.question_count} savol`,
    callback_data: encodeAdminCallback("open", q.id),
  }]);
  rows.push([{ text: "➕ Test qo‘shish", callback_data: "panel:newquiz" }]);
  rows.push([{ text: "⬅️ Admin panel", callback_data: "panel:home" }]);
  return sendMessage(chatId, `📚 <b>TESTLAR</b>\n\nJami ko‘rsatilmoqda: ${quizzes.length}\nTestni boshqarish uchun tanlang 👇`, {
    parse_mode: "HTML",
    ...inlineKeyboard(rows),
  });
}

async function showChooseGroups(chatId: number, quizId: number) {
  const groups = await listGroups();
  if (!groups.length) {
    return sendMessage(chatId, "Hali guruh ro‘yxatdan o‘tmagan. Botni guruhga qo‘shib, guruh ichida /registergroup yuboring.", inlineKeyboard([
      [{ text: "⬅️ Testga qaytish", callback_data: encodeAdminCallback("open", quizId) }],
    ]));
  }
  const rows = groups.map((g) => [{ text: `👥 ${g.title}`, callback_data: encodeAdminCallback("group", quizId, String(g.id)) }]);
  rows.push([{ text: "⬅️ Testga qaytish", callback_data: encodeAdminCallback("open", quizId) }]);
  return sendMessage(chatId, "👥 Quiz qaysi guruhda boshlansin?", inlineKeyboard(rows));
}

async function showGroupsPanel(chatId: number) {
  const groups = await listGroups();
  const body = groups.length
    ? groups.map((g, i) => `${i + 1}. ${escapeHtml(g.title)} <code>${g.telegram_chat_id}</code>`).join("\n")
    : "Hali guruh ro‘yxatdan o‘tmagan.";
  return sendMessage(chatId, `👥 <b>GURUHLAR</b>\n\n${body}\n\n➕ Yangi guruh: botni guruhga qo‘shing va /registergroup yuboring.`, {
    parse_mode: "HTML",
    ...inlineKeyboard([[{ text: "⬅️ Admin panel", callback_data: "panel:home" }]]),
  });
}

async function showTimes(chatId: number, quizId: number) {
  return sendMessage(chatId, "⏱ Har bir savol uchun vaqtni tanlang:", inlineKeyboard([
    ALLOWED_QUIZ_TIMES.slice(0, 3).map((n) => ({ text: `${n}s`, callback_data: encodeAdminCallback("time", quizId, String(n)) })),
    ALLOWED_QUIZ_TIMES.slice(3).map((n) => ({ text: `${n}s`, callback_data: encodeAdminCallback("time", quizId, String(n)) })),
    [{ text: "⬅️ Testga qaytish", callback_data: encodeAdminCallback("open", quizId) }],
  ]));
}

async function showResults(chatId: number) {
  const results = await listRecentResults(10);
  if (!results.length) {
    return sendMessage(chatId, "🏆 Hali yakunlangan quiz natijalari yo‘q.", inlineKeyboard([
      [{ text: "⬅️ Admin panel", callback_data: "panel:home" }],
    ]));
  }
  const rows = results.map((row) => [{
    text: `🏆 ${row.quizTitle} · ${row.groupTitle} · ${row.participantCount}`,
    callback_data: `panel:result:${row.sessionId}`,
  }]);
  rows.push([{ text: "⬅️ Admin panel", callback_data: "panel:home" }]);
  return sendMessage(chatId, "🏆 <b>NATIJALAR</b>\n\nSo‘nggi yakunlangan quizlar:", { parse_mode: "HTML", ...inlineKeyboard(rows) });
}

async function showResultDetail(chatId: number, sessionId: number) {
  const detail = await getResultDetail(sessionId);
  if (!detail) return sendMessage(chatId, "Natija topilmadi.");
  const leaderboard = detail.leaderboard.slice(0, 10).map((row, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${row.rank}.`;
    return `${medal} ${escapeHtml(row.displayName)} — <b>${row.score}</b> · ✅ ${row.correctCount} · ❌ ${row.wrongCount}`;
  }).join("\n");
  return sendMessage(chatId, [
    "🏆 <b>QUIZ NATIJASI</b>",
    "",
    `📚 ${escapeHtml(detail.quizTitle)}`,
    `👥 ${escapeHtml(detail.groupTitle)}`,
    `📅 ${escapeHtml(formatDate(detail.endedAt))}`,
    `👤 ${detail.participantCount} ishtirokchi`,
    "",
    leaderboard || "Natija yo‘q.",
    "",
    "💾 Natija bazada saqlangan.",
  ].join("\n"), {
    parse_mode: "HTML",
    ...inlineKeyboard([
      [{ text: "⬅️ Natijalar", callback_data: "panel:results" }],
      [{ text: "⚙️ Admin panel", callback_data: "panel:home" }],
    ]),
  });
}

async function showStats(chatId: number) {
  const stats = await getAdminStats();
  return sendMessage(chatId, [
    "📊 <b>UMUMIY STATISTIKA</b>",
    "",
    `📚 Faol testlar: <b>${stats.totalQuizzes}</b>`,
    `👥 Guruhlar: <b>${stats.totalGroups}</b>`,
    `🏁 Yakunlangan quizlar: <b>${stats.completedSessions}</b>`,
    `👤 Unikal o‘quvchilar: <b>${stats.uniquePlayers}</b>`,
    `✅ Saqlangan javoblar: <b>${stats.storedAnswers}</b>`,
  ].join("\n"), {
    parse_mode: "HTML",
    ...inlineKeyboard([[{ text: "⬅️ Admin panel", callback_data: "panel:home" }]]),
  });
}

async function showAdmins(chatId: number, access: AdminAccess, superAdminIds: Set<string>) {
  const admins = await listAdmins(superAdminIds);
  const lines = admins.map((row, i) => {
    const icon = row.is_super_admin ? "👑" : "🛡";
    const label = row.display_name ? `${escapeHtml(row.display_name)} · ` : "";
    return `${i + 1}. ${icon} ${label}<code>${row.telegram_user_id}</code>`;
  }).join("\n");
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (access.isSuperAdmin) {
    rows.push([{ text: "➕ Admin qo‘shish", callback_data: "panel:add-admin" }]);
    for (const row of admins.filter((item) => !item.is_super_admin)) {
      rows.push([{ text: `➖ ${row.display_name || row.telegram_user_id}`, callback_data: `panel:admin-remove:${row.telegram_user_id}` }]);
    }
  }
  rows.push([{ text: "⬅️ Admin panel", callback_data: "panel:home" }]);
  const note = access.isSuperAdmin ? "Adminlarni qo‘shish yoki olib tashlash mumkin." : "Adminlarni faqat Super Admin o‘zgartira oladi.";
  return sendMessage(chatId, `👑 <b>ADMINLAR</b>\n\n${lines || "Dynamic adminlar yo‘q."}\n\n${note}`, {
    parse_mode: "HTML",
    ...inlineKeyboard(rows),
  });
}

async function showSettings(chatId: number) {
  const settings = await getSettings();
  const timeButtons = ALLOWED_QUIZ_TIMES.map((n) => ({
    text: `${settings.defaultTimeLimit === n ? "✅ " : ""}${n}s`,
    callback_data: `panel:settings-time:${n}`,
  }));
  return sendMessage(chatId, settingsText(settings), {
    parse_mode: "HTML",
    ...inlineKeyboard([
      timeButtons.slice(0, 3),
      timeButtons.slice(3),
      [{ text: `🔀 Savollar ${settings.shuffleQuestions ? "ON ✅" : "OFF"}`, callback_data: "panel:settings-toggleq" }],
      [{ text: `🔁 Variantlar ${settings.shuffleOptions ? "ON ✅" : "OFF"}`, callback_data: "panel:settings-toggleo" }],
      [{ text: "⬅️ Admin panel", callback_data: "panel:home" }],
    ]),
  });
}

async function showPublicAbout(chatId: number) {
  return sendMessage(chatId, [
    "ℹ️ <b>ARK TARIX QUIZ BOT</b>",
    "",
    "🏛 Tarix fanidan guruh quizlarini tez va tartibli o‘tkazish uchun yaratilgan.",
    "⚡ Har savol vaqt bilan beriladi.",
    "🏆 Quiz tugaganda guruh leaderboardi chiqadi.",
    "💾 Natijalar bazada saqlanadi.",
  ].join("\n"), { parse_mode: "HTML", ...inlineKeyboard([[{ text: "🏠 Bosh menyu", callback_data: "public:home" }]]) });
}

async function showPublicQuizInfo(chatId: number) {
  return sendMessage(chatId, "📚 Quizlar admin tomonidan Telegram guruhida boshlanadi. Quiz boshlanganida savollar shu guruhning o‘zida chiqadi.", inlineKeyboard([
    [{ text: "🏠 Bosh menyu", callback_data: "public:home" }],
  ]));
}

async function promptNewQuiz(chatId: number, userId: number) {
  await setAdminState(userId, "awaiting_quiz");
  return sendMessage(chatId, [
    "➕ <b>YANGI TEST</b>",
    "",
    "Test matnini quyidagi formatda yuboring:",
    "",
    "<code>Quiz: Amir Temur\n\n1. Amir Temur qachon tug‘ilgan?\nA) 1336\nB) 1338\nC) 1340\nD) 1342\nJavob: A</code>",
  ].join("\n"), { parse_mode: "HTML" });
}

async function handleMessage(message: any, access: AdminAccess, superAdminIds: Set<string>) {
  const text = String(message.text || "").trim();
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return;

  if (message.chat.type === "private" && text.startsWith("/id")) {
    return sendMessage(chatId, `🆔 Sizning Telegram ID: <code>${userId}</code>`, { parse_mode: "HTML" });
  }

  if (text.startsWith("/registergroup")) {
    if (!access.isAdmin) return sendMessage(chatId, "⛔️ Bu buyruq faqat admin uchun.");
    if (!["group", "supergroup"].includes(message.chat.type)) return sendMessage(chatId, "Bu buyruqni Telegram guruh ichida yuboring.");
    const group = await registerGroup(chatId, message.chat.title || `Guruh ${chatId}`);
    return sendMessage(chatId, `✅ Guruh ro‘yxatdan o‘tdi: <b>${escapeHtml(group.title)}</b>`, { parse_mode: "HTML" });
  }

  if (message.chat.type === "private" && text.startsWith("/start")) {
    if (access.isAdmin) await setAdminState(userId, "idle");
    return sendWelcome(chatId, message.from?.first_name, access);
  }

  if (text.startsWith("/admin")) {
    if (!access.isAdmin) return sendMessage(chatId, "⛔️ Sizda admin panelga kirish huquqi yo‘q.");
    if (message.chat.type !== "private") return sendMessage(chatId, "🔒 Admin panelni bot bilan shaxsiy chatda oching.");
    await setAdminState(userId, "idle");
    return showAdminPanel(chatId, access);
  }

  if (!access.isAdmin) return;

  if (text.startsWith("/newquiz") || text.toLowerCase() === "quiz") return promptNewQuiz(chatId, userId);
  if (text.startsWith("/groups")) return showGroupsPanel(chatId);
  if (text.startsWith("/quizzes")) return showManageQuizzes(chatId);

  const state = await getAdminState(userId);

  if (state.state === "awaiting_admin_id") {
    if (!access.isSuperAdmin) {
      await setAdminState(userId, "idle");
      return sendMessage(chatId, "⛔️ Admin qo‘shishni faqat Super Admin bajaradi.");
    }
    if (!/^\d{5,20}$/.test(text)) {
      return sendMessage(chatId, "❌ Telegram ID faqat raqamlardan iborat bo‘lishi kerak. Masalan: <code>123456789</code>\n\nBekor qilish: /admin", { parse_mode: "HTML" });
    }
    const newAdminId = Number(text);
    if (superAdminIds.has(String(newAdminId))) {
      await setAdminState(userId, "idle");
      return sendMessage(chatId, "👑 Bu foydalanuvchi allaqachon Super Admin.");
    }
    await addAdmin(newAdminId, userId);
    await setAdminState(userId, "idle");
    await sendMessage(chatId, `✅ Admin qo‘shildi: <code>${newAdminId}</code>`, { parse_mode: "HTML" });
    return showAdmins(chatId, access, superAdminIds);
  }

  if ((state.state === "awaiting_quiz" || /^quiz\s*:/i.test(text)) && message.chat.type === "private" && text) {
    try {
      const quiz = await createQuizFromText(text, userId);
      await setAdminState(userId, "preview", { quizId: quiz.id });
      return showQuizPreview(chatId, quiz.id);
    } catch (error) {
      const messageText = error instanceof QuizParseError ? error.message : "Quizni saqlashda xatolik yuz berdi.";
      return sendMessage(chatId, `❌ ${escapeHtml(messageText)}\n\nFormatni tuzatib qayta yuboring.`, { parse_mode: "HTML" });
    }
  }
}

async function handleCallback(callback: any, access: AdminAccess, superAdminIds: Set<string>) {
  const data = String(callback.data || "");
  const chatId = callback.message?.chat?.id;
  const userId = callback.from?.id;
  if (!chatId || !userId) return;

  if (data === "public:home") {
    await answerCallbackQuery(callback.id);
    return sendWelcome(chatId, callback.from?.first_name, access);
  }
  if (data === "public:about") {
    await answerCallbackQuery(callback.id);
    return showPublicAbout(chatId);
  }
  if (data === "public:quizzes") {
    await answerCallbackQuery(callback.id);
    return showPublicQuizInfo(chatId);
  }

  if (!access.isAdmin) return answerCallbackQuery(callback.id, "Bu amal faqat admin uchun.");
  await answerCallbackQuery(callback.id);

  if (data === "panel:home") return showAdminPanel(chatId, access);
  if (data === "panel:main") return sendWelcome(chatId, callback.from?.first_name, access);
  if (data === "panel:newquiz" || data === "cmd:newquiz") return promptNewQuiz(chatId, userId);
  if (data === "panel:quizzes" || data === "cmd:quizzes") return showManageQuizzes(chatId);
  if (data === "panel:groups" || data === "cmd:groups") return showGroupsPanel(chatId);
  if (data === "panel:results") return showResults(chatId);
  if (data === "panel:stats") return showStats(chatId);
  if (data === "panel:admins") return showAdmins(chatId, access, superAdminIds);
  if (data === "panel:settings") return showSettings(chatId);

  if (data === "panel:add-admin") {
    if (!access.isSuperAdmin) return sendMessage(chatId, "⛔️ Admin qo‘shishni faqat Super Admin bajaradi.");
    await setAdminState(userId, "awaiting_admin_id");
    return sendMessage(chatId, "➕ <b>ADMIN QO‘SHISH</b>\n\nYangi adminning Telegram ID raqamini yuboring.\n\nU o‘z ID sini botga /id yuborib bilishi mumkin.", { parse_mode: "HTML" });
  }

  if (data.startsWith("panel:admin-remove-confirm:")) {
    if (!access.isSuperAdmin) return sendMessage(chatId, "⛔️ Bu amal faqat Super Admin uchun.");
    const targetId = Number(data.split(":").pop());
    await deactivateAdmin(targetId, superAdminIds);
    await sendMessage(chatId, `✅ Admin olib tashlandi: <code>${targetId}</code>`, { parse_mode: "HTML" });
    return showAdmins(chatId, access, superAdminIds);
  }

  if (data.startsWith("panel:admin-remove:")) {
    if (!access.isSuperAdmin) return sendMessage(chatId, "⛔️ Bu amal faqat Super Admin uchun.");
    const targetId = Number(data.split(":").pop());
    return sendMessage(chatId, `⚠️ <code>${targetId}</code> adminlikdan olib tashlansinmi?`, {
      parse_mode: "HTML",
      ...inlineKeyboard([
        [{ text: "✅ Ha, olib tashlash", callback_data: `panel:admin-remove-confirm:${targetId}` }],
        [{ text: "❌ Bekor qilish", callback_data: "panel:admins" }],
      ]),
    });
  }

  if (data.startsWith("panel:result:")) {
    const sessionId = Number(data.split(":").pop());
    return showResultDetail(chatId, sessionId);
  }

  if (data.startsWith("panel:settings-time:")) {
    const seconds = Number(data.split(":").pop());
    await updateDefaultTime(seconds, userId);
    await sendMessage(chatId, `✅ Standart vaqt ${seconds}s qilindi.`);
    return showSettings(chatId);
  }
  if (data === "panel:settings-toggleq") {
    await toggleShuffleQuestions(userId);
    return showSettings(chatId);
  }
  if (data === "panel:settings-toggleo") {
    await toggleShuffleOptions(userId);
    return showSettings(chatId);
  }

  const parsed = decodeAdminCallback(data);
  if (!parsed) return sendMessage(chatId, "Noma’lum amal.");

  if (parsed.action === "open") return showQuizPreview(chatId, parsed.quizId);
  if (parsed.action === "preview") {
    const questions = await getQuizQuestions(parsed.quizId);
    const text = questions.map((q) => `${q.position}. ${q.question_text}\nA) ${q.option_a}\nB) ${q.option_b}\nC) ${q.option_c}\nD) ${q.option_d}\n✅ ${q.correct_option}`).join("\n\n");
    for (let i = 0; i < text.length; i += 3800) await sendMessage(chatId, text.slice(i, i + 3800));
    return sendMessage(chatId, "⬅️ Testga qaytish", inlineKeyboard([[{ text: "📘 Test", callback_data: encodeAdminCallback("open", parsed.quizId) }]]));
  }
  if (parsed.action === "groups") return showChooseGroups(chatId, parsed.quizId);
  if (parsed.action === "times") return showTimes(chatId, parsed.quizId);
  if (parsed.action === "time") {
    const seconds = Number(parsed.arg);
    await updateQuizTime(parsed.quizId, seconds);
    await sendMessage(chatId, `✅ Vaqt ${seconds} soniyaga o‘zgartirildi.`);
    return showQuizPreview(chatId, parsed.quizId);
  }
  if (parsed.action === "group") {
    const groupId = Number(parsed.arg);
    const quiz = await getQuiz(parsed.quizId);
    const groups = await listGroups();
    const group = groups.find((g) => Number(g.id) === groupId);
    if (!quiz || !group) return sendMessage(chatId, "Quiz yoki guruh topilmadi.");
    return sendMessage(chatId, `✅ <b>BOSHLASHGA TAYYOR</b>\n\n👥 ${escapeHtml(group.title)}\n📘 ${escapeHtml(quiz.title)}\n⏱ ${quiz.default_time_limit}s`, {
      parse_mode: "HTML",
      ...inlineKeyboard([
        [{ text: "🚀 Guruhda boshlash", callback_data: encodeAdminCallback("start", parsed.quizId, String(groupId)) }],
        [{ text: "⬅️ Boshqa guruh", callback_data: encodeAdminCallback("groups", parsed.quizId) }],
      ]),
    });
  }
  if (parsed.action === "start") {
    const groupId = Number(parsed.arg);
    try {
      const session = await startSession(parsed.quizId, groupId, userId);
      return sendMessage(chatId, `🚀 Quiz guruhda boshlandi.\nSession: <code>#${session.id}</code>`, { parse_mode: "HTML", ...inlineKeyboard([[{ text: "⚙️ Admin panel", callback_data: "panel:home" }]]) });
    } catch (error: any) {
      return sendMessage(chatId, `❌ ${escapeHtml(error?.message || "Quizni boshlashda xatolik.")}`, { parse_mode: "HTML" });
    }
  }
  if (parsed.action === "delete_confirm") {
    const quiz = await getQuiz(parsed.quizId);
    if (!quiz) return sendMessage(chatId, "Quiz topilmadi.");
    return sendMessage(chatId, `🗑 <b>TESTNI O‘CHIRISH</b>\n\n📘 ${escapeHtml(quiz.title)}\n\n⚠️ Test ro‘yxatdan olib tashlanadi, lekin eski quiz natijalari bazada saqlanib qoladi.`, {
      parse_mode: "HTML",
      ...inlineKeyboard([
        [{ text: "✅ Ha, o‘chirish", callback_data: encodeAdminCallback("delete_yes", parsed.quizId) }],
        [{ text: "❌ Bekor qilish", callback_data: encodeAdminCallback("open", parsed.quizId) }],
      ]),
    });
  }
  if (parsed.action === "delete_yes") {
    await archiveQuiz(parsed.quizId);
    await setAdminState(userId, "idle");
    await sendMessage(chatId, "✅ Test o‘chirildi. Eski natijalar saqlanib qoldi.");
    return showManageQuizzes(chatId);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  try {
    const env = getEnv();
    const secret = String(req.headers["x-telegram-bot-api-secret-token"] || "");
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) return res.status(401).json({ ok: false });
    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (update?.message) {
      const userId = update.message.from?.id;
      const access = userId ? await getAdminAccess(userId, env.ADMIN_TELEGRAM_IDS) : { isAdmin: false, isSuperAdmin: false, role: "user" as const };
      await handleMessage(update.message, access, env.ADMIN_TELEGRAM_IDS);
    } else if (update?.callback_query) {
      const userId = update.callback_query.from?.id;
      const access = userId ? await getAdminAccess(userId, env.ADMIN_TELEGRAM_IDS) : { isAdmin: false, isSuperAdmin: false, role: "user" as const };
      await handleCallback(update.callback_query, access, env.ADMIN_TELEGRAM_IDS);
    } else if (update?.poll_answer) {
      await submitPollAnswer(update.poll_answer.poll_id, update.poll_answer.user, update.poll_answer.option_ids || []);
    } else if (update?.poll?.is_closed) {
      await handlePollClosed(update.poll.id);
    }
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("webhook_error", error?.message || error, error?.stack || "");
    return res.status(200).json({ ok: false, handled: true });
  }
}
