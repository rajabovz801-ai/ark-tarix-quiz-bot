import { getEnv } from "../../src/config/env.ts";
import { isAdmin } from "../../src/history/auth.ts";
import { decodeAdminCallback, encodeAdminCallback } from "../../src/history/callbacks.ts";
import { getAdminState, setAdminState } from "../../src/history/admin-state.ts";
import { archiveQuiz, createQuizFromText, getQuiz, getQuizQuestions, listRecentQuizzes, updateQuizTime } from "../../src/history/quiz-service.ts";
import { listGroups, registerGroup } from "../../src/history/group-service.ts";
import { handlePollClosed, startSession, submitPollAnswer } from "../../src/history/session-engine.ts";
import { answerCallbackQuery, sendMessage } from "../../src/lib/telegram.ts";
import { QuizParseError } from "../../src/history/parser.ts";

function inlineKeyboard(rows: Array<Array<{ text: string; callback_data: string }>>) {
  return { reply_markup: { inline_keyboard: rows } };
}

function mainMenu() {
  return inlineKeyboard([
    [{ text: "➕ Yangi quiz", callback_data: "cmd:newquiz" }],
    [{ text: "📚 Quizlar", callback_data: "cmd:quizzes" }, { text: "👥 Guruhlar", callback_data: "cmd:groups" }],
  ]);
}

async function showQuizPreview(chatId: number, quizId: number) {
  const quiz = await getQuiz(quizId);
  if (!quiz) return sendMessage(chatId, "Quiz topilmadi.");
  return sendMessage(chatId,
    `✅ Quiz tayyor\n\n📘 ${quiz.title}\n❓ ${quiz.question_count} ta savol\n⏱ ${quiz.default_time_limit} soniya`,
    inlineKeyboard([
      [{ text: "👁 Savollarni ko‘rish", callback_data: encodeAdminCallback("preview", quizId) }],
      [{ text: "👥 Guruhni tanlash", callback_data: encodeAdminCallback("groups", quizId) }],
      [{ text: "⏱ Vaqt", callback_data: encodeAdminCallback("times", quizId) }],
      [{ text: "🗑 Bekor qilish", callback_data: encodeAdminCallback("cancel", quizId) }],
    ]));
}

async function showGroups(chatId: number, quizId: number) {
  const groups = await listGroups();
  if (!groups.length) {
    return sendMessage(chatId, "Hali guruh ro‘yxatdan o‘tmagan. Botni guruhga qo‘shing va guruh ichida /registergroup yuboring.");
  }
  const rows = groups.map((g) => [{ text: `👥 ${g.title}`, callback_data: encodeAdminCallback("group", quizId, String(g.id)) }]);
  return sendMessage(chatId, "Quiz qaysi guruhda boshlansin?", inlineKeyboard(rows));
}

async function showTimes(chatId: number, quizId: number) {
  const values = [10, 15, 20, 30, 45, 60];
  return sendMessage(chatId, "Har bir savol uchun vaqtni tanlang:", inlineKeyboard([
    values.slice(0, 3).map((n) => ({ text: `${n}s`, callback_data: encodeAdminCallback("time", quizId, String(n)) })),
    values.slice(3).map((n) => ({ text: `${n}s`, callback_data: encodeAdminCallback("time", quizId, String(n)) })),
  ]));
}

async function handleAdminCommand(message: any, admin: boolean) {
  const text = String(message.text || "").trim();
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return;

  if (text.startsWith("/registergroup")) {
    if (!admin) return sendMessage(chatId, "Bu buyruq faqat admin uchun.");
    if (!["group", "supergroup"].includes(message.chat.type)) return sendMessage(chatId, "Bu buyruqni Telegram guruh ichida yuboring.");
    const group = await registerGroup(chatId, message.chat.title || `Guruh ${chatId}`);
    return sendMessage(chatId, `✅ Guruh ro‘yxatdan o‘tdi: ${group.title}`);
  }

  if (message.chat.type === "private" && text.startsWith("/id")) {
    return sendMessage(chatId, `Sizning Telegram ID: ${userId}`);
  }

  if (!admin) {
    if (message.chat.type === "private" && text.startsWith("/start")) return sendMessage(chatId, "Bu bot ARK tarix quizlari uchun. Quizni guruhda o‘qituvchi boshlaydi.\n\nAdmin ID olish uchun /id yuboring.");
    return;
  }

  if (text.startsWith("/start")) {
    await setAdminState(userId, "idle");
    return sendMessage(chatId, "🏛 ARK Tarix Quiz Bot\n\nQuiz yaratish va guruhda boshlash uchun menyudan foydalaning.", mainMenu());
  }
  if (text.startsWith("/newquiz") || text.toLowerCase() === "quiz") {
    await setAdminState(userId, "awaiting_quiz");
    return sendMessage(chatId, "Quiz matnini yuboring. Format:\n\nQuiz: Mavzu\n\n1. Savol?\nA) ...\nB) ...\nC) ...\nD) ...\nJavob: A");
  }
  if (text.startsWith("/groups")) {
    const groups = await listGroups();
    return sendMessage(chatId, groups.length ? `👥 Guruhlar:\n${groups.map((g, i) => `${i + 1}. ${g.title}`).join("\n")}` : "Hali guruh yo‘q.");
  }
  if (text.startsWith("/quizzes")) {
    const quizzes = await listRecentQuizzes(userId);
    if (!quizzes.length) return sendMessage(chatId, "Hali quiz yaratilmagan.");
    return sendMessage(chatId, "📚 Quizlar:", inlineKeyboard(quizzes.map((q) => [{ text: `${q.title} (${q.question_count})`, callback_data: encodeAdminCallback("open", q.id) }])));
  }

  const state = await getAdminState(userId);
  if ((state.state === "awaiting_quiz" || /^quiz\s*:/i.test(text)) && message.chat.type === "private" && text) {
    try {
      const quiz = await createQuizFromText(text, userId);
      await setAdminState(userId, "preview", { quizId: quiz.id });
      return showQuizPreview(chatId, quiz.id);
    } catch (error) {
      const messageText = error instanceof QuizParseError ? error.message : "Quizni saqlashda xatolik yuz berdi.";
      return sendMessage(chatId, `❌ ${messageText}\n\nFormatni tuzatib qayta yuboring.`);
    }
  }
}

async function handleCallback(callback: any, admin: boolean) {
  const data = String(callback.data || "");
  const chatId = callback.message?.chat?.id;
  const userId = callback.from?.id;
  if (!chatId || !userId) return;
  if (!admin) return answerCallbackQuery(callback.id, "Bu amal faqat admin uchun.");

  if (data === "cmd:newquiz") {
    await setAdminState(userId, "awaiting_quiz");
    await answerCallbackQuery(callback.id);
    return sendMessage(chatId, "Quiz matnini yuboring. Har bir savolda A/B/C/D va Javob: A ko‘rinishi bo‘lsin.");
  }
  if (data === "cmd:groups") {
    await answerCallbackQuery(callback.id);
    const groups = await listGroups();
    return sendMessage(chatId, groups.length ? groups.map((g, i) => `${i + 1}. ${g.title}`).join("\n") : "Hali guruh ro‘yxatdan o‘tmagan.");
  }
  if (data === "cmd:quizzes") {
    await answerCallbackQuery(callback.id);
    const quizzes = await listRecentQuizzes(userId);
    return sendMessage(chatId, quizzes.length ? "Quizni tanlang:" : "Hali quiz yo‘q.", quizzes.length ? inlineKeyboard(quizzes.map((q) => [{ text: `${q.title} (${q.question_count})`, callback_data: encodeAdminCallback("open", q.id) }])) : {});
  }

  const parsed = decodeAdminCallback(data);
  if (!parsed) return answerCallbackQuery(callback.id, "Noma’lum amal.");
  await answerCallbackQuery(callback.id);

  if (parsed.action === "open") return showQuizPreview(chatId, parsed.quizId);
  if (parsed.action === "preview") {
    const questions = await getQuizQuestions(parsed.quizId);
    const text = questions.map((q) => `${q.position}. ${q.question_text}\nA) ${q.option_a}\nB) ${q.option_b}\nC) ${q.option_c}\nD) ${q.option_d}\n✅ ${q.correct_option}`).join("\n\n");
    for (let i = 0; i < text.length; i += 3800) await sendMessage(chatId, text.slice(i, i + 3800));
    return;
  }
  if (parsed.action === "groups") return showGroups(chatId, parsed.quizId);
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
    return sendMessage(chatId, `✅ Guruh: ${group.title}\n📘 Quiz: ${quiz.title}\n⏱ ${quiz.default_time_limit}s\n\nBoshlashga tayyor.`, inlineKeyboard([
      [{ text: "🚀 Guruhda boshlash", callback_data: encodeAdminCallback("start", parsed.quizId, String(groupId)) }],
      [{ text: "⬅️ Boshqa guruh", callback_data: encodeAdminCallback("groups", parsed.quizId) }],
    ]));
  }
  if (parsed.action === "start") {
    const groupId = Number(parsed.arg);
    try {
      const session = await startSession(parsed.quizId, groupId, userId);
      return sendMessage(chatId, `🚀 Quiz guruhda boshlandi. Session #${session.id}`);
    } catch (error: any) {
      return sendMessage(chatId, `❌ ${error?.message || "Quizni boshlashda xatolik."}`);
    }
  }
  if (parsed.action === "cancel") {
    await archiveQuiz(parsed.quizId);
    await setAdminState(userId, "idle");
    return sendMessage(chatId, "🗑 Quiz bekor qilindi.", mainMenu());
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
      const admin = Boolean(update.message.from?.id && isAdmin(update.message.from.id, env.ADMIN_TELEGRAM_IDS));
      await handleAdminCommand(update.message, admin);
    } else if (update?.callback_query) {
      const admin = Boolean(update.callback_query.from?.id && isAdmin(update.callback_query.from.id, env.ADMIN_TELEGRAM_IDS));
      await handleCallback(update.callback_query, admin);
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
