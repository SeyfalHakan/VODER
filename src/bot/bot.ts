import { Telegraf, Markup, type Context } from "telegraf";
import { actionByButton, flowLabels, flows, mainMenu, normalizeValue, type BotAction } from "./flows";
import { clearSession, getSession, getTodayEmployeeSummary, saveBotSubmission, setSession } from "./store";

export function createWaterOpsBot(token: string) {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    clearSession(ctx.chat.id);
    await ctx.reply("Здравствуйте. Выберите действие для отчета по воде.", mainKeyboard());
  });

  bot.hears(Object.keys(actionByButton), async (ctx) => {
    const action = actionByButton[ctx.message.text];
    if (action === "finish_shift") {
      const summary = await getTodayEmployeeSummary(ctx.from.id);
      await ctx.reply(summary, mainKeyboard());
      return;
    }

    startFlow(ctx, action);
  });

  bot.on("text", async (ctx) => {
    const session = getSession(ctx.chat.id);
    if (!session) {
      await ctx.reply("Выберите действие кнопкой ниже.", mainKeyboard());
      return;
    }

    const step = flows[session.action][session.stepIndex];
    const value = normalizeValue(step, ctx.message.text);
    if (step.type === "number" && Number.isNaN(value)) {
      await ctx.reply("Пожалуйста, отправьте число. Например: 25");
      return;
    }

    const nextState = {
      ...session,
      stepIndex: session.stepIndex + 1,
      values: { ...session.values, [step.key]: value }
    };

    const nextStep = flows[session.action][nextState.stepIndex];
    if (nextStep) {
      setSession(ctx.chat.id, nextState);
      await ctx.reply(nextStep.question, stepKeyboard(nextStep.choices));
      return;
    }

    await saveBotSubmission(session.action, ctx.from.id, nextState.values);
    clearSession(ctx.chat.id);
    await ctx.reply(`Сохранено: ${flowLabels[session.action]}.\n\n${formatSubmission(nextState.values)}`, mainKeyboard());
  });

  return bot;
}

function startFlow(ctx: Context, action: BotAction) {
  if (!ctx.chat) return;
  const firstStep = flows[action][0];
  setSession(ctx.chat.id, { action, stepIndex: 0, values: {} });
  return ctx.reply(`Начинаем: ${flowLabels[action]}.\n${firstStep.question}`, stepKeyboard(firstStep.choices));
}

function mainKeyboard() {
  return Markup.keyboard(mainMenu).resize();
}

function stepKeyboard(choices?: string[]) {
  if (!choices?.length) return Markup.removeKeyboard();
  return Markup.keyboard(choices.map((choice) => [choice])).resize().oneTime();
}

function formatSubmission(values: Record<string, unknown>) {
  return Object.entries(values)
    .map(([key, value]) => `${fieldLabels[key] ?? key}: ${formatValue(key, value)}`)
    .join("\n");
}

const fieldLabels: Record<string, string> = {
  report_date: "Дата",
  expense_date: "Дата",
  sale_channel: "Тип продажи",
  destination_name: "Куда",
  warehouse_name: "Склад / локация",
  pavilion_code: "Павильон",
  product_name: "Товар",
  quantity_received: "Получено",
  quantity_delivered: "Продано",
  quantity_returned: "Забрал обратно",
  quantity_sold: "Итого продано",
  remaining_quantity: "Остаток",
  defective_quantity: "Брак",
  bottles_delivered: "Продано / передано",
  bottles_collected: "Забрал обратно",
  unit_price: "Цена",
  purchase_unit_price: "Цена закупки",
  cash_amount: "Сумма",
  purchase_amount: "Сумма закупки",
  amount: "Сумма",
  payment_type: "Оплата",
  category: "Категория",
  reason: "Причина",
  status: "Статус",
  comments: "Комментарий",
  comment: "Комментарий",
  notes: "Заметки"
};

const valueLabels: Record<string, Record<string, string>> = {
  sale_channel: {
    warehouse: "Склад",
    pavilion: "Павильон"
  },
  payment_type: {
    cash: "Наличные",
    card: "Карта",
    transfer: "Безнал"
  },
  category: {
    fuel: "Топливо",
    parking: "Парковка",
    salary: "Зарплата",
    other: "Другое"
  },
  status: {
    our_cooler: "Наш кулер",
    not_our_cooler: "Не наш кулер"
  }
};

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const raw = String(value);
  return valueLabels[key]?.[raw] ?? raw;
}
