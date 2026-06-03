import type { DashboardData } from "./types";

export const demoData: DashboardData = {
  generatedAt: new Date().toISOString(),
  date: new Date().toISOString().slice(0, 10),
  employees: [
    { id: "emp-1", full_name: "Али Мамедов", phone: "+994 50 111 22 33", telegram_user_id: 10001, is_active: true },
    { id: "emp-2", full_name: "Рашад Гусейнов", phone: "+994 55 444 55 66", telegram_user_id: 10002, is_active: true },
    { id: "emp-3", full_name: "Нариман Алиев", phone: "+994 70 777 88 99", telegram_user_id: null, is_active: true }
  ],
  products: [
    { id: "prod-19", name: "Вода 19 л", unit: "бутыль", bottle_volume_liters: 19 },
    { id: "prod-5", name: "Вода 5 л", unit: "бутылка", bottle_volume_liters: 5 }
  ],
  warehouses: [
    { id: "wh-main", name: "Основной склад", kind: "warehouse" },
    { id: "wh-van-1", name: "Машина 1", kind: "vehicle" }
  ],
  pavilions: [
    { id: "pav-12", code: "P-12", name: "Павильон 12", address: "Рынок, ряд 3", is_active: true },
    { id: "pav-18", code: "P-18", name: "Павильон 18", address: "Центр", is_active: true },
    { id: "pav-27", code: "P-27", name: "Павильон 27", address: "Автовокзал", is_active: true }
  ],
  stockArrivals: [
    { id: "arr-1", date: "today", warehouse_name: "Основной склад", product_name: "Вода 19 л", quantity_received: 180, purchase_unit_price: 5, purchase_amount: 900, payment_type: "transfer" },
    { id: "arr-2", date: "today", warehouse_name: "Основной склад", product_name: "Вода 5 л", quantity_received: 90, purchase_unit_price: 115, purchase_amount: 10350, payment_type: "cash" }
  ],
  shipments: [
    { id: "ship-1", employee_name: "Али Мамедов", sale_channel: "pavilion", destination_name: "P-12", pavilion_code: "P-12", product_name: "Вода 19 л", quantity_delivered: 45, quantity_returned: 8, quantity_sold: 45, unit_price: 300, cash_amount: 13500, comments: "Все принято" },
    { id: "ship-2", employee_name: "Рашад Гусейнов", sale_channel: "warehouse", destination_name: "Фудсити", warehouse_name: "Фудсити", product_name: "Вода 19 л", quantity_delivered: 30, quantity_returned: 0, quantity_sold: 30, unit_price: 250, cash_amount: 7500, comments: "Продажа на склад" },
    { id: "ship-3", employee_name: "Али Мамедов", sale_channel: "pavilion", destination_name: "P-27", pavilion_code: "P-27", product_name: "Вода 19 л", quantity_delivered: 22, quantity_returned: 3, quantity_sold: 22, unit_price: 300, cash_amount: 6600, comments: "" }
  ],
  remainingStock: [
    { id: "rem-1", warehouse_name: "Основной склад", product_name: "Вода 19 л", remaining_quantity: 106 },
    { id: "rem-2", warehouse_name: "Машина 1", product_name: "Вода 19 л", remaining_quantity: 14 }
  ],
  defectiveWriteOffs: [
    { id: "def-1", report_date: "today", employee_name: "Али Мамедов", warehouse_name: "Машина 1", product_name: "Вода 19 л", defective_quantity: 3, reason: "Трещина / течь", comment: "Обнаружено при возврате с P-12" },
    { id: "def-2", report_date: "today", employee_name: "Рашад Гусейнов", warehouse_name: "Основной склад", product_name: "Вода 5 л", defective_quantity: 2, reason: "Повреждена крышка", comment: "Списать со склада" }
  ],
  expenses: [
    { id: "exp-1", employee_name: "Али Мамедов", category: "fuel", amount: 35, payment_type: "cash", comment: "Бензин" },
    { id: "exp-2", employee_name: "Рашад Гусейнов", category: "parking", amount: 6, payment_type: "cash", comment: "Парковка у рынка" }
  ],
  pavilionReports: [
    { id: "rep-1", pavilion_code: "P-12", bottles_delivered: 45, bottles_collected: 8, notes: "Нужно привезти стаканы" },
    { id: "rep-2", pavilion_code: "P-18", bottles_delivered: 30, bottles_collected: 6, notes: "Проверить витрину" }
  ],
  coolers: [
    { id: "cool-1", pavilion_code: "P-12", status: "our_cooler", comment: "Кулер наш, исправен" },
    { id: "cool-2", pavilion_code: "P-18", status: "not_our_cooler", comment: "Кулер клиента" },
    { id: "cool-3", pavilion_code: "P-27", status: "our_cooler", comment: "Нужна чистка" }
  ],
  totals: {
    received: 270,
    delivered: 97,
    returned: 11,
    sold: 97,
    expenses: 41,
    cashSales: 27600,
    cashExpected: 27559,
    remaining: 120,
    defective: 5,
    ourCoolers: 2,
    discrepancies: 1
  },
  discrepancies: [
    "Наличность: продажи 27600, расходы наличными 41. Ожидаемый остаток 27559."
  ]
};
