import { createHash } from "node:crypto";

export type RuntimeEnv = {
  TELEGRAM_BOT_TOKEN: string;
  ADMIN_TELEGRAM_IDS: Set<string>;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  SETUP_SECRET: string;
  WEB_APP_URL: string;
};

export function parseAdminIds(value: string): Set<string> {
  return new Set(value.split(",").map((v) => v.trim()).filter(Boolean));
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string {
  return process.env[name]?.trim() || "";
}

function deriveWebhookSecret(botToken: string): string {
  return createHash("sha256").update(botToken).digest("hex");
}

export function getEnv(): RuntimeEnv {
  const botToken = required("TELEGRAM_BOT_TOKEN");
  return {
    TELEGRAM_BOT_TOKEN: botToken,
    ADMIN_TELEGRAM_IDS: parseAdminIds(required("ADMIN_TELEGRAM_IDS")),
    SUPABASE_URL: required("SUPABASE_URL").replace(/\/$/, ""),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    TELEGRAM_WEBHOOK_SECRET: optional("TELEGRAM_WEBHOOK_SECRET") || deriveWebhookSecret(botToken),
    SETUP_SECRET: optional("SETUP_SECRET"),
    WEB_APP_URL: (optional("WEB_APP_URL") || "https://ark-tarix-web-app.vercel.app").replace(/\/$/, ""),
  };
}
