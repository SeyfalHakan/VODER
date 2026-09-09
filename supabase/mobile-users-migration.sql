create table if not exists public.mobile_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  pin_hash text not null,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  employee_kind text not null default 'pavilion' check (employee_kind in ('pavilion', 'warehouse', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists mobile_users_username_upper_idx
  on public.mobile_users (upper(username));

alter table public.mobile_users enable row level security;

create or replace function public.enforce_mobile_employee_limit()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'employee' and new.is_active then
    lock table public.mobile_users in share row exclusive mode;
    if (select count(*) from public.mobile_users where role = 'employee' and is_active) >= 6 then
      raise exception 'Можно зарегистрировать не более 6 сотрудников';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mobile_employee_limit_trigger on public.mobile_users;
create trigger mobile_employee_limit_trigger
before insert on public.mobile_users
for each row execute function public.enforce_mobile_employee_limit();

comment on table public.mobile_users is
  'Mobile application accounts. Access is server-side only through the service role.';
