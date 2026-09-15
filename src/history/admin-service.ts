import { dbSelect, dbUpdate, dbUpsert } from "../lib/supabase.ts";

export type AdminRole = "super_admin" | "admin" | "user";
export type AdminAccess = { isAdmin: boolean; isSuperAdmin: boolean; role: AdminRole };

export function resolveAdminRole(userId: number, superAdminIds: Set<string>, dynamicAdminIds: Set<string>): AdminAccess {
  const id = String(userId);
  if (superAdminIds.has(id)) return { isAdmin: true, isSuperAdmin: true, role: "super_admin" };
  if (dynamicAdminIds.has(id)) return { isAdmin: true, isSuperAdmin: false, role: "admin" };
  return { isAdmin: false, isSuperAdmin: false, role: "user" };
}

export async function getAdminAccess(userId: number, superAdminIds: Set<string>): Promise<AdminAccess> {
  if (superAdminIds.has(String(userId))) return { isAdmin: true, isSuperAdmin: true, role: "super_admin" };
  const rows = await dbSelect<any>("history_admins", {
    telegram_user_id: `eq.${userId}`,
    is_active: "eq.true",
    limit: "1",
  });
  if (rows[0]) return { isAdmin: true, isSuperAdmin: false, role: "admin" };
  return { isAdmin: false, isSuperAdmin: false, role: "user" };
}

export async function listAdmins(superAdminIds: Set<string>) {
  const dynamic = await dbSelect<any>("history_admins", { is_active: "eq.true", order: "created_at.asc" });
  const supers = [...superAdminIds].map((telegramUserId) => ({
    telegram_user_id: Number(telegramUserId),
    display_name: null,
    role: "super_admin" as const,
    is_super_admin: true,
  }));
  return [
    ...supers,
    ...dynamic.map((row) => ({ ...row, role: "admin" as const, is_super_admin: false })),
  ];
}

export async function addAdmin(telegramUserId: number, createdBy: number, displayName?: string | null) {
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) throw new Error("Telegram ID noto‘g‘ri.");
  const rows = await dbUpsert<any>("history_admins", {
    telegram_user_id: telegramUserId,
    display_name: displayName?.trim() || null,
    role: "admin",
    created_by: createdBy,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, "telegram_user_id");
  return rows[0];
}

export async function deactivateAdmin(telegramUserId: number, superAdminIds: Set<string>) {
  if (superAdminIds.has(String(telegramUserId))) throw new Error("Super Adminni o‘chirib bo‘lmaydi.");
  const rows = await dbUpdate<any>("history_admins", { telegram_user_id: `eq.${telegramUserId}` }, {
    is_active: false,
    updated_at: new Date().toISOString(),
  });
  if (!rows.length) throw new Error("Admin topilmadi.");
  return rows[0];
}
