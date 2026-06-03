import { createSupabaseAdminClient } from "./supabase";
import { demoData } from "./mock-data";
import type { DashboardData } from "./types";

const tableNames = {
  employees: "employees",
  products: "products",
  warehouses: "warehouses",
  pavilions: "pavilions",
  stockArrivals: "stock_arrivals",
  shipments: "shipments",
  remainingStock: "remaining_stock_reports",
  defectiveWriteOffs: "defective_write_offs",
  expenses: "expenses",
  pavilionReports: "pavilion_delivery_reports",
  coolers: "coolers"
} as const;

export async function getDashboardData(date = moscowDate()): Promise<DashboardData> {
  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    return { ...demoData, date, generatedAt: new Date().toISOString() };
  }

  const [
    employees,
    products,
    warehouses,
    pavilions,
    stockArrivals,
    shipments,
    remainingStock,
    defectiveWriteOffs,
    expenses,
    pavilionReports,
    coolers
  ] = await Promise.all([
    supabase.from(tableNames.employees).select("*").order("full_name"),
    supabase.from(tableNames.products).select("*").order("name"),
    supabase.from(tableNames.warehouses).select("*").order("name"),
    supabase.from(tableNames.pavilions).select("*").order("code"),
    supabase.from(tableNames.stockArrivals).select("*, warehouses(name), products(name)").eq("report_date", date).order("created_at", { ascending: false }),
    supabase.from(tableNames.shipments).select("*, employees(full_name), pavilions(code)").eq("report_date", date).order("created_at", { ascending: false }),
    supabase.from(tableNames.remainingStock).select("*, warehouses(name), products(name)").eq("report_date", date).order("created_at", { ascending: false }),
    supabase.from(tableNames.defectiveWriteOffs).select("*, employees(full_name), warehouses(name), products(name)").eq("report_date", date).order("created_at", { ascending: false }),
    supabase.from(tableNames.expenses).select("*, employees(full_name)").eq("expense_date", date).order("created_at", { ascending: false }),
    supabase.from(tableNames.pavilionReports).select("*, pavilions(code)").eq("report_date", date).order("created_at", { ascending: false }),
    supabase.from(tableNames.coolers).select("*, pavilions(code)").order("updated_at", { ascending: false })
  ]);

  const safe = <T>(result: { data: T[] | null; error: unknown }) => result.error || !result.data ? [] : result.data;
  const realData = {
    employees: safe(employees),
    products: safe(products),
    warehouses: safe(warehouses),
    pavilions: safe(pavilions),
    stockArrivals: normalizeRows(safe(stockArrivals)),
    shipments: normalizeRows(safe(shipments)),
    remainingStock: normalizeRows(safe(remainingStock)),
    defectiveWriteOffs: normalizeRows(safe(defectiveWriteOffs)),
    expenses: normalizeRows(safe(expenses)),
    pavilionReports: normalizeRows(safe(pavilionReports)),
    coolers: normalizeRows(safe(coolers))
  };

  return {
    generatedAt: new Date().toISOString(),
    date,
    ...realData,
    ...calculateTotals(realData)
  } as DashboardData;
}

function moscowDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    ...row,
    warehouse_name: nestedName(row.warehouses) ?? row.warehouse_name,
    product_name: nestedName(row.products) ?? row.product_name,
    employee_name: nestedName(row.employees, "full_name") ?? row.employee_name,
    pavilion_code: nestedName(row.pavilions, "code") ?? row.pavilion_code
  }));
}

function nestedName(value: unknown, key = "name") {
  if (!value || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>)[key];
}

function sum(rows: Record<string, unknown>[], field: string) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

function calculateTotals(data: {
  stockArrivals: Record<string, unknown>[];
  shipments: Record<string, unknown>[];
  remainingStock: Record<string, unknown>[];
  defectiveWriteOffs: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  coolers: Record<string, unknown>[];
}) {
  const delivered = sum(data.shipments, "quantity_delivered");
  const returned = sum(data.shipments, "quantity_returned");
  const sold = sum(data.shipments, "quantity_sold");
  const cashSales = sum(data.shipments, "cash_amount");
  const expenses = sum(data.expenses, "amount");
  const mismatches: string[] = [];

  return {
    totals: {
      received: sum(data.stockArrivals, "quantity_received"),
      delivered,
      returned,
      sold,
      expenses,
      cashSales,
      cashExpected: cashSales - expenses,
      remaining: sum(data.remainingStock, "remaining_quantity"),
      defective: sum(data.defectiveWriteOffs, "defective_quantity"),
      ourCoolers: data.coolers.filter((row) => row.status === "our_cooler").length,
      discrepancies: mismatches.length
    },
    discrepancies: mismatches.length > 0 ? mismatches : ["Критичных расхождений за выбранный день не найдено."]
  };
}
