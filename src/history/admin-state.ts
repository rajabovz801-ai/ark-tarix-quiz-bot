import { dbSelect, dbUpsert } from "../lib/supabase.ts";

export type AdminState =
  | "idle"
  | "awaiting_quiz"
  | "preview"
  | "choosing_group"
  | "choosing_time"
  | "awaiting_admin_id"
  | "awaiting_first_name"
  | "awaiting_last_name"
  | "awaiting_confirmation";

export async function getAdminState(telegramUserId: number): Promise<{ state: AdminState; payload: Record<string, unknown> }> {
  const rows = await dbSelect<any>("history_bot_state", { telegram_user_id: `eq.${telegramUserId}`, limit: "1" });
  if (!rows[0]) return { state: "idle", payload: {} };
  return { state: rows[0].state as AdminState, payload: rows[0].payload_json || {} };
}

export async function setAdminState(telegramUserId: number, state: AdminState, payload: Record<string, unknown> = {}) {
  await dbUpsert("history_bot_state", {
    telegram_user_id: telegramUserId,
    state,
    payload_json: payload,
    updated_at: new Date().toISOString(),
  }, "telegram_user_id");
}
