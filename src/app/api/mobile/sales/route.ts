import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

type SaleChannel = "warehouse" | "pavilion";

type SalePayload = {
  saleChannel?: SaleChannel;
  destinationName?: string;
  pavilionCode?: string;
  quantityDelivered?: number;
  quantityReturned?: number;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SalePayload;
  const saleChannel = body.saleChannel;
  const quantityDelivered = Number(body.quantityDelivered ?? 0);
  const quantityReturned = saleChannel === "pavilion" ? Number(body.quantityReturned ?? 0) : 0;
  const unitPrice = Number(body.unitPrice ?? 0);
  const paymentType = String((body as SalePayload & { paymentType?: string }).paymentType ?? "").trim();
  const destinationName =
    saleChannel === "pavilion" ? String(body.pavilionCode ?? "").trim() : String(body.destinationName ?? "").trim();

  if (saleChannel !== "warehouse" && saleChannel !== "pavilion") {
    return NextResponse.json({ error: "Выберите склад или павильон" }, { status: 400 });
  }

  if (!destinationName) {
    return NextResponse.json({ error: saleChannel === "pavilion" ? "Введите номер павильона" : "Введите склад / клиента" }, { status: 400 });
  }

  if (!Number.isFinite(quantityDelivered) || quantityDelivered <= 0) {
    return NextResponse.json({ error: "Введите количество проданных бутылок" }, { status: 400 });
  }

  if (!Number.isFinite(quantityReturned) || quantityReturned < 0) {
    return NextResponse.json({ error: "Введите корректное количество возврата" }, { status: 400 });
  }
  if (![250, 300].includes(unitPrice)) {
    return NextResponse.json({ error: "Выберите цену 250 или 300 руб." }, { status: 400 });
  }
  if (!["cash", "transfer"].includes(paymentType)) {
    return NextResponse.json({ error: "Выберите НАЛ или БЕЗНАЛ" }, { status: 400 });
  }

  const payload = {
    report_date: moscowDate(),
    employee_name: "Мобильная форма",
    sale_channel: saleChannel,
    destination_name: destinationName,
    warehouse_name: saleChannel === "warehouse" ? destinationName : undefined,
    pavilion_code: saleChannel === "pavilion" ? destinationName : undefined,
    product_name: "Вода 19 л",
    quantity_delivered: quantityDelivered,
    quantity_returned: quantityReturned,
    quantity_sold: quantityDelivered,
    unit_price: unitPrice,
    cash_amount: quantityDelivered * unitPrice,
    comments: paymentType === "cash" ? "Оплата: НАЛ" : "Оплата: БЕЗНАЛ",
    source: "mobile"
  };

  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, demo: true, payload });
  }

  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const { error } = await supabase.from("shipments").insert(cleanPayload);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, demo: false, payload });
}

function moscowDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}
