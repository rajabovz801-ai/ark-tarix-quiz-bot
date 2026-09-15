export type RuntimeEnv = {
  TELEGRAM_BOT_TOKEN: string;
  ADMIN_TELEGRAM_IDS: Set<string>;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  SETUP_SECRET: string;
};

export function parseAdminIds(value: string): Set<string> {
  return new Set(value.split(",").map((v) => v.trim()).filter(Boolean));
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getEnv(): RuntimeEnv {
  return {
    TELEGRAM_BOT_TOKEN: required("TELEGRAM_BOT_TOKEN"),
    ADMIN_TELEGRAM_IDS: parseAdminIds(required("ADMIN_TELEGRAM_IDS")),
    SUPABASE_URL: required("SUPABASE_URL").replace(/\/$/, ""),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    TELEGRAM_WEBHOOK_SECRET: required("TELEGRAM_WEBHOOK_SECRET"),
    SETUP_SECRET: required("SETUP_SECRET"),
  };
}
