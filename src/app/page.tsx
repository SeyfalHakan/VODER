import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AlertList, DataTable, PageHeader, StatCard } from "@/components/ui";
import { getDashboardData } from "@/lib/data";
import { money, number } from "@/lib/format";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <AppShell active="/">
      <PageHeader
        title="Операционный дашборд"
        description="Ежедневный контроль прихода воды, доставок, продаж, расходов, кассы, остатков, павильонов и кулеров."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted">
            <CalendarDays size={16} />
            Сегодня: {data.date}
          </div>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Приход" value={number.format(data.totals.received)} helper="бутылей/единиц за день" />
          <StatCard title="Продано" value={number.format(data.totals.sold)} helper={`Единиц: ${number.format(data.totals.delivered)}`} />
          <StatCard title="Брак" value={number.format(data.totals.defective)} helper="списано за день" tone={data.totals.defective > 0 ? "warning" : "good"} />
          <StatCard title="Касса" value={money.format(data.totals.cashExpected)} helper={`Продажи ${money.format(data.totals.cashSales)} - расходы ${money.format(data.totals.expenses)}`} />
          <StatCard title="Расхождения" value={data.totals.discrepancies} helper="требуют проверки" tone={data.totals.discrepancies > 0 ? "warning" : "good"} />
        </div>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0 space-y-6">
            <DataTable
              title="Сегодняшние продажи и отгрузки"
              rows={data.shipments}
              columns={[
                { key: "employee_name", label: "Сотрудник" },
                { key: "sale_channel", label: "Тип" },
                { key: "destination_name", label: "Куда" },
                { key: "product_name", label: "Товар" },
                { key: "quantity_delivered", label: "Продано" },
                { key: "quantity_returned", label: "Забрал" },
                { key: "unit_price", label: "Цена" },
                { key: "cash_amount", label: "Сумма" },
                { key: "comments", label: "Комментарий" }
              ]}
            />
            <DataTable
              title="Остатки"
              rows={data.remainingStock}
              columns={[
                { key: "warehouse_name", label: "Локация" },
                { key: "product_name", label: "Товар" },
                { key: "remaining_quantity", label: "Остаток" }
              ]}
            />
            <DataTable
              title="Брак и списание бутылок"
              rows={data.defectiveWriteOffs}
              columns={[
                { key: "employee_name", label: "Сотрудник" },
                { key: "warehouse_name", label: "Локация" },
                { key: "product_name", label: "Товар" },
                { key: "defective_quantity", label: "Списано" },
                { key: "reason", label: "Причина" },
                { key: "comment", label: "Комментарий" }
              ]}
            />
          </div>

          <div className="min-w-0 space-y-6">
            <AlertList items={data.discrepancies} />
            <DataTable
              title="Приход товара"
              rows={data.stockArrivals}
              columns={[
                { key: "warehouse_name", label: "Склад" },
                { key: "product_name", label: "Товар" },
                { key: "quantity_received", label: "Кол-во" },
                { key: "purchase_unit_price", label: "Цена закупки" },
                { key: "purchase_amount", label: "Сумма" },
                { key: "payment_type", label: "Оплата" }
              ]}
            />
            <DataTable
              title="Расходы"
              rows={data.expenses}
              columns={[
                { key: "employee_name", label: "Сотрудник" },
                { key: "category", label: "Категория" },
                { key: "amount", label: "Сумма" },
                { key: "payment_type", label: "Оплата" },
                { key: "comment", label: "Комментарий" }
              ]}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
