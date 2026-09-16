import { dbSelect, dbUpsert } from "../lib/supabase.ts";

export type HistoryUser = {
  id: number;
  telegram_user_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  first_name: string;
  last_name: string;
  is_active: boolean;
  registered_at: string;
  updated_at: string;
};

export function normalizeRegistrationName(input: string): string {
  const compact = String(input || "").trim().replace(/\s+/g, " ");
  if (compact.length < 2) throw new Error("Ism yoki familiya kamida 2 ta belgidan iborat bo‘lishi kerak.");
  if (compact.length > 50) throw new Error("Ism yoki familiya 50 ta belgidan oshmasligi kerak.");
  if (!/\p{L}/u.test(compact)) throw new Error("Ism yoki familiyada harf bo‘lishi kerak.");
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'’ʻ‘-]*$/u.test(compact)) {
    throw new Error("Faqat harflar, bo‘sh joy, apostrof va chiziqcha ishlating.");
  }
  const lower = compact.toLocaleLowerCase("uz-UZ");
  return lower.replace(/(^|[\s-])(\p{L})/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("uz-UZ")}`);
}

export async function getHistoryUser(telegramUserId: number): Promise<HistoryUser | null> {
  const rows = await dbSelect<HistoryUser>("history_users", {
    telegram_user_id: `eq.${telegramUserId}`,
    is_active: "eq.true",
    limit: "1",
  });
  return rows[0] || null;
}

export async function upsertHistoryUser(input: {
  telegramUserId: number;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  telegramLastName?: string | null;
  firstName: string;
  lastName: string;
}): Promise<HistoryUser> {
  const firstName = normalizeRegistrationName(input.firstName);
  const lastName = normalizeRegistrationName(input.lastName);
  const rows = await dbUpsert<HistoryUser>("history_users", {
    telegram_user_id: input.telegramUserId,
    telegram_username: input.telegramUsername?.trim() || null,
    telegram_first_name: input.telegramFirstName?.trim() || null,
    telegram_last_name: input.telegramLastName?.trim() || null,
    first_name: firstName,
    last_name: lastName,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, "telegram_user_id");
  if (!rows[0]) throw new Error("Foydalanuvchini saqlab bo‘lmadi.");
  return rows[0];
}
