import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const actualSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (!token) {
    return NextResponse.json({ error: "Missing TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }
  if (expectedSecret && actualSecret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const { createWaterOpsBot } = await import("@/bot/bot");
  const bot = createWaterOpsBot(token);
  await bot.handleUpdate(await request.json());
  return NextResponse.json({ ok: true });
}
