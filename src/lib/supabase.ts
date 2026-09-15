import { getEnv } from "../config/env.ts";

export class DatabaseError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.status = status;
    this.detail = detail;
  }
}

function headers(prefer?: string): Record<string, string> {
  const env = getEnv();
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function buildUrl(table: string, query: Record<string, string> = {}): string {
  const env = getEnv();
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new DatabaseError(body?.message || `Database request failed (${response.status})`, response.status, body);
  }
  return body;
}

export async function dbSelect<T>(table: string, query: Record<string, string> = {}): Promise<T[]> {
  const response = await fetch(buildUrl(table, { select: "*", ...query }), { headers: headers() });
  return parseResponse(response);
}

export async function dbInsert<T>(table: string, row: Record<string, unknown> | Record<string, unknown>[]): Promise<T[]> {
  const response = await fetch(buildUrl(table), {
    method: "POST",
    headers: headers("return=representation"),
    body: JSON.stringify(row),
  });
  return parseResponse(response);
}

export async function dbUpsert<T>(table: string, row: Record<string, unknown>, onConflict: string): Promise<T[]> {
  const response = await fetch(buildUrl(table, { on_conflict: onConflict }), {
    method: "POST",
    headers: headers("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify(row),
  });
  return parseResponse(response);
}

export async function dbUpdate<T>(table: string, query: Record<string, string>, patch: Record<string, unknown>): Promise<T[]> {
  const response = await fetch(buildUrl(table, query), {
    method: "PATCH",
    headers: headers("return=representation"),
    body: JSON.stringify(patch),
  });
  return parseResponse(response);
}

export async function dbDelete(table: string, query: Record<string, string>): Promise<void> {
  const response = await fetch(buildUrl(table, query), { method: "DELETE", headers: headers() });
  await parseResponse(response);
}
