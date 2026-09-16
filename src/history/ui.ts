import { getEnv } from "../config/env.ts";
import { buildWebAppMenuButton } from "./web-app-menu.ts";

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } };
export type InlineMarkup = { reply_markup: { inline_keyboard: InlineButton[][] } };

export function inlineKeyboard(rows: InlineButton[][]): InlineMarkup {
  return { reply_markup: { inline_keyboard: rows } };
}

export function escapeHtml(input: string): string {
  return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function welcomeText(firstName?: string | null): string {
  const name = escapeHtml(firstName?.trim() || "do‘st");
  return [
    "🏛 <b>ARK TARIX QUIZ</b>",
    "",
    `👋 Xush kelibsiz, <b>${name}</b>!`,
    "",
    "Tarix bo‘yicha testlar, natijalar va reytingni ilova ichida ko‘rishingiz mumkin.",
    "",
    "Pastdagi <b>🚀 Ilovani ochish</b> tugmasi orqali ilovaga kiring 👇",
  ].join("\n");
}

export function welcomeMenu(_isAdmin: boolean, webAppUrl?: string): InlineMarkup {
  const button = buildWebAppMenuButton(webAppUrl || getEnv().WEB_APP_URL);
  return inlineKeyboard([[
    { text: button.text, web_app: button.web_app },
  ]]);
}

export function adminPanelMenu(isSuperAdmin: boolean): InlineMarkup {
  const rows: InlineButton[][] = [
    [
      { text: "➕ Test qo‘shish", callback_data: "panel:newquiz" },
      { text: "📚 Testlar", callback_data: "panel:quizzes" },
    ],
    [
      { text: "👥 Guruhlar", callback_data: "panel:groups" },
      { text: "🏆 Natijalar", callback_data: "panel:results" },
    ],
    [
      { text: "📊 Statistika", callback_data: "panel:stats" },
      { text: "👑 Adminlar", callback_data: "panel:admins" },
    ],
    [{ text: "⚙️ Sozlamalar", callback_data: "panel:settings" }],
    [{ text: "🏠 Bosh menyu", callback_data: "panel:main" }],
  ];
  void isSuperAdmin;
  return inlineKeyboard(rows);
}

export function adminPanelText(role: "super_admin" | "admin"): string {
  return [
    "⚙️ <b>ADMIN PANEL</b>",
    "",
    role === "super_admin" ? "👑 Huquq: Super Admin" : "🛡 Huquq: Admin",
    "",
    "Kerakli bo‘limni tanlang 👇",
  ].join("\n");
}

export function settingsText(settings: { defaultTimeLimit: number; shuffleQuestions: boolean; shuffleOptions: boolean }): string {
  return [
    "⚙️ <b>QUIZ SOZLAMALARI</b>",
    "",
    `⏱ Standart vaqt: <b>${settings.defaultTimeLimit}s</b>`,
    `🔀 Savollar aralash: <b>${settings.shuffleQuestions ? "ON" : "OFF"}</b>`,
    `🔁 Variantlar aralash: <b>${settings.shuffleOptions ? "ON" : "OFF"}</b>`,
    "",
    "Bu sozlamalar yangi yaratiladigan testlarga qo‘llanadi.",
  ].join("\n");
}

export function formatCompletedQuizMessage(input: {
  quizTitle: string;
  groupTitle: string;
  participantCount: number;
  ranked: Array<{ rank: number; displayName: string; score: number }>;
}): string {
  const medals = ["🥇", "🥈", "🥉"];
  const lines = input.ranked.slice(0, 10).map((row, index) => {
    const prefix = medals[index] || `${row.rank}.`;
    return `${prefix} ${escapeHtml(row.displayName)} — <b>${row.score}</b> ball`;
  });
  return [
    "🏁 <b>QUIZ YAKUNLANDI!</b>",
    "",
    `📚 ${escapeHtml(input.quizTitle)}`,
    `👥 ${escapeHtml(input.groupTitle)}`,
    `👤 ${input.participantCount} ishtirokchi`,
    "",
    lines.join("\n") || "Hali hech kim javob bermadi.",
    "",
    "💾 Natijalar bazaga saqlandi.",
  ].join("\n");
}
