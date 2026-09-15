import { dbSelect, dbUpsert } from "../lib/supabase.ts";

export async function registerGroup(chatId: number, title: string) {
  const rows = await dbUpsert<any>("history_groups", {
    telegram_chat_id: chatId,
    title,
    is_active: true,
  }, "telegram_chat_id");
  return rows[0];
}

export async function listGroups() {
  return dbSelect<any>("history_groups", { is_active: "eq.true", order: "title.asc" });
}

export async function getGroup(groupId: number) {
  return (await dbSelect<any>("history_groups", { id: `eq.${groupId}`, is_active: "eq.true", limit: "1" }))[0] || null;
}
