import { config } from "dotenv";

config({ path: ".env.local" });
config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

const apiBase = `https://api.telegram.org/bot${token}`;
const sessions = new Map();
const memorySubmissions = [];

const mainMenu = [
  ["🏬 Продажа на склад", "🏪 Продажа на павильон"],
  ["➕ Приход товара", "📦 Остаток"],
  ["🚫 Брак / списание", "💸 Расход"],
  ["🏪 Отчет по павильону", "❄️ Кулер"],
  ["✅ Завершить смену"]
];

const actionByButton = {
  "➕ Приход товара": "stock_arrival",
  "🏬 Продажа на склад": "sale_warehouse",
  "🏪 Продажа на павильон": "sale_pavilion",
  "📦 Остаток": "remaining_stock",
  "🚫 Брак / списание": "defective_write_off",
  "💸 Расход": "expense",
  "🏪 Отчет по павильону": "pavilion_delivery",
  "❄️ Кулер": "cooler_info",
  "✅ Завершить смену": "finish_shift"
};

const flowLabels = {
  stock_arrival: "Приход товара",
  sale_warehouse: "Продажа на склад",
  sale_pavilion: "Продажа на павильон",
  remaining_stock: "Остаток",
  defective_write_off: "Брак / списание",
  expense: "Расход",
  pavilion_delivery: "Отчет по павильону",
  cooler_info: "Информация о кулере"
};

const flows = {
  stock_arrival: [
    { key: "warehouse_name", question: "Склад / локация?", type: "text" },
    { key: "quantity_received", question: "Сколько получили бутылок 19 л?", type: "number" },
    { key: "payment_type", question: "Тип закупки?", type: "choice", choices: ["Безнал", "Наличные"] }
  ],
  sale_warehouse: [
    { key: "destination_name", question: "На какой склад / клиент?", type: "text" },
    { key: "quantity_delivered", question: "Сколько бутылок 19 л продано? Цена фиксированная: 250 руб.", type: "number" }
  ],
  sale_pavilion: [
    { key: "pavilion_code", question: "Номер павильона?", type: "text" },
    { key: "quantity_delivered", question: "Сколько бутылок 19 л продано / оставлено? Цена фиксированная: 300 руб.", type: "number" },
    { key: "quantity_returned", question: "Сколько бутылок забрал обратно?", type: "number" }
  ],
  remaining_stock: [
    { key: "warehouse_name", question: "Склад / машина / локация?", type: "text" },
    { key: "remaining_quantity", question: "Фактический остаток бутылок 19 л?", type: "number" }
  ],
  defective_write_off: [
    { key: "warehouse_name", question: "Где найден брак? Склад / машина / павильон.", type: "text" },
    { key: "defective_quantity", question: "Сколько бутылок 19 л списать как брак?", type: "number" },
    { key: "reason", question: "Причина брака?", type: "choice", choices: ["Трещина / течь", "Повреждена крышка", "Грязная бутыль", "Истек срок", "Другое"] },
    { key: "comment", question: "Комментарий? Если нет, напишите -", type: "text" }
  ],
  expense: [
    { key: "category", question: "Категория расхода?", type: "choice", choices: ["Топливо", "Парковка", "Зарплата", "Другое"] },
    { key: "amount", question: "Сумма расхода?", type: "number" },
    { key: "payment_type", question: "Тип оплаты?", type: "choice", choices: ["Наличные", "Карта", "Безнал"] },
    { key: "comment", question: "Комментарий? Если нет, напишите -", type: "text" }
  ],
  pavilion_delivery: [
    { key: "pavilion_code", question: "Павильон / ID точки?", type: "text" },
    { key: "bottles_delivered", question: "Сколько бутылок продано / передано?", type: "number" },
    { key: "notes", question: "Заметки? Если нет, напишите -", type: "text" }
  ],
  cooler_info: [
    { key: "pavilion_code", question: "Павильон / ID точки?", type: "text" },
    { key: "status", question: "Статус кулера?", type: "choice", choices: ["Наш кулер", "Не наш кулер"] },
    { key: "comment", question: "Комментарий? Если нет, напишите -", type: "text" }
  ]
};

const fieldLabels = {
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
  notes: "Заметки",
  telegram_user_id: "Telegram ID",
  source: "Источник"
};

const valueLabels = {
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
  },
  source: {
    telegram: "Telegram"
  }
};

const me = await telegram("getMe", {});
console.log(`Water Ops Telegram bot connected: @${me.result.username ?? me.result.first_name}`);
console.log("Polling mode is running. Send /start to the bot in Telegram.");

let offset = 0;
let stopped = false;
process.once("SIGINT", () => {
  stopped = true;
});
process.once("SIGTERM", () => {
  stopped = true;
});

while (!stopped) {
  let response;
  try {
    response = await telegram("getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["message"]
    });
  } catch (error) {
    console.error("[telegram-polling-error]", error.message);
    await sleep(2000);
    continue;
  }

  for (const update of response.result ?? []) {
    offset = update.update_id + 1;
    if (update.message?.text) {
      await handleMessage(update.message);
    }
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start") {
    sessions.delete(chatId);
    await sendMessage(chatId, "Здравствуйте. Выберите действие для отчета по воде.", mainKeyboard());
    return;
  }

  const menuAction = actionByButton[text];
  if (menuAction) {
    if (menuAction === "finish_shift") {
      await sendMessage(chatId, await getTodayEmployeeSummary(message.from.id), mainKeyboard());
      return;
    }

    const firstStep = flows[menuAction][0];
    sessions.set(chatId, { action: menuAction, stepIndex: 0, values: {} });
    await sendMessage(chatId, `Начинаем: ${flowLabels[menuAction]}.\n${firstStep.question}`, stepKeyboard(firstStep.choices));
    return;
  }

  const session = sessions.get(chatId);
  if (!session) {
    await sendMessage(chatId, "Выберите действие кнопкой ниже.", mainKeyboard());
    return;
  }

  const step = flows[session.action][session.stepIndex];
  const value = normalizeValue(step, text);
  if (step.type === "number" && Number.isNaN(value)) {
    await sendMessage(chatId, "Пожалуйста, отправьте число. Например: 25");
    return;
  }

  const nextState = {
    ...session,
    stepIndex: session.stepIndex + 1,
    values: { ...session.values, [step.key]: value }
  };

  const nextStep = flows[session.action][nextState.stepIndex];
  if (nextStep) {
    sessions.set(chatId, nextState);
    await sendMessage(chatId, nextStep.question, stepKeyboard(nextStep.choices));
    return;
  }

  await saveBotSubmission(session.action, message.from.id, nextState.values);
  sessions.delete(chatId);
  await sendMessage(
    chatId,
    `Сохранено: ${flowLabels[session.action]}.\n\n${formatSubmission(buildPayload(session.action, nextState.values))}`,
    mainKeyboard()
  );
}

async function telegram(method, body) {
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(`${apiBase}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1000 * attempt);
    }
  }
  const json = await response.json();
  if (!json.ok) throw new Error(json.description ?? `Telegram ${method} failed`);
  return json;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendMessage(chatId, text, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup
  });
}

function mainKeyboard() {
  return { keyboard: mainMenu, resize_keyboard: true };
}

function stepKeyboard(choices) {
  if (!choices?.length) return { remove_keyboard: true };
  return { keyboard: choices.map((choice) => [choice]), resize_keyboard: true, one_time_keyboard: true };
}

function normalizeValue(step, raw) {
  const value = raw.trim();
  const lower = value.toLowerCase();
  if (step.type === "number") return Number(value.replace(",", "."));
  if (step.key === "payment_type") {
    if (["наличные", "наличка", "cash"].includes(lower)) return "cash";
    if (["карта", "card"].includes(lower)) return "card";
    if (["безнал", "transfer"].includes(lower)) return "transfer";
  }
  if (step.key === "category") {
    const categories = {
      топливо: "fuel",
      бензин: "fuel",
      fuel: "fuel",
      парковка: "parking",
      parking: "parking",
      зарплата: "salary",
      salary: "salary",
      другое: "other",
      other: "other"
    };
    if (categories[lower]) return categories[lower];
  }
  if (step.key === "status") {
    if (["наш кулер", "our_cooler"].includes(lower)) return "our_cooler";
    if (["не наш кулер", "not_our_cooler"].includes(lower)) return "not_our_cooler";
  }
  return value === "-" ? "" : value;
}

function moscowDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildPayload(action, values) {
  const today = moscowDate();

  if (action === "sale_warehouse" || action === "sale_pavilion") {
    const unitPrice = action === "sale_warehouse" ? 250 : 300;
    const quantity = Number(values.quantity_delivered ?? 0);
    const returned = action === "sale_pavilion" ? Number(values.quantity_returned ?? 0) : 0;
    const destinationName =
      action === "sale_pavilion" ? String(values.pavilion_code ?? "") : String(values.destination_name ?? "");

    return {
      ...values,
      report_date: today,
      sale_channel: action === "sale_warehouse" ? "warehouse" : "pavilion",
      destination_name: destinationName,
      warehouse_name: action === "sale_warehouse" ? destinationName : undefined,
      product_name: "Вода 19 л",
      quantity_returned: returned,
      quantity_sold: quantity,
      unit_price: unitPrice,
      cash_amount: quantity * unitPrice
    };
  }

  if (action === "stock_arrival") {
    const quantity = Number(values.quantity_received ?? 0);
    const paymentType = values.payment_type === "cash" ? "cash" : "transfer";
    const purchaseUnitPrice = paymentType === "cash" ? 115 : 5;

    return {
      ...values,
      report_date: today,
      product_name: "Вода 19 л",
      payment_type: paymentType,
      purchase_unit_price: purchaseUnitPrice,
      purchase_amount: quantity * purchaseUnitPrice
    };
  }

  if (action === "remaining_stock" || action === "defective_write_off") {
    return { ...values, report_date: today, product_name: "Вода 19 л" };
  }

  if (action === "expense") return { ...values, expense_date: today };
  if (action === "cooler_info") return values;
  return { ...values, report_date: today };
}

async function saveBotSubmission(action, telegramUserId, values) {
  const payload = {
    ...buildPayload(action, values),
    telegram_user_id: telegramUserId,
    source: "telegram"
  };

  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    memorySubmissions.push({ action, telegramUserId, payload });
    console.log("[demo-bot-save]", action, payload);
    return;
  }

  const tableByAction = {
    stock_arrival: "stock_arrivals",
    sale_warehouse: "shipments",
    sale_pavilion: "shipments",
    remaining_stock: "remaining_stock_reports",
    defective_write_off: "defective_write_offs",
    expense: "expenses",
    pavilion_delivery: "pavilion_delivery_reports",
    cooler_info: "coolers"
  };

  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const { error } = await supabase.from(tableByAction[action]).insert(cleanPayload);
  if (error) throw error;
}

async function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function getTodayEmployeeSummary(telegramUserId) {
  const today = moscowDate();
  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    return formatDaySummary(today, aggregateMemory(telegramUserId, today), true);
  }

  const [shipments, expenses, defects, arrivals, remains] = await Promise.all([
    supabase.from("shipments").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today),
    supabase.from("expenses").select("*").eq("telegram_user_id", telegramUserId).eq("expense_date", today),
    supabase.from("defective_write_offs").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today),
    supabase.from("stock_arrivals").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today),
    supabase.from("remaining_stock_reports").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today)
  ]);

  const summary = aggregateRows({
    shipments: shipments.data ?? [],
    expenses: expenses.data ?? [],
    defects: defects.data ?? [],
    arrivals: arrivals.data ?? [],
    remains: remains.data ?? []
  });

  return formatDaySummary(today, summary, false);
}

function aggregateMemory(telegramUserId, today) {
  const rows = memorySubmissions
    .filter((item) => item.telegramUserId === telegramUserId)
    .map((item) => item.payload);

  return aggregateRows({
    shipments: rows.filter((row) => row.report_date === today && row.quantity_sold !== undefined),
    expenses: rows.filter((row) => row.expense_date === today && row.amount !== undefined),
    defects: rows.filter((row) => row.report_date === today && row.defective_quantity !== undefined),
    arrivals: rows.filter((row) => row.report_date === today && row.quantity_received !== undefined),
    remains: rows.filter((row) => row.report_date === today && row.remaining_quantity !== undefined)
  });
}

function aggregateRows({ shipments, expenses, defects, arrivals, remains }) {
  const warehouseSales = shipments.filter((row) => row.sale_channel === "warehouse");
  const pavilionSales = shipments.filter((row) => row.sale_channel === "pavilion");

  return {
    warehouseSold: sum(warehouseSales, "quantity_sold"),
    warehouseCash: sum(warehouseSales, "cash_amount"),
    pavilionSold: sum(pavilionSales, "quantity_sold"),
    pavilionCollected: sum(pavilionSales, "quantity_returned"),
    pavilionCash: sum(pavilionSales, "cash_amount"),
    totalSold: sum(shipments, "quantity_sold"),
    cash: sum(shipments, "cash_amount"),
    expenseTotal: sum(expenses, "amount"),
    defectiveTotal: sum(defects, "defective_quantity"),
    received: sum(arrivals, "quantity_received"),
    purchaseTotal: sum(arrivals, "purchase_amount"),
    remaining: sum(remains, "remaining_quantity"),
    shipmentCount: shipments.length,
    expenseCount: expenses.length
  };
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

function formatDaySummary(today, summary, demo) {
  return [
    `Итог смены за ${today} (Москва)${demo ? " — демо-режим" : ""}`,
    `Продажи на склад: ${summary.warehouseSold} шт. / ${summary.warehouseCash} руб.`,
    `Продажи на павильоны: ${summary.pavilionSold} шт. / ${summary.pavilionCash} руб.`,
    `Забрал обратно: ${summary.pavilionCollected} шт.`,
    `Всего продано: ${summary.totalSold} шт. / ${summary.cash} руб.`,
    `Приход: ${summary.received} шт. / закупка ${summary.purchaseTotal} руб.`,
    `Расходы: ${summary.expenseTotal} руб. (${summary.expenseCount} записей)`,
    `Брак / списание: ${summary.defectiveTotal} шт.`,
    `Остатки по отчетам: ${summary.remaining} шт.`,
    `Ожидаемая касса: ${summary.cash - summary.expenseTotal} руб.`
  ].join("\n");
}

function formatSubmission(values) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${fieldLabels[key] ?? key}: ${formatValue(key, value)}`)
    .join("\n");
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === "") return "-";
  const raw = String(value);
  return valueLabels[key]?.[raw] ?? raw;
}
