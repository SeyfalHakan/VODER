export type PaymentType = "cash" | "card" | "transfer";
export type ExpenseCategory = "fuel" | "parking" | "salary" | "other";

export type Employee = {
  id: string;
  full_name: string;
  phone?: string | null;
  telegram_user_id?: number | null;
  is_active: boolean;
};

export type Product = {
  id: string;
  name: string;
  unit: string;
  bottle_volume_liters?: number | null;
};

export type Warehouse = {
  id: string;
  name: string;
  kind: string;
};

export type Pavilion = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  is_active: boolean;
};

export type DashboardData = {
  generatedAt: string;
  date: string;
  stockArrivals: Record<string, unknown>[];
  shipments: Record<string, unknown>[];
  remainingStock: Record<string, unknown>[];
  defectiveWriteOffs: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  pavilionReports: Record<string, unknown>[];
  coolers: Record<string, unknown>[];
  employees: Employee[];
  products: Product[];
  warehouses: Warehouse[];
  pavilions: Pavilion[];
  totals: {
    received: number;
    delivered: number;
    returned: number;
    sold: number;
    expenses: number;
    cashSales: number;
    cashExpected: number;
    remaining: number;
    defective: number;
    ourCoolers: number;
    discrepancies: number;
  };
  discrepancies: string[];
};
