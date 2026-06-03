create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  opened_date date not null,
  opened_at text not null,
  closed_at text,
  source text not null default 'mobile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_shifts enable row level security;
