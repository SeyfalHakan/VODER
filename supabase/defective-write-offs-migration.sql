create table if not exists public.defective_write_offs (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  employee_id uuid references public.employees(id),
  employee_name text,
  telegram_user_id bigint,
  warehouse_id uuid references public.warehouses(id),
  warehouse_name text,
  product_id uuid references public.products(id),
  product_name text,
  defective_quantity integer not null check (defective_quantity > 0),
  reason text not null,
  comment text,
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.defective_write_offs enable row level security;

alter table public.daily_summaries
  add column if not exists total_defective integer not null default 0;

create or replace view public.daily_operations_view as
select
  d::date as report_date,
  coalesce((select sum(quantity_received) from public.stock_arrivals where report_date = d), 0)::integer as total_received,
  coalesce((select sum(quantity_delivered) from public.shipments where report_date = d), 0)::integer as total_delivered,
  coalesce((select sum(quantity_returned) from public.shipments where report_date = d), 0)::integer as total_returned,
  coalesce((select sum(quantity_sold) from public.shipments where report_date = d), 0)::integer as total_sold,
  coalesce((select sum(defective_quantity) from public.defective_write_offs where report_date = d), 0)::integer as total_defective,
  coalesce((select sum(cash_amount) from public.shipments where report_date = d), 0)::numeric(12,2) as cash_sales,
  coalesce((select sum(amount) from public.expenses where expense_date = d), 0)::numeric(12,2) as total_expenses
from generate_series(current_date - interval '30 days', current_date, interval '1 day') d;
