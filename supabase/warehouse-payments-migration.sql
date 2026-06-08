create table if not exists public.warehouse_payments (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  warehouse_name text not null default 'Склад',
  cash_amount numeric(12,2) not null default 0,
  transfer_amount numeric(12,2) not null default 0,
  comment text,
  source text not null default 'mobile',
  created_at timestamptz not null default now()
);

alter table public.warehouse_payments disable row level security;
