export const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

export const number = new Intl.NumberFormat("ru-RU");

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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
  kind: {
    warehouse: "Склад",
    vehicle: "Машина",
    pavilion: "Павильон",
    other: "Другое"
  },
  status: {
    our_cooler: "Наш кулер",
    not_our_cooler: "Не наш кулер"
  }
};

const genericLabels: Record<string, string> = {
  today: "Сегодня",
  warehouse: "Склад",
  pavilion: "Павильон",
  vehicle: "Машина",
  other: "Другое",
  cash: "Наличные",
  card: "Карта",
  transfer: "Безнал",
  fuel: "Топливо",
  parking: "Парковка",
  salary: "Зарплата",
  our_cooler: "Наш кулер",
  not_our_cooler: "Не наш кулер"
};

export function label(value: unknown, key?: string) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Да" : "Нет";

  const raw = String(value);
  if (key && valueLabels[key]?.[raw]) return valueLabels[key][raw];
  return genericLabels[raw] ?? raw;
}
