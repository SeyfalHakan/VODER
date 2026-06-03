import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = process.env.TELEGRAM_WEBHOOK_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !url) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_URL first");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message"]
    })
  });

  const body = await response.json();
  console.log(body);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
