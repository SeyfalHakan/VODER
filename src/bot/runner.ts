import { config } from "dotenv";
import { createWaterOpsBot } from "./bot";

config({ path: ".env.local" });
config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

const bot = createWaterOpsBot(token);

let isRunning = false;

async function main() {
  const me = await bot.telegram.getMe();
  console.log(`Water Ops Telegram bot connected: @${me.username ?? me.first_name}`);
  console.log("Polling mode is starting. Send /start to the bot in Telegram.");
  isRunning = true;
  await bot.launch();
}

main()
  .then(() => {
    isRunning = false;
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

process.once("SIGINT", () => {
  if (isRunning) bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  if (isRunning) bot.stop("SIGTERM");
});
