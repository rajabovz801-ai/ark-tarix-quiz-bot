export type InlineButton = { text: string; callback_data: string };
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
    "🏛 <b>ARK TARIX QUIZ BOT</b>",
    "",
    `👋 Xush kelibsiz, <b>${name}</b>!`,
    "",
    "📚 Bu bot orqali tarix fanidan interaktiv quizlar guruhlarda o‘tkaziladi.",
    "⚡ Tezkor savollar  •  🏆 Reyting  •  📊 Natijalar",
    "",
    "Quyidagi menyudan kerakli bo‘limni tanlang 👇",
  ].join("\n");
}

export function welcomeMenu(isAdmin: boolean): InlineMarkup {
  const rows: InlineButton[][] = [
    [
      { text: "📚 Quizlar", callback_data: "public:quizzes" },
      { text: "ℹ️ Bot haqida", callback_data: "public:about" },
    ],
  ];
  if (isAdmin) rows.push([{ text: "⚙️ Admin panel", callback_data: "panel:home" }]);
  return inlineKeyboard(rows);
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
