alter table public.shipments
  add column if not exists sale_channel text not null default 'pavilion',
  add column if not exists destination_name text,
  add column if not exists warehouse_name text,
  add column if not exists product_id uuid references public.products(id),
  add column if not exists product_name text,
  add column if not exists unit_price numeric(12,2) not null default 0;

alter table public.stock_arrivals
  add column if not exists purchase_unit_price numeric(12,2) not null default 0;

update public.shipments
set
  sale_channel = coalesce(nullif(sale_channel, ''), 'pavilion'),
  destination_name = coalesce(destination_name, pavilion_code),
  quantity_sold = quantity_delivered,
  quantity_returned = 0,
  unit_price = case
    when sale_channel = 'warehouse' then 250
    else 300
  end,
  cash_amount = quantity_delivered * case
    when sale_channel = 'warehouse' then 250
    else 300
  end
where unit_price = 0 or cash_amount = 0;
