export type WebAppMenuButton = {
  type: "web_app";
  text: string;
  web_app: { url: string };
};

export function buildWebAppMenuButton(webAppUrl: string): WebAppMenuButton {
  const normalized = webAppUrl.trim().replace(/\/$/, "");
  if (!normalized.startsWith("https://")) {
    throw new Error("Telegram Web App URL must use HTTPS");
  }
  return {
    type: "web_app",
    text: "🚀 Platformaga kirish",
    web_app: { url: normalized },
  };
}
