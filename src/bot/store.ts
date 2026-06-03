import type { BotAction } from "./flows";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type SessionState = {
  action: BotAction;
  stepIndex: number;
  values: Record<string, unknown>;
};

const sessions = new Map<number, SessionState>();
const memorySubmissions: Array<{
  action: BotAction;
  telegramUserId: number;
  payload: Record<string, unknown>;
}> = [];

export function getSession(chatId: number) {
  return sessions.get(chatId);
}

export function setSession(chatId: number, state: SessionState) {
  sessions.set(chatId, state);
}

export function clearSession(chatId: number) {
  sessions.delete(chatId);
}

export async function saveBotSubmission(
  action: BotAction,
  telegramUserId: number,
  values: Record<string, unknown>
) {
  const supabase = await createSupabaseAdminClient();
  const payload = {
    ...buildPayload(action, values),
    telegram_user_id: telegramUserId,
    source: "telegram"
  };

  if (!supabase) {
    memorySubmissions.push({ action, telegramUserId, payload });
    console.log("[demo-bot-save]", action, payload);
    return { ok: true, demo: true };
  }

  const tableByAction: Record<BotAction, string> = {
    stock_arrival: "stock_arrivals",
    sale_warehouse: "shipments",
    sale_pavilion: "shipments",
    remaining_stock: "remaining_stock_reports",
    defective_write_off: "defective_write_offs",
    expense: "expenses",
    pavilion_delivery: "pavilion_delivery_reports",
    cooler_info: "coolers"
  };

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
  const { error } = await supabase.from(tableByAction[action]).insert(cleanPayload);
  if (error) throw error;
  return { ok: true, demo: false };
}

function moscowDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildPayload(action: BotAction, values: Record<string, unknown>) {
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

  if (action === "expense") {
    return { ...values, expense_date: today };
  }

  if (action === "cooler_info") {
    return values;
  }

  return { ...values, report_date: today };
}

export async function getTodayEmployeeSummary(telegramUserId: number) {
  const supabase = await createSupabaseAdminClient();
  const today = moscowDate();
  if (!supabase) {
    return formatDaySummary(today, aggregateMemory(telegramUserId, today), true);
  }

  const [shipments, expenses, arrivals, remains, defects] = await Promise.all([
    supabase.from("shipments").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today),
    supabase.from("expenses").select("*").eq("telegram_user_id", telegramUserId).eq("expense_date", today),
    supabase.from("stock_arrivals").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today),
    supabase.from("remaining_stock_reports").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today),
    supabase.from("defective_write_offs").select("*").eq("telegram_user_id", telegramUserId).eq("report_date", today)
  ]);

  const summary = aggregateRows({
    shipments: shipments.data ?? [],
    expenses: expenses.data ?? [],
    arrivals: arrivals.data ?? [],
    remains: remains.data ?? [],
    defects: defects.data ?? []
  });

  return formatDaySummary(today, summary, false);
}

function aggregateMemory(telegramUserId: number, today: string) {
  const rows = memorySubmissions
    .filter((item) => item.telegramUserId === telegramUserId)
    .map((item) => item.payload);

  return aggregateRows({
    shipments: rows.filter((row) => row.report_date === today && row.quantity_sold !== undefined),
    expenses: rows.filter((row) => row.expense_date === today && row.amount !== undefined),
    arrivals: rows.filter((row) => row.report_date === today && row.quantity_received !== undefined),
    remains: rows.filter((row) => row.report_date === today && row.remaining_quantity !== undefined),
    defects: rows.filter((row) => row.report_date === today && row.defective_quantity !== undefined)
  });
}

function aggregateRows(data: {
  shipments: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  arrivals: Record<string, unknown>[];
  remains: Record<string, unknown>[];
  defects: Record<string, unknown>[];
}) {
  const warehouseSales = data.shipments.filter((row) => row.sale_channel === "warehouse");
  const pavilionSales = data.shipments.filter((row) => row.sale_channel === "pavilion");

  return {
    warehouseSold: sum(warehouseSales, "quantity_sold"),
    warehouseCash: sum(warehouseSales, "cash_amount"),
    pavilionSold: sum(pavilionSales, "quantity_sold"),
    pavilionCollected: sum(pavilionSales, "quantity_returned"),
    pavilionCash: sum(pavilionSales, "cash_amount"),
    totalSold: sum(data.shipments, "quantity_sold"),
    cash: sum(data.shipments, "cash_amount"),
    expenseTotal: sum(data.expenses, "amount"),
    defectiveTotal: sum(data.defects, "defective_quantity"),
    received: sum(data.arrivals, "quantity_received"),
    purchaseTotal: sum(data.arrivals, "purchase_amount"),
    remaining: sum(data.remains, "remaining_quantity"),
    expenseCount: data.expenses.length
  };
}

function sum(rows: Record<string, unknown>[], field: string) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

function formatDaySummary(
  today: string,
  summary: ReturnType<typeof aggregateRows>,
  demo: boolean
) {
  return [
    `Итог смены за ${today} (Москва)${demo ? " - демо-режим" : ""}`,
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
