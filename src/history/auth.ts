export function isAdmin(userId: number, adminIds: Set<string>): boolean {
  return adminIds.has(String(userId));
}
