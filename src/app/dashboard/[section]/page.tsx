import { notFound } from "next/navigation";
import { AppShell, sections } from "@/components/app-shell";
import { DataTable, PageHeader, StatCard } from "@/components/ui";
import { getDashboardData } from "@/lib/data";
import { money, number } from "@/lib/format";

const pageConfig = {
  employees: {
    title: "Сотрудники",
    description: "Список сотрудников, привязка Telegram ID и статус активности.",
    rows: "employees",
    columns: [
      { key: "full_name", label: "ФИО" },
      { key: "phone", label: "Телефон" },
      { key: "telegram_user_id", label: "Telegram ID" },
      { key: "is_active", label: "Активен" }
    ]
  },
  warehouses: {
    title: "Склады и локации",
    description: "Основной склад, машины, временные точки хранения и другие локации.",
    rows: "warehouses",
    columns: [
      { key: "name", label: "Название" },
      { key: "kind", label: "Тип" }
    ]
  },
  products: {
    title: "Товары",
    description: "Номенклатура воды и единицы учета.",
    rows: "products",
    columns: [
      { key: "name", label: "Товар" },
      { key: "unit", label: "Единица" },
      { key: "bottle_volume_liters", label: "Литры" }
    ]
  },
  pavilions: {
    title: "Павильоны",
    description: "Точки продаж и доставки, по которым ведутся отчеты и кулеры.",
    rows: "pavilions",
    columns: [
      { key: "code", label: "ID" },
      { key: "name", label: "Название" },
      { key: "address", label: "Адрес" },
      { key: "is_active", label: "Активен" }
    ]
  },
  deliveries: {
    title: "Доставки",
    description: "Продажи сотрудниками: на склад по 250 руб. и на павильон по 300 руб. Доставлено считается проданным.",
    rows: "shipments",
    columns: [
      { key: "employee_name", label: "Сотрудник" },
      { key: "sale_channel", label: "Тип" },
      { key: "destination_name", label: "Куда" },
      { key: "product_name", label: "Товар" },
      { key: "quantity_delivered", label: "Продано" },
      { key: "quantity_returned", label: "Забрал" },
      { key: "unit_price", label: "Цена" },
      { key: "cash_amount", label: "Сумма" },
      { key: "comments", label: "Комментарий" }
    ]
  },
  "stock-arrivals": {
    title: "Приход товара",
    description: "Поступления воды на склад или другую локацию.",
    rows: "stockArrivals",
    columns: [
      { key: "warehouse_name", label: "Локация" },
      { key: "product_name", label: "Товар" },
      { key: "quantity_received", label: "Кол-во" },
      { key: "purchase_unit_price", label: "Цена закупки" },
      { key: "purchase_amount", label: "Сумма закупки" },
      { key: "payment_type", label: "Оплата" }
    ]
  },
  "remaining-stock": {
    title: "Остатки",
    description: "Фактический остаток по складам, машинам и товарам.",
    rows: "remainingStock",
    columns: [
      { key: "warehouse_name", label: "Локация" },
      { key: "product_name", label: "Товар" },
      { key: "remaining_quantity", label: "Остаток" }
    ]
  },
  "defective-write-offs": {
    title: "Брак и списание",
    description: "Бутылки и бутыли, которые нельзя продать или вернуть в оборот: течь, трещина, крышка, грязь, другой брак.",
    rows: "defectiveWriteOffs",
    columns: [
      { key: "employee_name", label: "Сотрудник" },
      { key: "warehouse_name", label: "Локация" },
      { key: "product_name", label: "Товар" },
      { key: "defective_quantity", label: "Списано" },
      { key: "reason", label: "Причина" },
      { key: "comment", label: "Комментарий" }
    ]
  },
  expenses: {
    title: "Расходы",
    description: "Топливо, парковка, зарплата и другие ежедневные расходы.",
    rows: "expenses",
    columns: [
      { key: "employee_name", label: "Сотрудник" },
      { key: "category", label: "Категория" },
      { key: "amount", label: "Сумма" },
      { key: "payment_type", label: "Оплата" },
      { key: "comment", label: "Комментарий" }
    ]
  },
  coolers: {
    title: "Кулеры",
    description: "Реестр кулеров по павильонам: наш кулер или кулер клиента.",
    rows: "coolers",
    columns: [
      { key: "pavilion_code", label: "Павильон" },
      { key: "status", label: "Статус" },
      { key: "comment", label: "Комментарий" }
    ]
  },
  reports: {
    title: "Отчеты",
    description: "Сводка для ежедневного контроля владельца.",
    rows: "pavilionReports",
    columns: [
      { key: "pavilion_code", label: "Павильон" },
      { key: "bottles_delivered", label: "Продано / передано" },
      { key: "bottles_collected", label: "Собрано/возврат" },
      { key: "notes", label: "Заметки" }
    ]
  },
  cash: {
    title: "Касса",
    description: "Расчет ожидаемой наличности за день на основе продаж и расходов.",
    rows: "expenses",
    columns: [
      { key: "employee_name", label: "Сотрудник" },
      { key: "category", label: "Операция" },
      { key: "amount", label: "Сумма" },
      { key: "payment_type", label: "Тип оплаты" },
      { key: "comment", label: "Комментарий" }
    ]
  }
} as const;

type Section = keyof typeof pageConfig;

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: sectionParam } = await params;
  const section = sectionParam as Section;
  const config = pageConfig[section];
  if (!config) notFound();

  const data = await getDashboardData();
  const rows = data[config.rows as keyof typeof data] as Record<string, unknown>[];
  const active = sections.find((item) => item.href.endsWith(section))?.href ?? "/";

  return (
    <AppShell active={active}>
      <PageHeader title={config.title} description={config.description} />
      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        {section === "cash" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard title="Продажи" value={money.format(data.totals.cashSales)} />
            <StatCard title="Расходы" value={money.format(data.totals.expenses)} />
            <StatCard title="Ожидаемая касса" value={money.format(data.totals.cashExpected)} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard title="Записей" value={number.format(rows.length)} />
            <StatCard title="Дата" value={data.date} />
            <StatCard title="MVP режим" value={process.env.SUPABASE_SERVICE_ROLE_KEY ? "База" : "Демо"} />
          </div>
        )}
        <DataTable title={config.title} rows={rows} columns={[...config.columns]} />
      </div>
    </AppShell>
  );
}
