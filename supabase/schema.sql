create extension if not exists "pgcrypto";

create type app_role as enum ('admin', 'employee');
create type payment_type as enum ('cash', 'card', 'transfer');
create type expense_category as enum ('fuel', 'parking', 'salary', 'other');
create type warehouse_kind as enum ('warehouse', 'vehicle', 'pavilion', 'other');
create type cooler_status as enum ('our_cooler', 'not_our_cooler');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role app_role not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  telegram_user_id bigint unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'бутыль',
  bottle_volume_liters numeric(8,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind warehouse_kind not null default 'warehouse',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pavilions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.stock_arrivals (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  employee_id uuid references public.employees(id),
  telegram_user_id bigint,
  warehouse_id uuid references public.warehouses(id),
  warehouse_name text,
  product_id uuid references public.products(id),
  product_name text,
  quantity_received integer not null check (quantity_received >= 0),
  purchase_unit_price numeric(12,2) not null default 0,
  purchase_amount numeric(12,2) not null default 0,
  payment_type payment_type,
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  employee_id uuid references public.employees(id),
  employee_name text,
  telegram_user_id bigint,
  sale_channel text not null default 'pavilion',
  destination_name text,
  warehouse_name text,
  product_id uuid references public.products(id),
  product_name text,
  unit_price numeric(12,2) not null default 0,
  pavilion_id uuid references public.pavilions(id),
  pavilion_code text,
  quantity_delivered integer not null default 0 check (quantity_delivered >= 0),
  quantity_returned integer not null default 0 check (quantity_returned >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  cash_amount numeric(12,2) not null default 0,
  comments text,
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.remaining_stock_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  employee_id uuid references public.employees(id),
  telegram_user_id bigint,
  warehouse_id uuid references public.warehouses(id),
  warehouse_name text,
  product_id uuid references public.products(id),
  product_name text,
  remaining_quantity integer not null check (remaining_quantity >= 0),
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.defective_write_offs (
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

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  employee_id uuid references public.employees(id),
  employee_name text,
  telegram_user_id bigint,
  category expense_category not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_type payment_type not null default 'cash',
  comment text,
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  opened_date date not null,
  opened_at text not null,
  closed_at text,
  source text not null default 'mobile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pavilion_delivery_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  employee_id uuid references public.employees(id),
  telegram_user_id bigint,
  pavilion_id uuid references public.pavilions(id),
  pavilion_code text,
  bottles_delivered integer not null default 0 check (bottles_delivered >= 0),
  bottles_collected integer not null default 0 check (bottles_collected >= 0),
  notes text,
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.coolers (
  id uuid primary key default gen_random_uuid(),
  pavilion_id uuid references public.pavilions(id),
  pavilion_code text,
  status cooler_status not null,
  comment text,
  telegram_user_id bigint,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null unique,
  total_received integer not null default 0,
  total_delivered integer not null default 0,
  total_returned integer not null default 0,
  total_sold integer not null default 0,
  total_defective integer not null default 0,
  total_expenses numeric(12,2) not null default 0,
  cash_sales numeric(12,2) not null default 0,
  expected_cash numeric(12,2) not null default 0,
  discrepancy_count integer not null default 0,
  generated_at timestamptz not null default now()
);

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

alter table public.users enable row level security;
alter table public.employees enable row level security;
alter table public.products enable row level security;
alter table public.warehouses enable row level security;
alter table public.pavilions enable row level security;
alter table public.stock_arrivals enable row level security;
alter table public.shipments enable row level security;
alter table public.remaining_stock_reports enable row level security;
alter table public.defective_write_offs enable row level security;
alter table public.expenses enable row level security;
alter table public.employee_shifts enable row level security;
alter table public.pavilion_delivery_reports enable row level security;
alter table public.coolers enable row level security;
alter table public.daily_summaries enable row level security;

create policy "Admins can manage users" on public.users for all using (auth.uid() = id);
create policy "Authenticated admins can read employees" on public.employees for select using (auth.role() = 'authenticated');
create policy "Authenticated admins can read products" on public.products for select using (auth.role() = 'authenticated');
create policy "Authenticated admins can read warehouses" on public.warehouses for select using (auth.role() = 'authenticated');
create policy "Authenticated admins can read pavilions" on public.pavilions for select using (auth.role() = 'authenticated');

insert into public.products (name, unit, bottle_volume_liters) values
  ('Вода 19 л', 'бутыль', 19),
  ('Вода 5 л', 'бутылка', 5)
on conflict do nothing;

insert into public.warehouses (name, kind) values
  ('Основной склад', 'warehouse'),
  ('Машина 1', 'vehicle')
on conflict do nothing;

insert into public.pavilions (code, name, address) values
  ('P-12', 'Павильон 12', 'Рынок, ряд 3'),
  ('P-18', 'Павильон 18', 'Центр'),
  ('P-27', 'Павильон 27', 'Автовокзал')
on conflict (code) do nothing;
