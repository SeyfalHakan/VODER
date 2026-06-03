export type BotAction =
  | "stock_arrival"
  | "sale_warehouse"
  | "sale_pavilion"
  | "remaining_stock"
  | "defective_write_off"
  | "expense"
  | "pavilion_delivery"
  | "cooler_info";

export type FlowStep = {
  key: string;
  question: string;
  type: "text" | "number" | "date" | "choice";
  choices?: string[];
};

export const mainMenu = [
  ["🏬 Продажа на склад", "🏪 Продажа на павильон"],
  ["➕ Приход товара", "📦 Остаток"],
  ["🚫 Брак / списание", "💸 Расход"],
  ["🏪 Отчет по павильону", "❄️ Кулер"],
  ["✅ Завершить смену"]
];

export const actionByButton: Record<string, BotAction | "finish_shift"> = {
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

export const flowLabels: Record<BotAction, string> = {
  stock_arrival: "Приход товара",
  sale_warehouse: "Продажа на склад",
  sale_pavilion: "Продажа на павильон",
  remaining_stock: "Остаток",
  defective_write_off: "Брак / списание",
  expense: "Расход",
  pavilion_delivery: "Отчет по павильону",
  cooler_info: "Информация о кулере"
};

export const flows: Record<BotAction, FlowStep[]> = {
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

export function normalizeValue(step: FlowStep, raw: string) {
  const value = raw.trim();
  const lower = value.toLowerCase();
  if (step.type === "date") {
    if (["сегодня", "today", "сег"].includes(value.toLowerCase())) {
      return new Date().toISOString().slice(0, 10);
    }
    return value;
  }
  if (step.type === "number") {
    return Number(value.replace(",", "."));
  }
  if (step.key === "payment_type") {
    if (["наличные", "наличка", "cash"].includes(lower)) return "cash";
    if (["карта", "card"].includes(lower)) return "card";
    if (["безнал", "transfer"].includes(lower)) return "transfer";
  }
  if (step.key === "category") {
    const categories: Record<string, string> = {
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
