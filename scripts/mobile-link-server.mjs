import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const port = Number(process.env.MOBILE_APP_PORT ?? process.env.PORT ?? 3000);
const host = process.env.MOBILE_APP_HOST ?? "0.0.0.0";
const memorySales = [];
const memoryExpenses = [];
const memoryShifts = [];
const memoryWarehouse = [];
const memoryWarehousePayments = [];
const fixedAuditMonthlyExpenses = [
  { name: "Аренда", amount: 105000 },
  { name: "Внутренний сервис", amount: 45000 }
];

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/" || url.pathname === "/employee")) {
    send(response, 200, "text/html; charset=utf-8", mobileHtml());
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/manifest.json") {
    const manifest = await readFile(new URL("../public/manifest.json", import.meta.url), "utf8");
    send(response, 200, "application/manifest+json; charset=utf-8", manifest);
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/icon.svg") {
    const icon = await readFile(new URL("../public/icon.svg", import.meta.url), "utf8");
    send(response, 200, "image/svg+xml; charset=utf-8", icon);
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sw.js") {
    const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
    send(response, 200, "text/javascript; charset=utf-8", worker);
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/apple-touch-icon.png") {
    const icon = await readFile(new URL("../public/apple-touch-icon.png", import.meta.url));
    sendBinary(response, 200, "image/png", icon);
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/icons/icon-192.png") {
    const icon = await readFile(new URL("../public/icons/icon-192.png", import.meta.url));
    sendBinary(response, 200, "image/png", icon);
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/icons/icon-512.png") {
    const icon = await readFile(new URL("../public/icons/icon-512.png", import.meta.url));
    sendBinary(response, 200, "image/png", icon);
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/voder-logo.svg") {
    const logo = await readFile(new URL("../public/voder-logo.svg", import.meta.url), "utf8");
    send(response, 200, "image/svg+xml; charset=utf-8", logo);
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/voder-bg.png") {
    const bg = await readFile(new URL("../public/voder-bg.png", import.meta.url));
    sendBinary(response, 200, "image/png", bg);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/login") {
    try {
      const body = JSON.parse(await readBody(request));
      const result = loginByPassword(body.password);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/sales") {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await saveSale(body);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/mobile/sales/")) {
    try {
      const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const body = JSON.parse(await readBody(request));
      const result = await updateSale(id, body);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/mobile/sales/")) {
    try {
      const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const result = await deleteSale(id);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/shift/open") {
    try {
      const bodyText = await readBody(request);
      const body = bodyText ? JSON.parse(bodyText) : {};
      const result = await openShift(body);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/shift/close") {
    try {
      const body = JSON.parse(await readBody(request));
      const shiftId = String(body.shiftId ?? "");
      const fallbackShift = body.shift && typeof body.shift === "object" ? body.shift : null;
      const shift =
        (shiftId ? await findShift(shiftId) : null) ??
        memoryShifts.find((item) => item.id === shiftId) ??
        (fallbackShift
          ? {
              id: String(fallbackShift.id ?? crypto.randomUUID()),
              employee_name: employeeDisplayName(fallbackShift.employee_name ?? body.employeeName),
              opened_at: String(fallbackShift.opened_at ?? ""),
              opened_date: normalizeDate(fallbackShift.opened_date) ?? moscowDate(),
              closed_at: null
            }
          : memoryShifts.at(-1));
      if (!shift) {
        send(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "Смена не открыта" }));
        return;
      }
      shift.closed_at = moscowDateTime();
      if (!memoryShifts.some((item) => item.id === shift.id)) memoryShifts.push(shift);
      await closeShiftInStorage(shift);
      const result = await buildReport(shift.opened_date, moscowDate(), body.role, shift.employee_name, shift.id);
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, shift, summary: result.body }));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/expenses") {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await saveExpense(body);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/warehouse") {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await saveWarehouseEntry(body);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/warehouse/payment") {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await saveWarehousePayment(body);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mobile/warehouse/debt") {
    try {
      const result = await buildWarehouseDebt(url.searchParams.get("from"), url.searchParams.get("to"));
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mobile/report") {
    try {
      const result = await buildReport(
        url.searchParams.get("from"),
        url.searchParams.get("to"),
        url.searchParams.get("role"),
        url.searchParams.get("employeeName"),
        url.searchParams.get("shiftId"),
        url.searchParams.get("filter"),
        url.searchParams.get("payment"),
        url.searchParams.get("scope")
      );
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mobile/audit") {
    try {
      const result = await buildAudit(url.searchParams.get("from"), url.searchParams.get("to"));
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mobile/assets") {
    try {
      const result = await buildAssets();
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mobile/coolers") {
    try {
      const result = await buildCoolerRegistry(url.searchParams.get("filter"));
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mobile/destinations") {
    try {
      const result = await buildDestinationSuggestions(url.searchParams.get("q"), url.searchParams.get("channel"));
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/reset-data") {
    try {
      const body = JSON.parse(await readBody(request));
      const result = await resetUserData(body.password);
      send(response, result.status, "application/json; charset=utf-8", JSON.stringify(result.body));
    } catch (error) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mobile/health") {
    const env = getSupabaseEnv();
    send(
      response,
      200,
      "application/json; charset=utf-8",
      JSON.stringify({
        ok: true,
        supabaseUrlConfigured: Boolean(env.url),
        supabaseServiceKeyConfigured: Boolean(env.key),
        supabaseReady: Boolean(env.url && env.key),
        version: "b5993f0-env-check"
      })
    );
    return;
  }

  send(response, 404, "text/plain; charset=utf-8", "Не найдено");
});

server.listen(port, host, () => {
  const lanUrls = getLanUrls(port);
  console.log(`Mobile water app is running locally: http://127.0.0.1:${port}/employee`);
  if (lanUrls.length > 0) {
    console.log("For phone or another device on the same Wi-Fi, open:");
    lanUrls.forEach((url) => console.log(`- ${url}`));
  } else {
    console.log(`For phone on the same Wi-Fi, open: http://<computer-ip>:${port}/employee`);
  }
});

function getLanUrls(currentPort) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${currentPort}/employee`);
}

async function openShift(body) {
  const employeeName = employeeDisplayName(body.employeeName);
  const shift = {
    id: crypto.randomUUID(),
    employee_name: employeeName,
    opened_at: moscowDateTime(),
    opened_date: moscowDate(),
    closed_at: null
  };

  const supabase = await createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("employee_shifts")
      .insert({
        id: shift.id,
        employee_name: shift.employee_name,
        opened_at: shift.opened_at,
        opened_date: shift.opened_date,
        closed_at: shift.closed_at,
        source: "mobile"
      })
      .select("id, employee_name, opened_at, opened_date, closed_at")
      .single();

    if (!error && data) {
      return { status: 200, body: { ok: true, shift: normalizeShift(data), demo: false } };
    }

    console.warn("[mobile-shift-fallback]", error?.message ?? "Supabase shift insert failed");
  }

  memoryShifts.push(shift);
  return { status: 200, body: { ok: true, shift, demo: true } };
}

async function findShift(shiftId) {
  const supabase = await createSupabaseAdminClient();
  if (!supabase || !shiftId) return null;

  const { data, error } = await supabase
    .from("employee_shifts")
    .select("id, employee_name, opened_at, opened_date, closed_at")
    .eq("id", shiftId)
    .maybeSingle();

  if (error) {
    console.warn("[mobile-shift-find-fallback]", error.message);
    return null;
  }

  return data ? normalizeShift(data) : null;
}

async function closeShiftInStorage(shift) {
  const supabase = await createSupabaseAdminClient();
  if (!supabase || !shift?.id) return;

  const { error } = await supabase
    .from("employee_shifts")
    .update({ closed_at: shift.closed_at, updated_at: new Date().toISOString() })
    .eq("id", shift.id);

  if (error) {
    console.warn("[mobile-shift-close-fallback]", error.message);
  }
}

async function saveSale(body) {
  const saleChannel = body.saleChannel;
  const quantityDelivered = Number(body.quantityDelivered ?? 0);
  const quantityReturned = Number(body.quantityReturned ?? 0);
  const unitPrice = Number(body.unitPrice ?? 0);
  const paymentType = String(body.paymentType ?? "").trim();
  const employeeName = employeeDisplayName(body.employeeName);
  const shiftId = String(body.shiftId ?? "").trim();
  const coolerStatus = normalizeCoolerStatus(body.coolerStatus);
  const destinationName =
    saleChannel === "pavilion" ? String(body.pavilionCode ?? "").trim() : String(body.destinationName ?? "").trim();

  if (saleChannel !== "warehouse" && saleChannel !== "pavilion") {
    return { status: 400, body: { error: "Выберите склад или павильон" } };
  }
  if (!destinationName) {
    return { status: 400, body: { error: saleChannel === "pavilion" ? "Введите номер павильона" : "Введите склад / клиента" } };
  }
  if (!Number.isFinite(quantityDelivered) || quantityDelivered <= 0) {
    return { status: 400, body: { error: "Введите количество проданных бутылок" } };
  }
  if (!Number.isFinite(quantityReturned) || quantityReturned < 0) {
    return { status: 400, body: { error: "Введите корректное количество возврата" } };
  }
  if (![200, 250, 300].includes(unitPrice)) {
    return { status: 400, body: { error: "Выберите цену 200, 250 или 300 руб." } };
  }
  if (!["cash", "transfer"].includes(paymentType)) {
    return { status: 400, body: { error: "Выберите НАЛ или БНАЛ" } };
  }

  const payload = {
    id: crypto.randomUUID(),
    report_date: moscowDate(),
    employee_name: employeeName,
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
    comments: `${paymentType === "cash" ? "Оплата: НАЛ" : "Оплата: БНАЛ"}; Кулер: ${coolerStatus === "our" ? "наш" : "не наш"}${shiftId ? `; Смена: ${shiftId}` : ""}`,
    source: "mobile",
    created_at: new Date().toISOString()
  };

  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    memorySales.push(payload);
    console.log("[mobile-demo-save]", payload);
    return { status: 200, body: { ok: true, demo: true, payload } };
  }

  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const { data, error } = await supabase.from("shipments").insert(cleanPayload).select("*").single();
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true, demo: false, payload: data ?? payload } };
}

async function updateSale(id, body) {
  if (!id) return { status: 400, body: { error: "Не найдена продажа" } };
  const quantitySold = Number(body.quantitySold ?? body.quantity_sold ?? 0);
  const quantityReturned = Number(body.quantityReturned ?? body.quantity_returned ?? 0);
  const unitPrice = Number(body.unitPrice ?? body.unit_price ?? 0);
  if (!Number.isFinite(quantitySold) || quantitySold < 0) return { status: 400, body: { error: "Введите количество проданных" } };
  if (!Number.isFinite(quantityReturned) || quantityReturned < 0) return { status: 400, body: { error: "Введите количество возврата" } };
  if (![200, 250, 300].includes(unitPrice)) return { status: 400, body: { error: "Цена должна быть 200, 250 или 300" } };

  const patch = {
    quantity_delivered: quantitySold,
    quantity_sold: quantitySold,
    quantity_returned: quantityReturned,
    unit_price: unitPrice,
    cash_amount: quantitySold * unitPrice
  };

  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    const row = memorySales.find((item) => String(item.id) === String(id));
    if (!row) return { status: 404, body: { error: "Запись не найдена" } };
    Object.assign(row, patch);
    return { status: 200, body: { ok: true, demo: true, payload: row } };
  }

  const { data, error } = await supabase.from("shipments").update(patch).eq("id", id).select("*").single();
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true, demo: false, payload: data } };
}

async function deleteSale(id) {
  if (!id) return { status: 400, body: { error: "Не найдена продажа" } };
  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    const index = memorySales.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return { status: 404, body: { error: "Запись не найдена" } };
    memorySales.splice(index, 1);
    return { status: 200, body: { ok: true, demo: true } };
  }
  const { error } = await supabase.from("shipments").delete().eq("id", id);
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true, demo: false } };
}

async function resetUserData(passwordInput) {
  const password = String(passwordInput ?? "").trim();
  if (password !== "1996") return { status: 401, body: { error: "Неверный пароль" } };

  memorySales.splice(0);
  memoryExpenses.splice(0);
  memoryShifts.splice(0);
  memoryWarehouse.splice(0);
  memoryWarehousePayments.splice(0);

  const supabase = await createSupabaseAdminClient();
  if (!supabase) return { status: 200, body: { ok: true, demo: true } };

  const tables = [
    "shipments",
    "expenses",
    "stock_arrivals",
    "remaining_stock_reports",
    "defective_write_offs",
    "warehouse_payments",
    "employee_shifts",
    "pavilion_delivery_reports",
    "coolers",
    "daily_summaries"
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) return { status: 500, body: { error: `${table}: ${error.message}` } };
  }
  return { status: 200, body: { ok: true, demo: false } };
}

function loginByPassword(passwordInput) {
  const password = String(passwordInput ?? "").trim();
  const users = {
    "1111": { role: "employee", employeeName: "Сотрудник 1", employeeKind: "pavilion", saleChannel: "pavilion" },
    "2222": { role: "employee", employeeName: "Сотрудник 2", employeeKind: "pavilion", saleChannel: "pavilion" },
    "0000": { role: "employee", employeeName: "Склад", employeeKind: "warehouse", saleChannel: "warehouse" },
    "1996": { role: "admin", employeeName: "Админ", employeeKind: "admin", saleChannel: "pavilion" }
  };
  const user = users[password];
  if (!user) return { status: 401, body: { error: "Неверный пароль" } };
  return { status: 200, body: { ok: true, ...user } };
}

async function saveExpense(body) {
  const expenseType = String(body.expenseType ?? "").trim();
  const freeText = String(body.comment ?? "").trim();
  const employeeName = employeeDisplayName(body.employeeName);
  const shiftId = String(body.shiftId ?? "").trim();
  const enteredAmount = Number(body.amount ?? 0);
  const amount =
    expenseType === "parking"
      ? 1000
      : expenseType === "stretch"
        ? 1900
      : enteredAmount > 0
        ? enteredAmount
        : Number(parseAmountFromText(freeText) ?? 0);

  const categories = {
    parking: "parking",
    salary: "salary",
    stretch: "other",
    other: "other"
  };

  if (!categories[expenseType]) {
    return { status: 400, body: { error: "Выберите тип расхода" } };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { error: "Введите сумму расхода" } };
  }

  if (expenseType === "other" && !freeText) {
    return { status: 400, body: { error: "Напишите, на что ушли деньги и сколько" } };
  }

  const defaultComment =
    expenseType === "parking"
      ? "Парковка: фиксированно 1000 руб."
      : expenseType === "stretch"
        ? "Стрейч: фиксированно 1900 руб."
        : "Зарплата";
  const payload = {
    expense_date: moscowDate(),
    employee_name: employeeName,
    category: categories[expenseType],
    amount,
    payment_type: "cash",
    comment: `${freeText || defaultComment}${shiftId ? `; Смена: ${shiftId}` : ""}`,
    source: "mobile"
  };

  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    memoryExpenses.push(payload);
    console.log("[mobile-demo-expense]", payload);
    return { status: 200, body: { ok: true, demo: true, payload } };
  }

  const { error } = await supabase.from("expenses").insert(payload);
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true, demo: false, payload } };
}

async function saveWarehouseEntry(body) {
  const entryType = String(body.entryType ?? "").trim();
  const quantity = Number(body.quantity ?? 0);
  const comment = String(body.comment ?? "").trim();

  if (!["arrival", "return", "remaining", "writeoff"].includes(entryType)) {
    return { status: 400, body: { error: "Выберите приход, возврат, остаток или списание" } };
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { status: 400, body: { error: "Введите количество бутылок" } };
  }

  const payload = {
    id: crypto.randomUUID(),
    report_date: moscowDate(),
    entry_type: entryType,
    warehouse_name: "Склад",
    product_name: "Вода 19 л",
    quantity,
    comment,
    source: "mobile"
  };

  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    memoryWarehouse.push(payload);
    console.log("[mobile-demo-warehouse]", payload);
    return { status: 200, body: { ok: true, demo: true, payload } };
  }

  const tableByType = {
    arrival: "stock_arrivals",
    return: "remaining_stock_reports",
    remaining: "remaining_stock_reports",
    writeoff: "defective_write_offs"
  };
  const dbPayload =
    entryType === "arrival"
      ? { id: payload.id, report_date: payload.report_date, warehouse_name: payload.warehouse_name, product_name: payload.product_name, quantity_received: quantity, purchase_unit_price: 120, purchase_amount: quantity * 120, payment_type: "transfer", source: "mobile" }
      : entryType === "remaining" || entryType === "return"
        ? { id: payload.id, report_date: payload.report_date, warehouse_name: payload.warehouse_name, product_name: payload.product_name, remaining_quantity: quantity, source: "mobile" }
        : { id: payload.id, report_date: payload.report_date, warehouse_name: payload.warehouse_name, product_name: payload.product_name, defective_quantity: quantity, reason: comment || "Списание со склада", comment, source: "mobile" };

  const { error } = await supabase.from(tableByType[entryType]).insert(dbPayload);
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true, demo: false, payload: { ...payload, purchase_amount: entryType === "arrival" ? quantity * 120 : 0 } } };
}

async function saveWarehousePayment(body) {
  const cashAmount = Number(body.cashAmount ?? body.cash_amount ?? 0);
  const transferAmount = Number(body.transferAmount ?? body.transfer_amount ?? 0);
  if (!Number.isFinite(cashAmount) || cashAmount < 0 || !Number.isFinite(transferAmount) || transferAmount < 0) {
    return { status: 400, body: { error: "Введите корректную оплату" } };
  }
  if (cashAmount + transferAmount <= 0) return { status: 400, body: { error: "Введите сумму оплаты" } };
  const payload = {
    id: crypto.randomUUID(),
    report_date: moscowDate(),
    warehouse_name: "Склад",
    cash_amount: cashAmount,
    transfer_amount: transferAmount,
    comment: "Оплата долга за бутылки",
    source: "mobile"
  };
  const supabase = await createSupabaseAdminClient();
  if (!supabase) {
    memoryWarehousePayments.push(payload);
    return { status: 200, body: { ok: true, demo: true, payload } };
  }
  const { data, error } = await supabase.from("warehouse_payments").insert(payload).select("*").single();
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true, demo: false, payload: data ?? payload } };
}

async function buildWarehouseDebt(fromInput, toInput) {
  const from = normalizeDate(fromInput) ?? "2000-01-01";
  const to = normalizeDate(toInput) ?? moscowDate();
  const supabase = await createSupabaseAdminClient();
  let arrivals = memoryWarehouse.filter((row) => row.entry_type === "arrival" && inPeriod(row.report_date, from, to));
  let payments = memoryWarehousePayments.filter((row) => inPeriod(row.report_date, from, to));
  let sales = memorySales.filter((row) => inPeriod(row.report_date, from, to));
  if (supabase) {
    const [arrivalsResult, paymentsResult, salesResult] = await Promise.all([
      supabase.from("stock_arrivals").select("*").gte("report_date", from).lte("report_date", to),
      supabase.from("warehouse_payments").select("*").gte("report_date", from).lte("report_date", to),
      supabase.from("shipments").select("*").gte("report_date", from).lte("report_date", to)
    ]);
    if (arrivalsResult.error) return { status: 500, body: { error: arrivalsResult.error.message } };
    if (paymentsResult.error) return { status: 500, body: { error: paymentsResult.error.message } };
    if (salesResult.error) return { status: 500, body: { error: salesResult.error.message } };
    arrivals = arrivalsResult.data ?? [];
    payments = paymentsResult.data ?? [];
    sales = salesResult.data ?? [];
  }
  const bottles = sum(arrivals, "quantity_received") || sum(arrivals, "quantity");
  const sentBottles = sum(sales, "quantity_sold");
  const cashDebt = bottles * 115;
  const transferDebt = bottles * 5;
  const cashPaid = sum(payments, "cash_amount");
  const transferPaid = sum(payments, "transfer_amount");
  return {
    status: 200,
    body: {
      ok: true,
      period: { from, to },
      bottles,
      sentBottles,
      cashDebt,
      transferDebt,
      totalDebt: cashDebt + transferDebt,
      cashPaid,
      transferPaid,
      paidTotal: cashPaid + transferPaid,
      cashRemaining: Math.max(0, cashDebt - cashPaid),
      transferRemaining: Math.max(0, transferDebt - transferPaid),
      remainingTotal: Math.max(0, cashDebt + transferDebt - cashPaid - transferPaid)
    }
  };
}

function employeeGroupLabel(name) {
  if (name === "Склад") return "Склад";
  if (name === "Сотрудник 1") return "Этаж первый";
  if (name === "Сотрудник 2") return "Этаж 2";
  return name || "Сотрудник";
}

function summarizeOperations(sales, expenses) {
  const income = sum(sales, "cash_amount");
  const cashIncome = sum(sales.filter((row) => paymentKind(row) === "cash"), "cash_amount");
  const transferIncome = income - cashIncome;
  const variableExpenses = sum(expenses, "amount");
  const cashExpenses = sum(expenses.filter((row) => paymentKind(row) === "cash"), "amount");
  const transferExpenses = variableExpenses - cashExpenses;
  const salaryTotal = sum(expenses.filter((row) => row.category === "salary"), "amount");
  const bottleTotal = sum(sales, "quantity_sold");
  const returnedTotal = sum(sales, "quantity_returned");
  const bottleCostTotal = bottleTotal * 120;
  const cashBalance = cashIncome - cashExpenses;
  const transferBalance = transferIncome - transferExpenses;
  const factTotal = cashBalance + transferBalance;
  const byPrice = [200, 250, 300].map((price) => {
    const rows = sales.filter((row) => Number(row.unit_price) === price);
    return {
      price,
      bottles: sum(rows, "quantity_sold"),
      returned: sum(rows, "quantity_returned"),
      amount: sum(rows, "cash_amount")
    };
  });
  const warehouseRows = sales.filter((row) => row.sale_channel === "warehouse");
  const warehouseBottleTotal = sum(warehouseRows, "quantity_sold");
  const warehouseServiceAmount = warehouseBottleTotal * 70;
  const byWarehouse = Object.values(
    warehouseRows.reduce((groups, row) => {
      const name = String(row.warehouse_name ?? row.destination_name ?? "Склад").trim() || "Склад";
      const price = Number(row.unit_price ?? 70);
      const key = `${name}__${price}`;
      groups[key] ??= { name, price, bottles: 0, returned: 0, amount: 0 };
      groups[key].bottles += Number(row.quantity_sold ?? 0);
      groups[key].returned += Number(row.quantity_returned ?? 0);
      groups[key].amount += Number(row.cash_amount ?? 0);
      return groups;
    }, {})
  );
  const expenseItems = expenses.map((row) => ({
    category: String(row.category ?? "other"),
    comment: cleanComment(row.comment),
    amount: Number(row.amount ?? 0),
    paymentType: paymentKind(row),
    employeeName: String(row.employee_name ?? "")
  }));
  const coolerItems = sales.map((row) => ({
    employeeName: String(row.employee_name ?? ""),
    channel: String(row.sale_channel ?? ""),
    destination: String(row.destination_name ?? row.warehouse_name ?? row.pavilion_code ?? ""),
    coolerStatus: coolerStatusFromRow(row),
    bottles: Number(row.quantity_sold ?? 0),
    returned: Number(row.quantity_returned ?? 0)
  }));

  return {
    income,
    cashIncome,
    transferIncome,
    salesCount: sales.length,
    bottleTotal,
    returnedTotal,
    warehouseBottleTotal,
    warehouseServiceAmount,
    byPrice,
    byWarehouse,
    variableExpenses,
    cashExpenses,
    transferExpenses,
    salaryTotal,
    expenseTotal: variableExpenses,
    bottleCostTotal,
    cashBalance,
    transferBalance,
    factTotal,
    profit: factTotal - bottleCostTotal,
    expenses,
    expenseItems,
    coolerItems
  };
}

function buildEmployeeBreakdown(sales, expenses) {
  const names = ["Склад", "Сотрудник 1", "Сотрудник 2"];
  const known = new Set(names);
  for (const row of [...sales, ...expenses]) {
    const name = String(row.employee_name ?? "").trim();
    if (name && !known.has(name)) {
      names.push(name);
      known.add(name);
    }
  }
  return names.map((name) => ({
    employeeName: name,
    label: employeeGroupLabel(name),
    kind: name === "Склад" ? "warehouse" : "pavilion",
    summary: summarizeOperations(
      sales.filter((row) => String(row.employee_name ?? "") === name),
      expenses.filter((row) => String(row.employee_name ?? "") === name)
    )
  })).filter((group) => group.summary.salesCount || group.summary.expenseItems.length);
}

function clientName(row) {
  return String(row.destination_name ?? row.warehouse_name ?? row.pavilion_code ?? "").trim() || "Без названия";
}

function publicSaleRow(row) {
  return {
    id: row.id,
    date: row.report_date,
    dateTime: saleDateTime(row),
    employeeName: row.employee_name ?? "",
    channel: row.sale_channel ?? "pavilion",
    destination: clientName(row),
    paymentType: paymentKind(row),
    coolerStatus: coolerStatusFromRow(row),
    quantitySold: Number(row.quantity_sold ?? 0),
    quantityReturned: Number(row.quantity_returned ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    amount: Number(row.cash_amount ?? 0)
  };
}

function buildClientRows(sales, writeoffs) {
  const groups = {};
  for (const row of sales) {
    const name = clientName(row);
    const key = `${String(row.sale_channel ?? "pavilion")}__${name}__${paymentKind(row)}__${coolerStatusFromRow(row)}`;
    groups[key] ??= {
      name,
      channel: String(row.sale_channel ?? "pavilion"),
      paymentType: paymentKind(row),
      coolerStatus: coolerStatusFromRow(row),
      sold: 0,
      returned: 0,
      writeoffs: 0,
      amount: 0,
      saleTimes: []
    };
    groups[key].sold += Number(row.quantity_sold ?? 0);
    groups[key].returned += Number(row.quantity_returned ?? 0);
    groups[key].amount += Number(row.cash_amount ?? 0);
    const dateTime = saleDateTime(row);
    if (dateTime && !groups[key].saleTimes.includes(dateTime)) groups[key].saleTimes.push(dateTime);
  }
  for (const row of writeoffs) {
    const name = String(row.warehouse_name ?? "Склад").trim() || "Склад";
    const key = `warehouse__${name}__writeoff__none`;
    groups[key] ??= {
      name,
      channel: "warehouse",
      paymentType: "",
      coolerStatus: "",
      sold: 0,
      returned: 0,
      writeoffs: 0,
      amount: 0,
      saleTimes: []
    };
    groups[key].writeoffs += Number(row.defective_quantity ?? row.quantity ?? 0);
  }
  return Object.values(groups);
}

function summarizeWarehouseDebt(arrivals, payments) {
  const bottles = sum(arrivals, "quantity_received") || sum(arrivals, "quantity");
  const cashDebt = bottles * 115;
  const transferDebt = bottles * 5;
  const cashPaid = sum(payments, "cash_amount");
  const transferPaid = sum(payments, "transfer_amount");
  return {
    bottles,
    cashDebt,
    transferDebt,
    totalDebt: cashDebt + transferDebt,
    cashPaid,
    transferPaid,
    paidTotal: cashPaid + transferPaid,
    cashRemaining: Math.max(0, cashDebt - cashPaid),
    transferRemaining: Math.max(0, transferDebt - transferPaid),
    remainingTotal: Math.max(0, cashDebt + transferDebt - cashPaid - transferPaid)
  };
}

async function buildReport(fromInput, toInput, role = "employee", employeeNameInput = "", shiftIdInput = "", filterInput = "", paymentFilterInput = "", scopeInput = "") {
  const from = normalizeDate(fromInput) ?? moscowDate();
  const to = normalizeDate(toInput) ?? from;
  const employeeName = employeeDisplayName(employeeNameInput);
  const shiftId = String(shiftIdInput ?? "").trim();
  const filter = String(filterInput ?? "").trim().toLowerCase();
  const paymentFilter = role === "admin" && ["cash", "transfer"].includes(String(paymentFilterInput ?? "")) ? String(paymentFilterInput) : "";
  const scope = role === "admin" && ["floor1", "floor2", "warehouse"].includes(String(scopeInput ?? "")) ? String(scopeInput) : "all";
  if (from > to) return { status: 400, body: { error: "Дата начала не может быть позже даты конца" } };

  const supabase = await createSupabaseAdminClient();
  let sales = memorySales.filter((row) => inPeriod(row.report_date, from, to));
  let expenses = memoryExpenses.filter((row) => inPeriod(row.expense_date, from, to));
  let arrivals = memoryWarehouse.filter((row) => row.entry_type === "arrival" && inPeriod(row.report_date, from, to));
  let writeoffs = memoryWarehouse.filter((row) => row.entry_type === "writeoff" && inPeriod(row.report_date, from, to));
  let warehousePayments = memoryWarehousePayments.filter((row) => inPeriod(row.report_date, from, to));

  if (supabase) {
    const [salesResult, expensesResult, arrivalsResult, writeoffsResult, paymentsResult] = await Promise.all([
      supabase.from("shipments").select("*").gte("report_date", from).lte("report_date", to),
      supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to),
      supabase.from("stock_arrivals").select("*").gte("report_date", from).lte("report_date", to),
      supabase.from("defective_write_offs").select("*").gte("report_date", from).lte("report_date", to),
      supabase.from("warehouse_payments").select("*").gte("report_date", from).lte("report_date", to)
    ]);
    if (salesResult.error) return { status: 500, body: { error: salesResult.error.message } };
    if (expensesResult.error) return { status: 500, body: { error: expensesResult.error.message } };
    if (arrivalsResult.error) return { status: 500, body: { error: arrivalsResult.error.message } };
    if (writeoffsResult.error) return { status: 500, body: { error: writeoffsResult.error.message } };
    sales = salesResult.data ?? [];
    expenses = expensesResult.data ?? [];
    arrivals = arrivalsResult.data ?? [];
    writeoffs = writeoffsResult.data ?? [];
    warehousePayments = paymentsResult.error ? [] : (paymentsResult.data ?? []);
  }

  if (role === "employee") {
    sales = sales.filter((row) => row.employee_name === employeeName);
    expenses = expenses.filter((row) => row.employee_name === employeeName);
    if (shiftId) {
      sales = sales.filter((row) => rowHasShift(row, shiftId));
      expenses = expenses.filter((row) => rowHasShift(row, shiftId));
    }
  }

  if (role === "admin" && scope !== "all") {
    const scopeEmployee = scope === "floor1" ? "Сотрудник 1" : scope === "floor2" ? "Сотрудник 2" : "Склад";
    sales = sales.filter((row) => String(row.employee_name ?? "") === scopeEmployee);
    expenses = expenses.filter((row) => String(row.employee_name ?? "") === scopeEmployee);
    if (scope !== "warehouse") {
      arrivals = [];
      writeoffs = [];
      warehousePayments = [];
    }
  }

  if (filter) {
    sales = sales.filter((row) => clientName(row).toLowerCase().includes(filter));
    arrivals = arrivals.filter((row) => String(row.warehouse_name ?? "").toLowerCase().includes(filter));
    writeoffs = writeoffs.filter((row) => String(row.warehouse_name ?? "").toLowerCase().includes(filter));
  }

  if (paymentFilter) {
    sales = sales.filter((row) => paymentKind(row) === paymentFilter);
  }

  const summary = summarizeOperations(sales, expenses);
  const employeeBreakdown = role === "admin" ? buildEmployeeBreakdown(sales, expenses) : [];
  const warehouseDebt = summarizeWarehouseDebt(arrivals, warehousePayments);
  const clientRows = buildClientRows(sales, writeoffs);

  return {
    status: 200,
    body: {
      ok: true,
      period: { from, to },
      ...summary,
      role,
      employeeBreakdown,
      filter: filterInput,
      paymentFilter,
      scope,
      clientRows,
      salesRows: sales.map(publicSaleRow),
      warehouseDebt,
      warehouseArrivals: arrivals.map((row) => ({
        id: row.id,
        date: row.report_date,
        warehouseName: row.warehouse_name ?? "Склад",
        bottles: Number(row.quantity_received ?? row.quantity ?? 0),
        cashDebt: Number(row.quantity_received ?? row.quantity ?? 0) * 115,
        transferDebt: Number(row.quantity_received ?? row.quantity ?? 0) * 5,
        totalDebt: Number(row.quantity_received ?? row.quantity ?? 0) * 120
      })),
      warehouseWriteoffs: writeoffs.map((row) => ({
        id: row.id,
        date: row.report_date,
        warehouseName: row.warehouse_name ?? "Склад",
        quantity: Number(row.defective_quantity ?? row.quantity ?? 0),
        comment: row.comment ?? row.reason ?? ""
      }))
    }
  };
}

async function buildAudit(fromInput, toInput) {
  const report = await buildReport(fromInput, toInput, "admin");
  if (report.status !== 200) return report;

  const { from, to } = report.body.period;
  const supabase = await createSupabaseAdminClient();
  let sales = memorySales.filter((row) => inPeriod(row.report_date, from, to));
  let expenses = memoryExpenses.filter((row) => inPeriod(row.expense_date, from, to));
  let warehouse = memoryWarehouse.filter((row) => inPeriod(row.report_date, from, to));

  if (supabase) {
    const [salesResult, expensesResult] = await Promise.all([
      supabase.from("shipments").select("*").gte("report_date", from).lte("report_date", to),
      supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to)
    ]);
    if (salesResult.error) return { status: 500, body: { error: salesResult.error.message } };
    if (expensesResult.error) return { status: 500, body: { error: expensesResult.error.message } };
    sales = salesResult.data ?? [];
    expenses = expensesResult.data ?? [];
    warehouse = [];
  }

  const fixed = fixedMonthlyTotal(from, to);
  const byPrice = [200, 250, 300].map((price) => {
    const rows = sales.filter((row) => Number(row.unit_price) === price);
    return {
      price,
      bottles: sum(rows, "quantity_sold"),
      amount: sum(rows, "cash_amount")
    };
  });
  const income = sum(sales, "cash_amount");
  const variableExpenses = sum(expenses, "amount");
  const auditExpenses = variableExpenses + fixed.total;
  const warehouseSummary = {
    arrival: sum(warehouse.filter((row) => row.entry_type === "arrival"), "quantity"),
    return: sum(warehouse.filter((row) => row.entry_type === "return"), "quantity"),
    remaining: sum(warehouse.filter((row) => row.entry_type === "remaining"), "quantity"),
    writeoff: sum(warehouse.filter((row) => row.entry_type === "writeoff"), "quantity")
  };
  const salesDetail = sales.map((row) => ({
    date: row.report_date,
    channel: row.sale_channel,
    destination: row.destination_name ?? row.warehouse_name ?? row.pavilion_code ?? "",
    price: Number(row.unit_price ?? 0),
    bottles: Number(row.quantity_sold ?? 0),
    returned: Number(row.quantity_returned ?? 0),
    amount: Number(row.cash_amount ?? 0),
    paymentType: paymentKind(row)
  }));

  return {
    status: 200,
    body: {
      ok: true,
      period: { from, to },
      income,
      byPrice,
      salaryTotal: sum(expenses.filter((row) => row.category === "salary"), "amount"),
      variableExpenses,
      fixedExpenses: fixed,
      expenseTotal: auditExpenses,
      profit: income - auditExpenses,
      report: report.body,
      byWarehouse: report.body.byWarehouse,
      expenseItems: report.body.expenseItems,
      warehouseSummary,
      warehouse,
      salesDetail
    }
  };
}

async function buildAssets() {
  const supabase = await createSupabaseAdminClient();
  let sales = memorySales;
  let warehouse = memoryWarehouse;

  if (supabase) {
    const [salesResult, defectsResult, remainsResult, arrivalsResult] = await Promise.all([
      supabase.from("shipments").select("*"),
      supabase.from("defective_write_offs").select("*"),
      supabase.from("remaining_stock_reports").select("*"),
      supabase.from("stock_arrivals").select("*")
    ]);
    if (salesResult.error) return { status: 500, body: { error: salesResult.error.message } };
    if (defectsResult.error) return { status: 500, body: { error: defectsResult.error.message } };
    if (remainsResult.error) return { status: 500, body: { error: remainsResult.error.message } };
    if (arrivalsResult.error) return { status: 500, body: { error: arrivalsResult.error.message } };

    sales = salesResult.data ?? [];
    warehouse = [
      ...(arrivalsResult.data ?? []).map((row) => ({ entry_type: "arrival", quantity: row.quantity_received })),
      ...(remainsResult.data ?? []).map((row) => ({ entry_type: "return", quantity: row.remaining_quantity })),
      ...(defectsResult.data ?? []).map((row) => ({ entry_type: "writeoff", quantity: row.defective_quantity }))
    ];
  }

  const deliveredToClients = sum(sales.filter((row) => row.sale_channel === "pavilion"), "quantity_delivered");
  const returnedFromClients = sum(sales.filter((row) => row.sale_channel === "pavilion"), "quantity_returned");
  const clientBottles = Math.max(0, deliveredToClients - returnedFromClients);
  const writtenOff = sum(warehouse.filter((row) => row.entry_type === "writeoff"), "quantity");
  const arrivals = sum(warehouse.filter((row) => row.entry_type === "arrival"), "quantity");
  const warehouseReturns = sum(warehouse.filter((row) => row.entry_type === "return"), "quantity");
  const warehouseRemaining = Math.max(0, arrivals - warehouseReturns - writtenOff);
  const totalTracked = warehouseRemaining + clientBottles + writtenOff;

  return {
    status: 200,
    body: {
      ok: true,
      totalTracked,
      warehouseRemaining,
      clientBottles,
      writtenOff,
      deliveredToClients,
      returnedFromClients
    }
  };
}

async function buildDestinationSuggestions(queryInput = "", channelInput = "") {
  const query = String(queryInput ?? "").trim().toLowerCase();
  const channel = String(channelInput ?? "").trim();
  if (!query) return { status: 200, body: { ok: true, suggestions: [] } };

  const names = [];
  const addName = (value) => {
    const name = String(value ?? "").trim();
    if (name) names.push(name);
  };
  const addSaleName = (row) => {
    if (channel === "pavilion" && row.sale_channel !== "pavilion") return;
    if (channel === "warehouse" && row.sale_channel !== "warehouse") return;
    addName(row.destination_name ?? row.warehouse_name ?? row.pavilion_code);
  };

  memorySales.forEach(addSaleName);
  if (channel !== "pavilion") {
    memoryWarehouse.forEach((row) => addName(row.warehouse_name));
  }

  const supabase = await createSupabaseAdminClient();
  if (supabase) {
    const [salesResult, arrivalsResult, remainsResult, defectsResult] = await Promise.all([
      supabase.from("shipments").select("sale_channel,destination_name,warehouse_name,pavilion_code").limit(500),
      supabase.from("stock_arrivals").select("warehouse_name").limit(300),
      supabase.from("remaining_stock_reports").select("warehouse_name").limit(300),
      supabase.from("defective_write_offs").select("warehouse_name").limit(300)
    ]);
    (salesResult.data ?? []).forEach(addSaleName);
    if (channel !== "pavilion") {
      (arrivalsResult.data ?? []).forEach((row) => addName(row.warehouse_name));
      (remainsResult.data ?? []).forEach((row) => addName(row.warehouse_name));
      (defectsResult.data ?? []).forEach((row) => addName(row.warehouse_name));
    }
  }

  const seen = new Set();
  const suggestions = names
    .filter((name) => name.toLowerCase().includes(query))
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(query) ? 0 : 1;
      const bStarts = b.toLowerCase().startsWith(query) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b, "ru");
    })
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  return { status: 200, body: { ok: true, suggestions } };
}

async function buildCoolerRegistry(filterInput = "") {
  const filter = String(filterInput ?? "").trim().toLowerCase();
  let sales = memorySales;

  const supabase = await createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("shipments")
      .select("id,report_date,created_at,employee_name,sale_channel,destination_name,warehouse_name,pavilion_code,comments");
    if (error) return { status: 500, body: { error: error.message } };
    sales = data ?? [];
  }

  const latest = {};
  for (const row of sales) {
    const explicitCoolerStatus = explicitCoolerStatusFromRow(row);
    if (!explicitCoolerStatus) continue;
    const name = clientName(row);
    const channel = String(row.sale_channel ?? "pavilion");
    const key = `${channel}__${name.toLowerCase()}`;
    const stamp = String(row.created_at ?? row.report_date ?? "");
    const currentStamp = latest[key]?.stamp ?? "";
    if (!latest[key] || stamp >= currentStamp) {
      latest[key] = {
        key,
        stamp,
        name,
        channel,
        employeeName: String(row.employee_name ?? ""),
        coolerStatus: explicitCoolerStatus,
        date: String(row.report_date ?? "")
      };
    }
  }

  const rows = Object.values(latest)
    .filter((row) => row.coolerStatus === "our")
    .filter((row) => !filter || row.name.toLowerCase().includes(filter))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((row) => ({
      name: row.name,
      channel: row.channel,
      employeeName: row.employeeName,
      date: row.date
    }));

  return { status: 200, body: { ok: true, total: rows.length, rows, filter: filterInput } };
}

async function createSupabaseAdminClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URI ?? process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  response.end(body);
}

function sendBinary(response, status, contentType, body) {
  response.writeHead(status, {
    "content-type": contentType,
    "content-length": body.length,
    "cache-control": "no-store"
  });
  response.end(body);
}

function moscowDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function moscowDateTime() {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date());
}

function normalizeDate(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? String(value) : null;
}

function inPeriod(date, from, to) {
  return date >= from && date <= to;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

function paymentKind(row) {
  const raw = String(row.payment_type ?? "").toLowerCase();
  if (raw === "cash") return "cash";
  if (raw === "card" || raw === "transfer") return "transfer";

  const comments = String(row.comments ?? row.comment ?? "").toLowerCase();
  if (comments.includes("бнал") || comments.includes("безнал") || comments.includes("карта") || comments.includes("transfer")) return "transfer";
  return "cash";
}

function saleDateTime(row) {
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(createdAt);
  }
  return String(row.report_date ?? "");
}

function normalizeCoolerStatus(value) {
  return String(value ?? "").trim() === "not_our" ? "not_our" : "our";
}

function coolerStatusFromRow(row) {
  const comments = String(row.comments ?? row.comment ?? "").toLowerCase();
  return comments.includes("кулер: не наш") ? "not_our" : "our";
}

function explicitCoolerStatusFromRow(row) {
  const comments = String(row.comments ?? row.comment ?? "").toLowerCase();
  if (comments.includes("кулер: не наш")) return "not_our";
  if (comments.includes("кулер: наш")) return "our";
  return "";
}

function employeeDisplayName(value) {
  const text = String(value ?? "").trim();
  return text || "Сотрудник 1";
}

function normalizeShift(row) {
  return {
    id: String(row.id ?? ""),
    employee_name: employeeDisplayName(row.employee_name),
    opened_at: String(row.opened_at ?? ""),
    opened_date: normalizeDate(row.opened_date) ?? moscowDate(),
    closed_at: row.closed_at ? String(row.closed_at) : null
  };
}

function rowHasShift(row, shiftId) {
  const marker = `Смена: ${shiftId}`;
  return String(row.comments ?? row.comment ?? "").includes(marker);
}

function cleanComment(value) {
  return String(value ?? "").replace(/;?\s*Смена:\s*[0-9a-f-]+/gi, "").trim();
}

function parseAmountFromText(value) {
  const match = String(value).replace(/\s/g, "").match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : null;
}

function fixedMonthlyTotal(from, to) {
  const months = new Set();
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);

  while (cursor <= end) {
    months.add(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const monthlyTotal = fixedAuditMonthlyExpenses.reduce((total, item) => total + item.amount, 0);
  return {
    months: Array.from(months),
    monthlyItems: fixedAuditMonthlyExpenses,
    monthlyTotal,
    total: monthlyTotal * months.size
  };
}

function mobileHtml() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#050812" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="VODER" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/icon.svg?v=2" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
  <title>VODER</title>
  <style>
    :root{--ink:#10202a;--muted:#5c6b74;--line:#d9e4e9;--aqua:#0f9f9c;--soft:#f4f8fa;--danger:#b91c1c}
    *{box-sizing:border-box;font-family:Tahoma,Arial,Helvetica,sans-serif!important;letter-spacing:0!important;font-style:normal!important}[hidden]{display:none!important} body{margin:0;background:var(--soft);color:var(--ink);font-family:Tahoma,Arial,Helvetica,sans-serif!important;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
    main{min-height:100vh;padding:calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 92px)}
    .app{max-width:430px;margin:0 auto;min-height:calc(100vh - 40px);display:flex;flex-direction:column}
    header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.brand{display:flex;align-items:center;gap:12px}.logo{width:46px;height:46px;border-radius:14px;background:var(--aqua);display:grid;place-items:center;color:white;box-shadow:0 18px 45px rgba(16,32,42,.08)}h1{font-size:22px;line-height:1.1;margin:0}.sub{margin:4px 0 0;color:var(--muted);font-size:14px}.pill{border:1px solid var(--line);background:white;border-radius:10px;padding:8px 10px;color:var(--muted);font-size:12px;font-weight:600}
    .card{background:white;border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 45px rgba(16,32,42,.08)}.tabs,.payments{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}.prices{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px}.prices,.payments{margin-top:12px}.tab{height:82px}.price,.payment{height:58px}.tab,.price,.payment{border-radius:12px;border:1px solid var(--line);background:white;color:var(--muted);font-size:16px;font-weight:800}.tab.active,.price.active,.payment.active{border-color:var(--aqua);background:var(--aqua);color:white}
    form,.panel{margin-top:14px;padding:16px;display:flex;flex:1;flex-direction:column;gap:16px}.page{display:none}.page.active{display:flex;flex-direction:column;flex:1}label span{display:block;margin-bottom:8px;color:var(--muted);font-size:14px;font-weight:700}input,textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:0 14px;color:var(--ink);font-size:20px;font-weight:800;outline:none}input{height:58px}textarea{min-height:118px;padding-top:14px;resize:vertical;font-size:17px;line-height:1.35}input:focus,textarea:focus{border-color:var(--aqua)}
    .sum{margin-top:auto;border-radius:12px;background:var(--soft);padding:14px}.row{display:flex;justify-content:space-between;gap:12px}.row+.row{margin-top:8px}.row span:first-child{color:var(--muted)}.total{font-size:28px;font-weight:900}.message{border-radius:12px;padding:10px 12px;font-size:14px}.ok{background:#ecfdf5;color:#047857}.err{background:#fef2f2;color:var(--danger)}.submit{height:58px;border:0;border-radius:12px;background:var(--aqua);color:white;font-size:17px;font-weight:900;box-shadow:0 18px 45px rgba(16,32,42,.08)}.submit:disabled{opacity:.65}
    .expense-types,.report-actions{display:grid;grid-template-columns:1fr;gap:8px}.expense-btn{min-height:58px;border-radius:12px;border:1px solid var(--line);background:white;color:var(--muted);font-size:17px;font-weight:800}.expense-btn.active{border-color:var(--aqua);background:var(--aqua);color:white}.hint{margin:0;color:var(--muted);font-size:13px;line-height:1.45}.report-box{display:grid;gap:10px;border-radius:12px;background:var(--soft);padding:14px}.report-line{display:flex;justify-content:space-between;gap:12px}.report-line b{text-align:right}.report-section{margin-top:6px;padding-top:10px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);font-weight:900;text-transform:uppercase}.report-total{font-size:16px}.report-total b{font-size:20px}.report-mini{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:-2px}.report-mini div{border:1px solid var(--line);border-radius:10px;background:white;padding:8px;font-size:12px;color:var(--muted)}.report-mini b{display:block;margin-top:3px;color:var(--ink);font-size:14px}.fixed-list{margin:0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.5}.asset-grid{display:grid;grid-template-columns:1fr;gap:10px}.asset-card{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;background:white;padding:12px}.asset-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--soft);font-size:22px}.asset-title{font-size:13px;color:var(--muted);font-weight:700}.asset-value{font-size:24px;font-weight:900}.asset-sub{font-size:12px;color:var(--muted)}.asset-line{height:14px;border-radius:99px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 28px rgba(47,123,255,.18),inset 0 1px 0 rgba(255,255,255,.18);overflow:hidden;display:flex;gap:2px;padding:2px}.asset-line span{display:block;height:100%;border-radius:99px;transition:width .25s ease}.asset-line-warehouse{background:#67dcff}.asset-line-client{background:#5b35d8}.asset-line-writeoff{background:#7f1231}.footer{position:fixed;left:0;right:0;bottom:0;z-index:10;border-top:1px solid var(--line);background:rgba(255,255,255,.96);backdrop-filter:blur(12px);padding:8px 12px calc(env(safe-area-inset-bottom) + 8px)}.footer-inner{max-width:430px;margin:0 auto;display:grid;grid-template-columns:repeat(7,minmax(66px,1fr));gap:6px;overflow-x:auto}.footer button{height:54px;border:0;border-radius:12px;background:var(--soft);color:var(--muted);font-size:11px;font-weight:900}.footer button.active{background:var(--aqua);color:white}.start-screen{display:none}.start-card{width:min(430px,100%);display:grid;gap:16px;padding:18px}.shift-pill{border-radius:10px;background:#ecfdf5;color:#047857;padding:9px 10px;font-size:13px;font-weight:800}.close-btn{background:#10202a!important;color:white!important}.closed-summary{display:grid;gap:10px;border-radius:12px;background:var(--soft);padding:14px}.hidden{display:none!important}.admin-only.hidden{display:none!important}.pin-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pin-grid input{text-align:center;font-size:26px}.home-actions{display:grid;gap:12px}.logout-btn{background:#10202a!important}
    button,.report-line span,.report-line b,label span{white-space:nowrap}.tab,.price,.payment,.expense-btn,.submit{font-size:clamp(12px,3.5vw,16px);overflow:hidden;text-overflow:ellipsis}.tabs{grid-template-columns:1fr}.tab{display:grid;place-items:center;height:38px;border:0!important;background:transparent!important;color:var(--ink)!important;font-size:18px!important;font-weight:900;pointer-events:none}.footer button{font-size:10px}.work-kpi{margin-top:12px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.work-kpi div{border-radius:12px;background:var(--soft);padding:10px}.work-kpi span{display:block;color:var(--muted);font-size:12px;font-weight:800;white-space:nowrap}.work-kpi b{display:block;margin-top:4px;font-size:18px;white-space:nowrap}.destination-grid{display:grid;grid-template-columns:1fr 54px 54px;gap:8px;align-items:end}.destination-field{position:relative}.suggestions{position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:30;display:grid;gap:6px;padding:7px;border:1px solid rgba(216,225,255,.18);border-radius:18px;background:rgba(11,4,28,.96);box-shadow:0 18px 44px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.10);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.suggestion-btn{min-height:38px;border:1px solid rgba(216,225,255,.12);border-radius:13px;background:rgba(255,255,255,.07);color:#fff;text-align:left;padding:0 12px;font-size:14px;font-weight:850}.suggestion-btn:active{background:linear-gradient(135deg,#320096,#849bff)}.cooler-btn{height:58px;border-radius:12px;border:1px solid var(--line);background:white;font-size:22px;font-weight:900}.cooler-btn.our.active{background:#16a34a;color:white;border-color:#16a34a}.cooler-btn.not.active{background:#dc2626;color:white;border-color:#dc2626}
    :root{--ink:#f7fbff;--muted:#9ea8bb;--line:rgba(255,255,255,.14);--aqua:#2e7bff;--soft:rgba(255,255,255,.07);--danger:#ff6176;--panel:rgba(13,16,27,.78);--panel2:rgba(24,28,43,.68);--glow:#78b8ff}
    *{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif!important}
    body{position:relative;min-height:100vh;background:radial-gradient(circle at 72% 0%,rgba(127,190,255,.46),transparent 34%),radial-gradient(circle at 22% 18%,rgba(39,112,255,.54),transparent 34%),linear-gradient(180deg,#02040a 0%,#07101b 46%,#020308 100%);color:var(--ink);overflow-x:hidden}
    body:before,body:after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0}
    body:before{background:radial-gradient(ellipse at 50% 38%,rgba(56,152,255,.30),transparent 46%);filter:blur(14px)}
    body:after{background:linear-gradient(90deg,rgba(0,0,0,.58),transparent 24%,transparent 76%,rgba(0,0,0,.58)),linear-gradient(180deg,rgba(255,255,255,.04),transparent 24%,rgba(0,0,0,.32))}
    main{position:relative;z-index:1;padding:calc(env(safe-area-inset-top) + 18px) 16px calc(env(safe-area-inset-bottom) + 102px)}
    html,body{width:100%;max-width:100%;overflow-x:hidden}.app{width:100%;max-width:min(430px,100%);min-height:calc(100vh - 44px)}.card,.submit,input,textarea{max-width:100%}
    header{margin-bottom:18px}.logo{width:48px;height:48px;border-radius:18px;background:linear-gradient(135deg,#47a9ff 0%,#1260ec 74%);display:grid;place-items:center;overflow:hidden;box-shadow:0 18px 48px rgba(52,136,255,.42),0 0 34px rgba(43,128,255,.28),inset 0 1px 0 rgba(255,255,255,.38);color:white}.logo svg{width:68%;height:68%;display:block;filter:drop-shadow(0 7px 10px rgba(3,34,112,.28))}h1{font-size:22px;font-weight:850;letter-spacing:0!important}.sub{color:var(--muted);font-size:13px}.pill,.shift-pill{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);border-radius:18px;color:#dbe8ff;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
    .card{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid rgba(255,255,255,.15);border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    form,.panel{padding:18px;gap:15px}.tabs,.payments{gap:9px;padding:12px}.prices{gap:9px;padding:12px}.tab{color:#f7fbff!important;font-size:18px!important}.price,.payment,.expense-btn,.cooler-btn{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#d6deec;border-radius:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
    .price.active,.payment.active,.expense-btn.active{border-color:rgba(133,194,255,.8);background:linear-gradient(100deg,#1e69ff 0%,#338cff 52%,#86c4ff 100%);color:white;box-shadow:0 16px 40px rgba(45,126,255,.32),inset 0 1px 0 rgba(255,255,255,.35)}
    label span{color:#b9c4d5;font-size:13px;font-weight:750}input,textarea{border:1px solid rgba(255,255,255,.14);background:rgba(7,10,18,.62);color:#f7fbff;border-radius:18px;font-size:19px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}input::placeholder,textarea::placeholder{color:#647186}input:focus,textarea:focus{border-color:#7dbdff;box-shadow:0 0 0 4px rgba(48,128,255,.18)}
    .sum,.report-box,.closed-summary,.work-kpi div,.asset-icon{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);border-radius:18px}.total,.asset-value,.report-mini b{color:#f7fbff}.row span:first-child,.hint,.fixed-list,.report-section,.asset-title,.asset-sub,.work-kpi span{color:var(--muted)}
    .message{border-radius:16px}.ok{background:rgba(20,185,122,.16);color:#87f0c1;border:1px solid rgba(58,216,151,.22)}.err{background:rgba(255,80,106,.15);color:#ff9bab;border:1px solid rgba(255,97,118,.24)}
    .submit,.logout-btn,.close-btn{height:60px;border-radius:18px;background:linear-gradient(100deg,#1d67ff 0%,#2e86ff 48%,#7cbcff 100%)!important;color:white!important;box-shadow:0 18px 50px rgba(42,124,255,.36),inset 0 1px 0 rgba(255,255,255,.34);font-weight:850}.submit:disabled{opacity:.58;filter:saturate(.7)}
    .footer{z-index:12;border-top:1px solid rgba(255,255,255,.12);background:rgba(5,8,18,.78);box-shadow:0 -24px 70px rgba(0,0,0,.45);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}.footer-inner{gap:7px}.footer button{height:55px;border-radius:18px;background:rgba(255,255,255,.08);color:#aeb8c9;font-weight:850}.footer button.active{background:linear-gradient(120deg,#206dff,#79b8ff);color:white;box-shadow:0 12px 34px rgba(47,123,255,.32)}
    .report-mini div,.asset-card{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);border-radius:18px}.asset-line{height:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 28px rgba(47,123,255,.18),inset 0 1px 0 rgba(255,255,255,.18);gap:2px;padding:2px}.asset-line span{border-radius:99px}.asset-line-warehouse{background:#67dcff}.asset-line-client{background:#5b35d8}.asset-line-writeoff{background:#7f1231}
    .cooler-btn.our.active{background:linear-gradient(135deg,#18b976,#7af0bf);color:#04120b;border-color:rgba(122,240,191,.8)}.cooler-btn.not.active{background:linear-gradient(135deg,#e83f5f,#ff9bab);color:white;border-color:rgba(255,155,171,.8)}
    #reportCloseShiftButton{margin-top:auto}.app-title{display:flex;align-items:center;gap:8px}.channel-badge{display:inline-flex;align-items:center;height:22px;padding:0 9px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.08);color:#dbe8ff;font-size:11px;font-weight:850;line-height:1}.quantity-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}#workPage>.tabs{display:none!important}
    @media (max-width:430px){main{padding:calc(env(safe-area-inset-top) + 10px) 10px calc(env(safe-area-inset-bottom) + 82px)}header{margin-bottom:10px;padding:0 2px}.logo{width:40px;height:40px;border-radius:15px}h1{font-size:19px}.channel-badge{height:20px;padding:0 8px;font-size:10px}.sub{font-size:12px}.pill{padding:7px 9px;font-size:11px}.card{width:100%;border-radius:20px}#homePage .panel{min-height:auto}form,.panel{margin-top:9px;padding:12px;gap:10px}.tabs,.prices,.payments{padding:8px;gap:7px}.tab{height:30px!important;font-size:15px!important}.price,.payment,.expense-btn,.cooler-btn,input{height:48px}.submit{width:100%;height:50px!important}.destination-grid{grid-template-columns:minmax(0,1fr) 46px 46px;gap:7px}.quantity-grid{gap:7px}label{min-width:0}label span{margin-bottom:5px;font-size:12px}input{font-size:16px;padding:0 10px}textarea{min-height:92px;font-size:15px}.sum,.report-box,.closed-summary{padding:10px}.total{font-size:23px}.row+.row{margin-top:6px}.report-line{gap:8px}.report-line span,.report-line b{font-size:12px}.report-total b{font-size:18px}.footer{padding:6px 10px calc(env(safe-area-inset-bottom) + 6px)}.footer-inner{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.footer button{height:47px;border-radius:15px;font-size:9px}.work-kpi{margin-top:8px;padding:8px;gap:7px}.work-kpi div{padding:7px}.work-kpi b{font-size:15px}}
    @media (max-height:760px){main{padding-top:8px}.brand{gap:9px}header{margin-bottom:9px}.card{border-radius:18px}form,.panel{gap:9px}.price,.payment,.expense-btn,.cooler-btn,input{height:46px}.submit{height:49px!important}.sum{padding:9px}.footer button{height:46px}.work-kpi{margin-top:7px;padding:7px}}
    @media (max-width:380px){h1{font-size:20px}.tab{font-size:16px!important}.footer button{font-size:9px}.price,.payment,.expense-btn,.submit{font-size:clamp(11px,3.3vw,15px)}}
    .card{border-radius:28px}.price,.payment,.expense-btn,.cooler-btn,input,.submit{border-radius:22px!important}.prices,.payments{padding:8px;gap:7px;margin-top:9px}.price,.payment,.expense-btn,input{height:44px}.cooler-btn{height:44px}.submit{height:46px!important}.panel,form{padding:14px;gap:11px}.sum,.report-box,.closed-summary{border-radius:24px;padding:10px}.destination-grid{grid-template-columns:minmax(0,1fr) 44px 44px;gap:7px}.footer button{height:44px;border-radius:20px}.channel-badge,.pill,.shift-pill{border-radius:999px}
    @media (max-width:430px){main{padding-top:8px}.card{border-radius:26px}form,.panel{padding:11px;gap:9px}.prices,.payments{padding:7px;gap:6px;margin-top:8px}.price,.payment,.expense-btn,input{height:41px}.cooler-btn{height:41px}.submit{height:43px!important}.destination-grid{grid-template-columns:minmax(0,1fr) 41px 41px;gap:6px}.quantity-grid{gap:6px}.sum,.report-box,.closed-summary{border-radius:22px;padding:9px}.footer button{height:42px;border-radius:19px}.footer{padding-top:5px}.home-actions{gap:9px}.pin-grid{gap:6px}}
    .footer{display:flex;justify-content:center;align-items:center;border-top:0;background:transparent!important;box-shadow:none!important;padding:0 12px calc(env(safe-area-inset-bottom) + 12px)!important;pointer-events:none}.footer-inner{width:auto;max-width:calc(100vw - 28px);display:flex!important;grid-template-columns:none!important;justify-content:center;align-items:center;gap:8px!important;margin:0 auto;padding:8px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(80,80,86,.62);box-shadow:0 18px 46px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.13);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);overflow:visible!important;pointer-events:auto}.footer button{width:46px;min-width:46px;height:46px!important;padding:0;border-radius:999px!important;display:grid;place-items:center;background:transparent!important;color:rgba(238,243,252,.62);box-shadow:none!important}.footer button svg{width:21px;height:21px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}.footer button.active{background:linear-gradient(135deg,#226dff,#6daeff)!important;color:#fff;box-shadow:0 10px 26px rgba(46,123,255,.45),inset 0 1px 0 rgba(255,255,255,.28)!important}.nav-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    @media (max-width:430px){.footer{padding-bottom:calc(env(safe-area-inset-bottom) + 10px)!important}.footer-inner{gap:7px!important;padding:7px}.footer button{width:43px;min-width:43px;height:43px!important}.footer button svg{width:20px;height:20px}}
    .logo{position:relative;background:transparent!important;box-shadow:0 18px 48px rgba(50,0,150,.34),0 0 30px rgba(98,122,255,.22)!important}.logo img{width:100%;height:100%;display:block;border-radius:inherit;object-fit:cover}.logo svg{display:none}
    .expense-types{grid-template-columns:1fr 1fr;gap:7px}.expense-btn{min-height:44px;border-radius:22px!important;display:flex;align-items:center;justify-content:center;gap:7px;padding:0 10px;font-size:13px}.expense-btn .expense-icon{width:18px;height:18px;font-size:17px;line-height:1;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.expense-btn.active{background:linear-gradient(135deg,#3b00a8,#9caeff)!important;color:#fff;box-shadow:0 12px 30px rgba(54,0,150,.42),inset 0 1px 0 rgba(216,225,255,.35)}.expense-field.hidden,.warehouse-field.hidden{display:none!important}.expense-save-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px}.expense-save-label{color:var(--muted);font-size:13px;font-weight:850}.expense-save-pill{min-width:126px;text-align:right;border:1px solid rgba(216,225,255,.16);border-radius:999px;background:rgba(255,255,255,.07);padding:10px 13px;color:#fff;font-size:18px;font-weight:900}.warehouse-grid{display:grid;gap:10px}.warehouse-two{display:grid;grid-template-columns:1fr 1fr;gap:9px}.warehouse-entry{display:grid;gap:7px}.warehouse-writeoff-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;align-items:end}.warehouse-entry .expense-btn,.warehouse-writeoff-row .expense-btn{width:100%}
    :root{--aqua:#4a00d8;--panel:rgba(8,2,24,.80);--panel2:rgba(20,7,48,.72);--line:rgba(216,225,255,.18);--soft:rgba(115,91,255,.10);--glow:#a1bdff}body{background:radial-gradient(circle at 50% 88%,rgba(74,0,216,.72),transparent 34%),radial-gradient(circle at 50% 40%,rgba(50,0,150,.40),transparent 42%),linear-gradient(180deg,#05010d 0%,#090018 56%,#320096 130%)}body:before{background:radial-gradient(ellipse at 50% 82%,rgba(90,0,220,.38),transparent 46%);filter:blur(18px)}.card{background:linear-gradient(180deg,rgba(15,6,35,.82),rgba(5,1,13,.82));border-color:rgba(161,189,255,.20);box-shadow:0 28px 80px rgba(0,0,0,.50),inset 0 1px 0 rgba(216,225,255,.10)}.price.active,.payment.active,.submit,.logout-btn,.close-btn{background:linear-gradient(135deg,#320096 0%,#4a00d8 54%,#a1bdff 135%)!important;box-shadow:0 18px 46px rgba(50,0,150,.42),inset 0 1px 0 rgba(216,225,255,.32)!important}.footer button.active{background:linear-gradient(135deg,#320096,#849bff)!important}.logo{box-shadow:0 18px 48px rgba(50,0,150,.42),0 0 30px rgba(161,189,255,.25)!important}
    .home-splash-brand{display:none}.logged-out{background:#080014!important}.logged-out:before{background:url("/voder-bg.png") center/cover no-repeat!important;filter:none!important;opacity:1}.logged-out:after{display:none}.logged-out main{padding:0!important;min-height:100svh}.logged-out .app{max-width:none;min-height:100svh}.logged-out header,.logged-out .footer{display:none!important}.logged-out #homePage{min-height:100svh}.logged-out #homePage>.panel{width:100%;min-height:100svh;margin:0;padding:0 24px calc(env(safe-area-inset-bottom) + 34px);border:0;border-radius:0;background:transparent;box-shadow:none;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:18px}.logged-out .home-panel-brand{display:none}.logged-out .home-splash-brand{display:grid;place-items:center;align-self:start;justify-self:center;width:min(72vw,320px);margin-top:28vh}.logged-out .home-splash-brand img{width:100%;height:auto;display:block;filter:drop-shadow(0 18px 42px rgba(26,0,70,.38))}.logged-out #homeLoggedOut{align-self:end;display:grid;gap:12px;width:100%;max-width:360px;margin:0 auto}.logged-out #showLoginButton,.logged-out #loginButton{height:56px!important;border-radius:999px!important;background:rgba(255,255,255,.92)!important;color:#21006a!important;box-shadow:0 22px 54px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.8)!important;font-size:16px}.logged-out #pinBlock{display:grid;gap:12px;padding:14px;border:1px solid rgba(255,255,255,.14);border-radius:26px;background:rgba(10,2,28,.62);box-shadow:0 22px 54px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.logged-out #pinBlock.hidden{display:none!important}.logged-out .pin-grid input{height:54px!important;border-radius:18px!important;background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.16);color:#fff}.logged-out #loginMessage{color:rgba(255,255,255,.58);text-align:center;font-size:11px}.logged-out #homeLoggedIn{display:none!important}
    :root{--device-top:max(env(safe-area-inset-top),44px);--device-bottom:max(env(safe-area-inset-bottom),12px);--footer-lift:calc(var(--device-bottom) + 12px);--footer-height:64px;--content-bottom:calc(var(--footer-height) + var(--footer-lift) + 18px)}
    html,body{min-height:100%;overflow-y:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior-y:auto}body{min-height:100dvh}main{min-height:100dvh!important;height:auto!important;padding:calc(var(--device-top) + 12px) 12px var(--content-bottom)!important;overflow-x:hidden;overflow-y:visible!important}.app{min-height:calc(100dvh - var(--device-top) - var(--content-bottom) - 12px)!important;height:auto!important;max-width:min(430px,calc(100vw - 20px))!important}header{position:relative;z-index:2;margin-bottom:14px!important;padding:0 2px!important}.logo{width:42px!important;height:42px!important;border-radius:16px!important}.brand{min-width:0}.brand>div:last-child{min-width:0}h1{font-size:clamp(18px,5vw,22px)!important}.sub{font-size:clamp(12px,3.4vw,14px)!important}.pill{flex-shrink:0}
    .page.active{min-height:0!important;height:auto!important;padding-bottom:4px;overflow:visible!important}.page>.card:last-child,form.card{margin-bottom:0!important}#workPage{min-height:0!important}#form{flex:0 0 auto!important;min-height:auto!important;max-height:none!important}.sum{margin-top:auto!important}#submit{flex-shrink:0}.footer{position:fixed!important;left:0!important;right:0!important;bottom:0!important;padding:0 12px var(--footer-lift)!important}.footer-inner{min-height:60px}.footer button{width:46px!important;min-width:46px!important;height:46px!important}
    @media (max-width:430px){main{padding-left:10px!important;padding-right:10px!important}.app{max-width:calc(100vw - 20px)!important}header{margin-bottom:12px!important}.destination-grid{grid-template-columns:minmax(0,1fr) 42px 42px!important}.prices,.payments{margin-top:8px!important}.sum{padding:10px!important}.footer{padding-bottom:var(--footer-lift)!important}.footer-inner{padding:7px!important}.footer button{width:43px!important;min-width:43px!important;height:43px!important}}
    @media (max-height:760px){:root{--device-top:max(env(safe-area-inset-top),42px);--footer-lift:calc(var(--device-bottom) + 10px);--content-bottom:calc(var(--footer-height) + var(--footer-lift) + 14px)}main{padding-top:calc(var(--device-top) + 10px)!important}header{margin-bottom:9px!important}.logo{width:38px!important;height:38px!important}h1{font-size:18px!important}.sub{font-size:12px!important}#form{min-height:auto!important}form,.panel{gap:7px!important;padding:10px!important}.prices,.payments{padding:6px!important;gap:6px!important;margin-top:6px!important}.price,.payment,.expense-btn,input,.cooler-btn{height:37px!important}.submit{height:41px!important}.destination-grid{grid-template-columns:minmax(0,1fr) 37px 37px!important;gap:6px!important}.quantity-grid{gap:6px!important}label span{margin-bottom:4px!important;font-size:11px!important}input{font-size:15px!important}.sum{padding:8px!important}.row+.row{margin-top:4px!important}.total{font-size:20px!important}.footer-inner{min-height:56px}.footer button{width:41px!important;min-width:41px!important;height:41px!important}.footer button svg{width:19px!important;height:19px!important}}
    @media (min-height:850px){#form{min-height:auto!important}}
    .logged-out main{padding:0!important}.logged-out #homePage>.panel{padding-bottom:calc(var(--device-bottom) + 34px)!important}
    .footer{height:0!important;min-height:0!important;background:none!important;background-color:transparent!important;box-shadow:none!important;border:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:visible!important}.footer:before,.footer:after{display:none!important}.footer-inner{background:linear-gradient(135deg,rgba(43,108,255,.38),rgba(146,196,255,.18) 58%,rgba(42,23,96,.34))!important;border:1px solid rgba(169,207,255,.28)!important;box-shadow:0 18px 46px rgba(18,50,145,.36),0 0 34px rgba(87,149,255,.20),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(25,55,160,.22)!important;backdrop-filter:blur(24px) saturate(145%)!important;-webkit-backdrop-filter:blur(24px) saturate(145%)!important}.footer button{color:rgba(226,238,255,.72)!important}.footer button.active{background:linear-gradient(135deg,#2d7cff 0%,#6ba9ff 58%,#b8d7ff 130%)!important;color:white!important;box-shadow:0 12px 30px rgba(70,142,255,.48),inset 0 1px 0 rgba(255,255,255,.34)!important}
    .boot-loader{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:radial-gradient(circle at 50% 78%,rgba(74,0,216,.62),transparent 36%),linear-gradient(180deg,#05010d,#180044 120%);transition:opacity .28s ease,visibility .28s ease}.boot-loader.hidden{opacity:0;visibility:hidden;pointer-events:none}.boot-loader-card{display:grid;place-items:center;gap:16px;color:white}.boot-loader img{width:92px;height:92px;border-radius:26px;box-shadow:0 24px 70px rgba(50,0,150,.46)}.loader-ring{width:42px;height:42px;border-radius:50%;border:3px solid rgba(255,255,255,.18);border-top-color:#a1bdff;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
    .report-tools{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.report-tools label{min-width:0}.mini-btn{height:44px;border:1px solid rgba(216,225,255,.18);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;font-size:12px;font-weight:900;padding:0 14px}.report-table{display:grid;gap:7px;overflow-x:auto;padding-bottom:2px}.report-row{display:grid;grid-template-columns:1.3fr .8fr .7fr .7fr .7fr .9fr;gap:6px;align-items:center;min-width:390px;padding:8px;border:1px solid rgba(216,225,255,.12);border-radius:14px;background:rgba(255,255,255,.055);font-size:11px}.report-row.head{color:#a1bdff;font-weight:900;background:rgba(161,189,255,.08)}.report-row b{font-size:12px}.report-row span,.report-row b{min-width:0;overflow:hidden;text-overflow:ellipsis}.client-table .report-row{grid-template-columns:1.25fr .55fr .55fr .55fr .9fr .55fr .65fr;min-width:470px}.client-table .report-row b.paid{color:#dbe8ff;font-size:12px}.client-table .method{display:inline-grid;place-items:center;min-width:42px;height:24px;border-radius:999px;background:rgba(161,189,255,.12);border:1px solid rgba(161,189,255,.18);font-weight:900;color:#fff}.report-row input{height:34px!important;font-size:13px!important;border-radius:12px!important;padding:0 8px}.report-row .danger-small{height:34px;border:0;border-radius:12px;background:rgba(255,80,106,.18);color:#ffb3bf;font-weight:900}.profit-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}.profit-card{padding:10px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}.profit-card span{display:block;color:var(--muted);font-size:11px;font-weight:800}.profit-card b{display:block;margin-top:4px;font-size:16px}.warehouse-debt{display:grid;gap:9px;padding:10px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}.paid-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .client-list{display:grid;gap:8px;min-width:0;max-width:100%}.client-table{min-width:0;max-width:100%;overflow:visible!important}.client-table .report-row{min-width:0!important;width:100%;grid-template-columns:minmax(0,1.1fr) auto auto;grid-template-areas:"name method cooler" "time time time" "sold returned paid" "writeoff writeoff writeoff";gap:7px 8px;padding:10px 11px}.client-table .report-row.head{display:none}.client-table .report-row>*{white-space:normal!important}.client-table .report-row>b:first-child{grid-area:name;font-size:14px;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}.client-time{grid-area:time;color:var(--muted);font-size:10px;font-weight:750;line-height:1.25;white-space:normal!important;overflow-wrap:anywhere}.client-table .method{grid-area:method;justify-self:end;min-width:48px;height:25px}.client-table .report-row>*:nth-child(4){grid-area:sold}.client-table .report-row>*:nth-child(5){grid-area:returned}.client-table .report-row>*:nth-child(6){grid-area:paid;justify-self:end;text-align:right}.client-table .report-row>*:nth-child(7){grid-area:writeoff}.client-table .report-row>*:nth-child(8){grid-area:cooler;justify-self:end;text-align:right}.client-table .report-row:not(.head)>*:nth-child(n+4)::before{display:block;color:var(--muted);font-size:9px;font-weight:800;line-height:1.1;margin-bottom:2px}.client-table .report-row:not(.head)>*:nth-child(4)::before{content:"Продал"}.client-table .report-row:not(.head)>*:nth-child(5)::before{content:"Забрал"}.client-table .report-row:not(.head)>*:nth-child(6)::before{content:"Оплатил"}.client-table .report-row:not(.head)>*:nth-child(7)::before{content:"Списания"}.client-toggle{justify-self:start;margin-top:2px}.expense-report-table .report-row{min-width:0!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.expense-report-table .report-row span:nth-last-child(-n+2),.expense-report-table .report-row b:nth-last-child(-n+2){display:none}.expense-report-table .report-row span,.expense-report-table .report-row b{font-size:10px!important;white-space:nowrap!important;text-overflow:ellipsis}.expense-report-table .report-row b{font-size:11px!important}.report-payments,.report-scope{display:grid;gap:8px}.report-payments{grid-template-columns:1fr 1fr}.report-scope{grid-template-columns:repeat(4,minmax(0,1fr))}.report-payments button,.report-scope button,.reset-btn{height:42px;border:1px solid rgba(216,225,255,.18);border-radius:999px;background:rgba(255,255,255,.08);color:#dbe8ff;font-size:12px;font-weight:900}.report-payments button.active,.report-scope button.active{background:linear-gradient(135deg,#320096,#849bff);color:white;box-shadow:0 12px 30px rgba(70,142,255,.30)}.reset-btn{margin-top:auto;background:rgba(255,80,106,.15);border-color:rgba(255,80,106,.30);color:#ffb3bf}.reset-btn:disabled{opacity:.55}.report-box{max-width:100%;overflow:hidden}.report-row small{display:block;margin-top:3px;color:var(--muted);font-size:10px;font-weight:750;line-height:1.2;white-space:normal;overflow-wrap:anywhere}.report-line span{min-width:0}.report-line b{white-space:normal!important;overflow-wrap:anywhere}#reportPage .panel,#auditPage .panel,#coolersPage .panel{padding-bottom:calc(var(--content-bottom) + 10px)!important}
  </style>
</head>
<body>
<div id="bootLoader" class="boot-loader"><div class="boot-loader-card"><img src="/icon.svg?v=2" alt="VODER" /><div class="loader-ring"></div></div></div>
<main><div class="app">
  <header><div class="brand"><div class="logo"><img src="/icon.svg" alt="VODER" /></div><div><h1 class="app-title">VODER <span id="channelBadge" class="channel-badge hidden">Павильон</span></h1><p class="sub">Продажа бутылок 19 л</p></div></div><div class="pill" id="shiftStatus">Москва</div></header>
  <section id="homePage" class="page active">
    <div class="card panel">
      <div class="home-splash-brand"><img src="/voder-logo.svg" alt="VODER" /></div>
      <div class="brand home-panel-brand"><div class="logo"><img src="/icon.svg" alt="VODER" /></div><div><h1 id="homeTitle">Главная</h1><p class="sub" id="homeSubtitle">Войдите для начала работы.</p></div></div>
      <div id="homeLoggedOut" class="home-actions">
        <button id="showLoginButton" class="submit" type="button">Вход</button>
        <div id="pinBlock" class="hidden">
          <label><span>Пароль</span></label>
          <div class="pin-grid">
            <input class="pin" inputmode="numeric" maxlength="1" />
            <input class="pin" inputmode="numeric" maxlength="1" />
            <input class="pin" inputmode="numeric" maxlength="1" />
            <input class="pin" inputmode="numeric" maxlength="1" />
          </div>
          <button id="loginButton" class="submit" type="button">Войти</button>
          <p id="loginMessage" class="hint" hidden></p>
        </div>
      </div>
      <div id="homeLoggedIn" class="home-actions hidden">
        <section id="adminAssets" class="admin-only hidden">
          <div class="report-box">
            <div class="report-line"><span>Активы бутылок</span><b id="assetTotal">0 шт.</b></div>
            <div class="asset-line"><span id="assetWarehouseLine" class="asset-line-warehouse"></span><span id="assetClientLine" class="asset-line-client"></span><span id="assetWriteoffLine" class="asset-line-writeoff"></span></div>
            <div class="asset-grid">
              <div class="asset-card"><div class="asset-icon">📦</div><div><div class="asset-title">На складе</div><div class="asset-sub">остаток и приход</div></div><div class="asset-value" id="assetWarehouse">0</div></div>
              <div class="asset-card"><div class="asset-icon">🏪</div><div><div class="asset-title">У клиентов</div><div class="asset-sub">выдано минус возврат</div></div><div class="asset-value" id="assetClients">0</div></div>
              <div class="asset-card"><div class="asset-icon">✕</div><div><div class="asset-title">Списанные</div><div class="asset-sub">брак и списания</div></div><div class="asset-value" id="assetWriteoff">0</div></div>
            </div>
            <p class="hint">Данные обновляются от продаж, возвратов и складских списаний.</p>
          </div>
        </section>
        <div id="closedSummary" class="closed-summary" hidden></div>
        <button id="openShiftButton" class="submit" type="button">Открыть смену</button>
        <button id="logoutButton" class="submit logout-btn" type="button">Выход</button>
        <button id="resetDataButton" class="reset-btn admin-only hidden" type="button">RESET</button>
        <p id="resetDataMessage" class="hint admin-only hidden"></p>
        <p id="openShiftMessage" class="hint">После открытия смены можно работать.</p>
      </div>
    </div>
  </section>

  <section id="workPage" class="page">
    <section class="card tabs"><div id="warehouse" class="tab">Склад</div><div id="pavilion" class="tab active">Павильон</div></section>
    <section id="warehouseMini" class="card work-kpi hidden"><div><span>📦 Продано бутылок</span><b id="miniBottles">0 шт.</b></div><div><span>💰 Расчет по 70</span><b id="miniEarning">0 руб.</b></div></section>
    <form id="form" class="card">
      <div class="destination-grid"><label class="destination-field"><span id="destinationLabel">Номер павильона</span><input id="destination" type="text" inputmode="text" placeholder="Например: 12" autocomplete="off" required /><div id="destinationSuggestions" class="suggestions hidden"></div></label><button id="coolerOur" class="cooler-btn our active" type="button">💧</button><button id="coolerNot" class="cooler-btn not" type="button">💧</button></div>
      <div class="quantity-grid">
        <label><span>Продал</span><input id="sold" inputmode="numeric" pattern="[0-9]*" placeholder="20" required /></label>
        <label id="returnedWrap"><span>Забрал</span><input id="returned" inputmode="numeric" pattern="[0-9]*" placeholder="3" /></label>
      </div>
      <section class="card prices"><button id="price200" class="price" type="button">200 руб.</button><button id="price250" class="price" type="button">250 руб.</button><button id="price300" class="price active" type="button">300 руб.</button></section>
      <section class="card payments"><button id="cash" class="payment active" type="button">НАЛ</button><button id="transfer" class="payment" type="button">БНАЛ</button></section>
      <div class="sum"><div class="row"><span>Цена</span><b id="priceText">300 руб. / бутылка</b></div><div class="row"><span>Итого</span><b class="total" id="total">0 руб.</b></div></div>
      <p id="message" hidden></p>
      <button id="submit" class="submit" type="submit">Сохранить продажу</button>
    </form>
  </section>

  <section id="expensesPage" class="page">
    <div class="card panel">
      <div class="expense-types">
        <button id="expenseParking" class="expense-btn active" type="button"><span class="expense-icon">🅿</span><span>Парковка</span></button>
        <button id="expenseStretch" class="expense-btn" type="button"><svg class="expense-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.5h8.5a5 5 0 0 1 0 10H6.5a5 5 0 0 1 0-10Z"/><path d="M6.5 8.5a5 5 0 0 1 0 10"/><path d="M6.5 12.5h8.5"/><path d="M6.5 16h7.2"/></svg><span>Стрейч</span></button>
        <button id="expenseSalary" class="expense-btn" type="button"><span class="expense-icon">₽</span><span>Зарплата</span></button>
        <button id="expenseOther" class="expense-btn" type="button"><span class="expense-icon">⋯</span><span>Прочие</span></button>
      </div>
      <p class="hint">Парковка и стрейч сохраняются фиксированной суммой. Комментарий нужен только для прочих расходов.</p>
      <form id="expenseForm">
        <label id="expenseSalaryWrap" class="expense-field hidden"><span>Сумма зарплаты</span><input id="expenseSalaryAmount" inputmode="numeric" pattern="[0-9]*" placeholder="Например: 4500" /></label>
        <label id="expenseOtherAmountWrap" class="expense-field hidden"><span>Сумма прочих</span><input id="expenseOtherAmount" inputmode="numeric" pattern="[0-9]*" placeholder="Например: 1200" /></label>
        <label id="expenseCommentWrap" class="expense-field hidden"><span>Комментарий</span><textarea id="expenseComment" placeholder="На что ушло"></textarea></label>
        <div class="expense-save-row"><span class="expense-save-label">К сохранению</span><b id="expensePreview" class="expense-save-pill">0 руб.</b></div>
        <p id="expenseMessage" hidden></p>
        <button id="expenseSubmit" class="submit" type="submit">Сохранить расход</button>
      </form>
    </div>
  </section>

  <section id="reportPage" class="page">
    <div class="card panel">
      <label id="reportFromWrap"><span>Дата с</span><input id="reportFrom" type="date" /></label>
      <label id="reportToWrap"><span>Дата по</span><input id="reportTo" type="date" /></label>
      <div class="report-tools"><label id="reportFilterWrap"><span>Фильтр павильон/склад</span><input id="reportFilter" type="text" inputmode="text" placeholder="Например: 12 или Основной" /></label><button id="reportEditButton" class="mini-btn hidden" type="button">ПРАВИТЬ</button></div>
      <div id="reportScopeFilter" class="report-scope admin-only hidden"><button id="scopeAll" class="active" type="button">Все</button><button id="scopeFloor1" type="button">Этаж 1</button><button id="scopeFloor2" type="button">Этаж 2</button><button id="scopeWarehouse" type="button">Склад</button></div>
      <div id="reportPaymentFilter" class="report-payments admin-only hidden"><button id="reportCashFilter" type="button">НАЛ</button><button id="reportTransferFilter" type="button">БНАЛ</button></div>
      <p id="employeeShiftInfo" class="shift-pill hidden"></p>
      <button id="reportButton" class="submit" type="button">РАССЧИТАТЬ</button>
      <div id="reportBox" class="report-box" hidden></div>
      <p id="reportMessage" hidden></p>
      <button id="reportCloseShiftButton" class="submit close-btn hidden" type="button">Закрыть смену</button>
    </div>
  </section>

  <section id="warehousePage" class="page admin-only hidden">
    <div class="card panel">
      <form id="warehouseForm">
        <div class="warehouse-grid">
          <div class="warehouse-two">
            <div class="warehouse-entry">
              <button id="warehouseArrival" class="expense-btn" type="button">Приход</button>
              <label id="warehouseArrivalWrap" class="warehouse-field hidden"><span>Количество</span><input id="warehouseArrivalQuantity" inputmode="numeric" pattern="[0-9]*" placeholder="100" /></label>
            </div>
            <div class="warehouse-entry">
              <button id="warehouseReturn" class="expense-btn" type="button">Возврат</button>
              <label id="warehouseReturnWrap" class="warehouse-field hidden"><span>Количество</span><input id="warehouseReturnQuantity" inputmode="numeric" pattern="[0-9]*" placeholder="20" /></label>
            </div>
          </div>
          <div class="warehouse-writeoff-row">
            <button id="warehouseWriteoff" class="expense-btn" type="button">Списание</button>
            <label id="warehouseWriteoffWrap" class="warehouse-field hidden"><span>Количество</span><input id="warehouseWriteoffQuantity" inputmode="numeric" pattern="[0-9]*" placeholder="5" /></label>
          </div>
        </div>
        <p id="warehouseMessage" hidden></p>
        <button id="warehouseSubmit" class="submit" type="submit">Сохранить склад</button>
      </form>
      <div id="warehouseDebtBox" class="warehouse-debt" hidden></div>
      <form id="warehousePaymentForm" class="warehouse-debt" hidden>
        <div class="report-section">Оплатил</div>
        <div class="paid-grid">
          <label><span>Нал</span><input id="warehousePaidCash" inputmode="numeric" pattern="[0-9]*" placeholder="0" /></label>
          <label><span>Безнал</span><input id="warehousePaidTransfer" inputmode="numeric" pattern="[0-9]*" placeholder="0" /></label>
        </div>
        <button id="warehousePaymentSubmit" class="submit" type="submit">Сохранить оплату</button>
        <p id="warehousePaymentMessage" hidden></p>
      </form>
    </div>
  </section>

  <section id="auditPage" class="page admin-only hidden">
    <div class="card panel">
      <label><span>Дата с</span><input id="auditFrom" type="date" /></label>
      <label><span>Дата по</span><input id="auditTo" type="date" /></label>
      <button id="auditButton" class="submit" type="button">Аудит за период</button>
      <div id="auditBox" class="report-box" hidden></div>
      <p id="auditMessage" hidden></p>
    </div>
  </section>

  <section id="coolersPage" class="page">
    <div class="card panel">
      <div class="report-box">
        <div class="report-line"><span>Наши кулеры</span><b id="coolerTotal">0 шт.</b></div>
        <label><span>Поиск павильона/склада</span><input id="coolerFilter" type="text" inputmode="text" placeholder="Например: Администрация" /></label>
        <div id="coolerList" class="cooler-list"></div>
        <button id="coolerToggle" class="mini-btn hidden" type="button">Развернуть</button>
        <p id="coolerMessage" class="hint">Список собирается из отметок сотрудников “кулер наш”.</p>
      </div>
    </div>
  </section>
</div></main>
<footer class="footer"><div class="footer-inner"><button id="navHome" class="active" type="button" aria-label="Главная" title="Главная"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h5v-5h3v5h5v-9.5"/></svg><span class="nav-label">Главная</span></button><button id="navWork" class="auth-only hidden" type="button" aria-label="Работа" title="Работа"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/></svg><span class="nav-label">Работа</span></button><button id="navExpenses" class="auth-only hidden" type="button" aria-label="Расходы" title="Расходы"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12"/><path d="M6 12h12"/><path d="M6 16h8"/><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5Z"/></svg><span class="nav-label">Расходы</span></button><button id="navReport" class="auth-only hidden" type="button" aria-label="Отчет" title="Отчет"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10"/><path d="M12 20V5"/><path d="M19 20v-7"/><path d="M3 20h18"/></svg><span class="nav-label">Отчет</span></button><button id="navWarehouse" class="admin-only hidden" type="button" aria-label="Склад" title="Склад"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10 12 5l8 5"/><path d="M5.5 10.5V20h13V10.5"/><path d="M9 20v-6h6v6"/></svg><span class="nav-label">Склад</span></button><button id="navCoolers" class="auth-only hidden" type="button" aria-label="Кулеры" title="Кулеры"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8"/><path d="M9 4v5l-2.5 4A5 5 0 0 0 11 20h2a5 5 0 0 0 4.5-7L15 9V4"/><path d="M9 13h6"/></svg><span class="nav-label">Кулеры</span></button><button id="navAudit" class="admin-only hidden" type="button" aria-label="Аудит" title="Аудит"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8"/><path d="M9 4v2a2 2 0 0 1-2 2H5v14h14V8h-2a2 2 0 0 1-2-2V4"/><path d="m8 15 2.5 2.5L16 12"/></svg><span class="nav-label">Аудит</span></button></div></footer>
<script>
let saleChannel = "pavilion";
let unitPrice = 300;
let paymentType = "cash";
let expenseType = "";
let selectedExpenses = new Set();
let selectedWarehouseEntries = new Set();
let coolerStatus = "our";
let appRole = localStorage.getItem("waterOpsRole") || "";
let appEmployee = localStorage.getItem("waterOpsEmployee") || "";
let employeeKind = localStorage.getItem("waterOpsEmployeeKind") || "pavilion";
let currentShift = JSON.parse(localStorage.getItem("waterOpsShift") || "null");
let lastClosedReport = localStorage.getItem("waterOpsLastClosedReport") || "";
let lastReportData = null;
let reportEditMode = false;
let adminReportPaymentFilter = "";
let adminReportScope = "all";
let destinationSuggestTimer = null;
let coolerRows = [];
let coolersExpanded = false;
let coolerFilterTimer = null;
const $ = (id) => document.getElementById(id);
function applyRoleState(){
  const loggedIn = appRole === "employee" || appRole === "admin";
  const hasOpenShift = appRole === "employee" && currentShift && !currentShift.closed_at;
  document.body.classList.toggle("logged-out", !loggedIn);
  applyEmployeeAccess();
  $("channelBadge").classList.toggle("hidden", appRole !== "employee");
  $("channelBadge").textContent = employeeKind === "warehouse" ? "Склад" : "Павильон";
  $("navHome").classList.toggle("hidden", !loggedIn);
  $("homeLoggedOut").classList.toggle("hidden", loggedIn);
  $("homeLoggedIn").classList.toggle("hidden", !loggedIn);
  $("homeSubtitle").textContent = loggedIn ? (appRole === "admin" ? "Режим админа." : appEmployee + ".") : "Войдите для начала работы.";
  $("openShiftButton").classList.toggle("hidden", appRole === "admin" || hasOpenShift);
  $("logoutButton").classList.toggle("hidden", !loggedIn);
  $("openShiftMessage").classList.toggle("hidden", appRole === "admin");
  $("reportFromWrap").classList.toggle("hidden", appRole === "employee");
  $("reportToWrap").classList.toggle("hidden", appRole === "employee");
  $("reportFilterWrap").classList.toggle("hidden", appRole !== "admin");
  $("reportEditButton").classList.toggle("hidden", !["employee","admin"].includes(appRole) || !lastReportData || !lastReportData.salesRows || !lastReportData.salesRows.length);
  $("employeeShiftInfo").classList.toggle("hidden", appRole !== "employee");
  $("reportButton").textContent = appRole === "employee" ? "РАССЧИТАТЬ" : "Расчет за период";
  document.querySelectorAll(".auth-only").forEach((node)=>node.classList.toggle("hidden", !loggedIn));
  $("navWork").classList.toggle("hidden", !loggedIn || appRole === "admin");
  $("navExpenses").classList.toggle("hidden", !loggedIn || appRole === "admin");
  $("reportCloseShiftButton").classList.toggle("hidden", appRole !== "employee" || !currentShift || currentShift.closed_at);
  document.querySelectorAll(".admin-only").forEach((node)=>node.classList.toggle("hidden", appRole !== "admin"));
  $("navAudit").classList.add("hidden");
  if (appRole === "admin" && (document.getElementById("workPage").classList.contains("active") || document.getElementById("expensesPage").classList.contains("active"))) {
    showPage("report");
  }
  if (!loggedIn) showPage("home");
}
function applyEmployeeAccess(){
  if(appRole !== "employee"){
    $("warehouse").classList.remove("hidden");
    $("pavilion").classList.remove("hidden");
    return;
  }
  if(employeeKind === "warehouse"){
    saleChannel = "warehouse";
    $("warehouse").classList.remove("hidden");
    $("pavilion").classList.add("hidden");
  } else {
    saleChannel = "pavilion";
    $("warehouse").classList.add("hidden");
    $("pavilion").classList.remove("hidden");
  }
}
function applyShiftState(){
  applyRoleState();
  const loggedIn = appRole === "employee" || appRole === "admin";
  if (!loggedIn) currentShift = null;
  $("shiftStatus").textContent = appRole === "admin" ? "Админ" : loggedIn && currentShift && !currentShift.closed_at ? "Смена открыта" : "Москва";
  if (loggedIn && currentShift && !currentShift.closed_at) {
    $("closedSummary").hidden = true;
    $("openShiftMessage").className = "shift-pill";
    $("openShiftMessage").textContent = "Смена открыта: " + currentShift.opened_at;
    $("employeeShiftInfo").textContent = "Открытая смена: " + currentShift.opened_date + " / " + currentShift.opened_at;
  } else if (appRole === "employee" && lastClosedReport) {
    $("closedSummary").hidden = true;
    $("closedSummary").innerHTML = "";
    $("employeeShiftInfo").textContent = "Последний закрытый отчет. Откройте новую смену, чтобы начать заново.";
  } else if (appRole === "employee") {
    $("closedSummary").hidden = true;
    $("closedSummary").innerHTML = "";
    $("employeeShiftInfo").textContent = "Откройте смену, чтобы получить итог.";
  }
}
function showPage(page){
  const loggedIn = appRole === "employee" || appRole === "admin";
  $("homePage").classList.toggle("active", page==="home");
  $("workPage").classList.toggle("active", page==="work");
  $("expensesPage").classList.toggle("active", page==="expenses");
  $("reportPage").classList.toggle("active", page==="report");
  $("warehousePage").classList.toggle("active", page==="warehouse" && appRole==="admin");
  $("coolersPage").classList.toggle("active", page==="coolers" && loggedIn);
  $("auditPage").classList.toggle("active", page==="audit" && appRole==="admin");
  $("navHome").classList.toggle("active", page==="home");
  $("navWork").classList.toggle("active", page==="work");
  $("navExpenses").classList.toggle("active", page==="expenses");
  $("navReport").classList.toggle("active", page==="report");
  $("navWarehouse").classList.toggle("active", page==="warehouse");
  $("navCoolers").classList.toggle("active", page==="coolers");
  $("navAudit").classList.toggle("active", page==="audit");
  if (page === "work" && appRole === "employee") loadWorkKpi();
  if (page === "home" && appRole === "admin") loadAssets();
  if (page === "warehouse" && appRole === "admin") loadWarehouseDebt();
  if (page === "coolers" && loggedIn) loadCoolers();
  if (page === "report" && appRole === "employee" && (!currentShift || currentShift.closed_at) && lastClosedReport) {
    $("reportBox").hidden = false;
    $("reportBox").innerHTML = lastClosedReport;
    $("reportMessage").hidden = true;
  }
}
function render(){
  $("warehouse").classList.toggle("active", saleChannel==="warehouse");
  $("pavilion").classList.toggle("active", saleChannel==="pavilion");
  document.querySelector(".prices").classList.remove("hidden");
  $("warehouseMini").classList.toggle("hidden", saleChannel!=="warehouse");
  $("price200").classList.toggle("active", unitPrice===200);
  $("price250").classList.toggle("active", unitPrice===250);
  $("price300").classList.toggle("active", unitPrice===300);
  $("cash").classList.toggle("active", paymentType==="cash");
  $("transfer").classList.toggle("active", paymentType==="transfer");
  $("reportCashFilter").classList.toggle("active", adminReportPaymentFilter === "cash");
  $("reportTransferFilter").classList.toggle("active", adminReportPaymentFilter === "transfer");
  $("scopeAll").classList.toggle("active", adminReportScope === "all");
  $("scopeFloor1").classList.toggle("active", adminReportScope === "floor1");
  $("scopeFloor2").classList.toggle("active", adminReportScope === "floor2");
  $("scopeWarehouse").classList.toggle("active", adminReportScope === "warehouse");
  $("coolerOur").classList.toggle("active", coolerStatus==="our");
  $("coolerNot").classList.toggle("active", coolerStatus==="not_our");
  $("destinationLabel").textContent = saleChannel==="warehouse" ? "Название склада" : "Номер павильона";
  $("destination").placeholder = saleChannel==="warehouse" ? "Например: Основной склад" : "Например: 12";
  $("destination").setAttribute("type", "text");
  $("destination").setAttribute("inputmode", "text");
  $("destination").removeAttribute("pattern");
  $("destination").setAttribute("autocomplete", "off");
  $("priceText").textContent = unitPrice + " руб. / бутылка";
  const sold = Number($("sold").value || 0);
  $("total").textContent = (sold * unitPrice) + " руб.";
}
function hideDestinationSuggestions(){
  $("destinationSuggestions").classList.add("hidden");
  $("destinationSuggestions").innerHTML = "";
}
async function loadDestinationSuggestions(){
  clearTimeout(destinationSuggestTimer);
  destinationSuggestTimer = setTimeout(async()=>{
    const query = $("destination").value.trim();
    if(!query){
      hideDestinationSuggestions();
      return;
    }
    const params = new URLSearchParams({ q: query, channel: saleChannel });
    const res = await fetch("/api/mobile/destinations?"+params.toString());
    const data = await res.json().catch(()=>({suggestions:[]}));
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    if(!res.ok || !suggestions.length){
      hideDestinationSuggestions();
      return;
    }
    $("destinationSuggestions").innerHTML = suggestions.map((name)=>
      '<button class="suggestion-btn" type="button" data-name="'+escapeHtml(name)+'">'+escapeHtml(name)+'</button>'
    ).join("");
    $("destinationSuggestions").classList.remove("hidden");
  }, 120);
}
function renderExpense(){
  $("expenseParking").classList.toggle("active", selectedExpenses.has("parking"));
  $("expenseStretch").classList.toggle("active", selectedExpenses.has("stretch"));
  $("expenseSalary").classList.toggle("active", selectedExpenses.has("salary"));
  $("expenseOther").classList.toggle("active", selectedExpenses.has("other"));
  $("expenseSalaryWrap").classList.toggle("hidden", !selectedExpenses.has("salary"));
  $("expenseOtherAmountWrap").classList.toggle("hidden", !selectedExpenses.has("other"));
  $("expenseCommentWrap").classList.toggle("hidden", !selectedExpenses.has("other"));
  $("expenseSalaryAmount").required = selectedExpenses.has("salary");
  $("expenseOtherAmount").required = selectedExpenses.has("other");
  $("expenseComment").required = selectedExpenses.has("other");
  $("expensePreview").textContent = money(calculateExpenseTotal());
}
function toggleExpense(type){
  if(selectedExpenses.has(type)) selectedExpenses.delete(type);
  else selectedExpenses.add(type);
  renderExpense();
}
function calculateExpenseTotal(){
  let total = 0;
  if(selectedExpenses.has("parking")) total += 1000;
  if(selectedExpenses.has("stretch")) total += 1900;
  if(selectedExpenses.has("salary")) total += Number($("expenseSalaryAmount").value || 0);
  if(selectedExpenses.has("other")) total += Number($("expenseOtherAmount").value || 0);
  return total;
}
function renderWarehouse(){
  $("warehouseArrival").classList.toggle("active", selectedWarehouseEntries.has("arrival"));
  $("warehouseReturn").classList.toggle("active", selectedWarehouseEntries.has("return"));
  $("warehouseWriteoff").classList.toggle("active", selectedWarehouseEntries.has("writeoff"));
  $("warehouseArrivalWrap").classList.toggle("hidden", !selectedWarehouseEntries.has("arrival"));
  $("warehouseReturnWrap").classList.toggle("hidden", !selectedWarehouseEntries.has("return"));
  $("warehouseWriteoffWrap").classList.toggle("hidden", !selectedWarehouseEntries.has("writeoff"));
  $("warehouseArrivalQuantity").required = selectedWarehouseEntries.has("arrival");
  $("warehouseReturnQuantity").required = selectedWarehouseEntries.has("return");
  $("warehouseWriteoffQuantity").required = selectedWarehouseEntries.has("writeoff");
}
function toggleWarehouseEntry(type){
  if(selectedWarehouseEntries.has(type)) selectedWarehouseEntries.delete(type);
  else selectedWarehouseEntries.add(type);
  renderWarehouse();
}
$("price200").onclick=()=>{unitPrice=200;render()};
$("price250").onclick=()=>{unitPrice=250;render()};
$("price300").onclick=()=>{unitPrice=300;render()};
$("cash").onclick=()=>{paymentType="cash";render()};
$("transfer").onclick=()=>{paymentType="transfer";render()};
$("reportCashFilter").onclick=()=>{adminReportPaymentFilter=adminReportPaymentFilter==="cash"?"":"cash";render();if(lastReportData)calculateReport()};
$("reportTransferFilter").onclick=()=>{adminReportPaymentFilter=adminReportPaymentFilter==="transfer"?"":"transfer";render();if(lastReportData)calculateReport()};
$("scopeAll").onclick=()=>{adminReportScope=adminReportScope==="all"?"all":"all";render();if(lastReportData)calculateReport()};
$("scopeFloor1").onclick=()=>{adminReportScope=adminReportScope==="floor1"?"all":"floor1";render();if(lastReportData)calculateReport()};
$("scopeFloor2").onclick=()=>{adminReportScope=adminReportScope==="floor2"?"all":"floor2";render();if(lastReportData)calculateReport()};
$("scopeWarehouse").onclick=()=>{adminReportScope=adminReportScope==="warehouse"?"all":"warehouse";render();if(lastReportData)calculateReport()};
$("coolerOur").onclick=()=>{coolerStatus="our";render()};
$("coolerNot").onclick=()=>{coolerStatus="not_our";render()};
$("sold").oninput=render;
$("destination").oninput=loadDestinationSuggestions;
$("destination").onfocus=loadDestinationSuggestions;
$("navHome").onclick=()=>showPage("home");
$("navWork").onclick=()=>showPage("work");
$("navExpenses").onclick=()=>showPage("expenses");
$("navReport").onclick=()=>showPage("report");
$("navWarehouse").onclick=()=>showPage("warehouse");
$("navCoolers").onclick=()=>showPage("coolers");
$("navAudit").onclick=()=>showPage("audit");
$("coolerFilter").oninput=()=>{
  clearTimeout(coolerFilterTimer);
  coolerFilterTimer = setTimeout(()=>loadCoolers(), 180);
};
$("coolerToggle").onclick=()=>{
  coolersExpanded = !coolersExpanded;
  renderCoolerList();
};
$("showLoginButton").onclick=()=>{
  $("showLoginButton").classList.add("hidden");
  $("pinBlock").classList.remove("hidden");
  $("loginMessage").hidden=true;
  $("loginMessage").textContent="";
  document.querySelector(".pin").focus();
};
document.querySelectorAll(".pin").forEach((input, index, inputs)=>{
  input.oninput=()=>{
    input.value=input.value.replace(/\\D/g,"").slice(0,1);
    if(input.value && inputs[index+1]) inputs[index+1].focus();
  };
  input.onkeydown=(event)=>{
    if(event.key==="Backspace" && !input.value && inputs[index-1]) inputs[index-1].focus();
  };
});
$("loginButton").onclick=async()=>{
  const password = Array.from(document.querySelectorAll(".pin")).map((input)=>input.value).join("");
  $("loginButton").disabled=true;
  const response = await fetch("/api/mobile/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password})});
  const data = await response.json();
  if(!response.ok){
    $("loginMessage").hidden=false;
    $("loginMessage").className="message err";
    $("loginMessage").textContent=data.error || "Неверный пароль";
    $("loginButton").disabled=false;
    return;
  }
  appRole = data.role;
  appEmployee = data.employeeName;
  employeeKind = data.employeeKind;
  saleChannel = data.saleChannel;
  localStorage.setItem("waterOpsRole", appRole);
  localStorage.setItem("waterOpsEmployee", appEmployee);
  localStorage.setItem("waterOpsEmployeeKind", employeeKind);
  document.querySelectorAll(".pin").forEach((input)=>input.value="");
  $("pinBlock").classList.add("hidden");
  $("showLoginButton").classList.remove("hidden");
  applyShiftState();
  render();
  if (appRole === "employee") showPage("work");
  if (appRole === "admin") loadAssets();
  $("loginButton").disabled=false;
};
$("logoutButton").onclick=()=>{
  appRole="";
  appEmployee="";
  employeeKind="pavilion";
  currentShift=null;
  localStorage.removeItem("waterOpsRole");
  localStorage.removeItem("waterOpsEmployee");
  localStorage.removeItem("waterOpsEmployeeKind");
  localStorage.removeItem("waterOpsShift");
  localStorage.removeItem("waterOpsLastClosedReport");
  lastClosedReport="";
  $("closedSummary").hidden=true;
  $("openShiftMessage").className="hint";
  $("openShiftMessage").textContent="Вы вышли. Для работы войдите снова.";
  showPage("home");
  applyShiftState();
};
$("resetDataButton").onclick=async()=>{
  if(appRole !== "admin") return;
  if(!confirm("Удалить все внесенные данные: продажи, отчеты, приходы, расходы, смены, списания и оплаты? Пароли и функции останутся.")) return;
  const password = prompt("Введите пароль администратора для RESET");
  if(password === null) return;
  $("resetDataButton").disabled = true;
  $("resetDataButton").textContent = "Очищаем...";
  $("resetDataMessage").className = "hint admin-only";
  $("resetDataMessage").textContent = "";
  const res = await fetch("/api/mobile/reset-data", {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if(res.ok){
    currentShift = null;
    lastClosedReport = "";
    lastReportData = null;
    reportEditMode = false;
    adminReportPaymentFilter = "";
    localStorage.removeItem("waterOpsShift");
    localStorage.removeItem("waterOpsLastClosedReport");
    $("reportBox").hidden = true;
    $("reportBox").innerHTML = "";
    $("auditBox").hidden = true;
    $("auditBox").innerHTML = "";
    $("warehouseDebtBox").hidden = true;
    $("warehousePaymentForm").hidden = true;
    $("resetDataMessage").className = "message ok admin-only";
    $("resetDataMessage").textContent = "Данные очищены.";
    await loadAssets();
    render();
  } else {
    $("resetDataMessage").className = "message err admin-only";
    $("resetDataMessage").textContent = data.error || "Не удалось очистить данные";
  }
  $("resetDataButton").disabled = false;
  $("resetDataButton").textContent = "RESET";
};
$("openShiftButton").onclick=async()=>{
  $("openShiftButton").disabled=true;$("openShiftButton").textContent="Открываем...";
  const res=await fetch("/api/mobile/shift/open",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({employeeName:appEmployee})});
  const data=await res.json();
  if(res.ok){
    currentShift=data.shift;
    localStorage.setItem("waterOpsShift", JSON.stringify(currentShift));
    localStorage.removeItem("waterOpsLastClosedReport");
    lastClosedReport="";
    $("closedSummary").hidden = true;
    $("reportBox").hidden = true;
    $("reportBox").innerHTML = "";
    $("openShiftMessage").className="shift-pill";
    $("openShiftMessage").textContent="Смена открыта: "+currentShift.opened_at;
    applyShiftState();
    showPage("work");
    calculateReport();
  } else {
    $("openShiftMessage").className="message err";
    $("openShiftMessage").textContent=data.error;
  }
  $("openShiftButton").disabled=false;$("openShiftButton").textContent="Открыть смену";
};
async function closeCurrentShift(){
  if(!currentShift || currentShift.closed_at){
    showPage("report");
    return;
  }
  if(!confirm("Закрыть смену и показать итог?")) return;
  $("reportCloseShiftButton").disabled=true;$("reportCloseShiftButton").textContent="...";
  const res=await fetch("/api/mobile/shift/close",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({shiftId:currentShift.id, shift: currentShift, role: appRole, employeeName: appEmployee})});
  const data=await res.json();
  if(res.ok){
    localStorage.removeItem("waterOpsShift");
    const shiftSummaryHtml = renderEmployeeReport(data.summary,
      '<div class="report-line"><span>Смена открыта</span><b>'+data.shift.opened_at+'</b></div>'+
      '<div class="report-line"><span>Смена закрыта</span><b>'+data.shift.closed_at+'</b></div>'
    );
    lastClosedReport = shiftSummaryHtml;
    localStorage.setItem("waterOpsLastClosedReport", lastClosedReport);
    currentShift=null;
    appRole="";
    appEmployee="";
    employeeKind="pavilion";
    localStorage.removeItem("waterOpsRole");
    localStorage.removeItem("waterOpsEmployee");
    localStorage.removeItem("waterOpsEmployeeKind");
    $("reportBox").hidden=false;
    $("reportBox").innerHTML = shiftSummaryHtml;
    $("closedSummary").hidden=true;
    $("closedSummary").innerHTML = "";
    $("openShiftMessage").className="hint";
    $("openShiftMessage").textContent="Войдите, чтобы открыть новую смену.";
    applyShiftState();
    showPage("home");
  } else {
    alert(data.error || "Не удалось закрыть смену");
  }
  $("reportCloseShiftButton").disabled=false;$("reportCloseShiftButton").textContent="Закрыть смену";
}
$("reportCloseShiftButton").onclick=closeCurrentShift;
$("expenseParking").onclick=()=>toggleExpense("parking");
$("expenseStretch").onclick=()=>toggleExpense("stretch");
$("expenseSalary").onclick=()=>toggleExpense("salary");
$("expenseOther").onclick=()=>toggleExpense("other");
$("expenseSalaryAmount").oninput=renderExpense;
$("expenseOtherAmount").oninput=renderExpense;
$("expenseComment").oninput=renderExpense;
$("warehouseArrival").onclick=()=>toggleWarehouseEntry("arrival");
$("warehouseReturn").onclick=()=>toggleWarehouseEntry("return");
$("warehouseWriteoff").onclick=()=>toggleWarehouseEntry("writeoff");
$("reportEditButton").onclick=async()=>{
  if(!lastReportData) return;
  if(!reportEditMode){
    reportEditMode = true;
    $("reportEditButton").textContent = "SAVE";
    $("reportBox").innerHTML = appRole === "admin"
      ? renderAdminReport(lastReportData, currentReportPrefix(), true)
      : renderEmployeeReport(lastReportData, currentReportPrefix(), true);
    return;
  }
  await saveReportEdits();
};
$("form").onsubmit=async(e)=>{
  e.preventDefault();
  if(appRole==="employee" && (!currentShift || currentShift.closed_at)){
    const message=$("message");message.hidden=false;message.className="message err";message.textContent="Сначала откройте смену.";
    return;
  }
  if(appRole==="employee" && employeeKind==="warehouse" && saleChannel!=="warehouse"){
    const message=$("message");message.hidden=false;message.className="message err";message.textContent="Для этого входа доступен только склад.";
    return;
  }
  if(appRole==="employee" && employeeKind!=="warehouse" && saleChannel==="warehouse"){
    const message=$("message");message.hidden=false;message.className="message err";message.textContent="Для этого входа доступен только павильон.";
    return;
  }
  $("submit").disabled=true;$("submit").textContent="Сохраняем...";
  const res=await fetch("/api/mobile/sales",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    saleChannel,
    destinationName:saleChannel==="warehouse"?$("destination").value:undefined,
    pavilionCode:saleChannel==="pavilion"?$("destination").value:undefined,
    unitPrice,
    paymentType,
    coolerStatus,
    employeeName: appEmployee,
    shiftId: currentShift ? currentShift.id : "",
    quantityDelivered:Number($("sold").value),
    quantityReturned:Number($("returned").value||0)
  })});
  const data=await res.json();
  const message=$("message");message.hidden=false;message.className=res.ok?"message ok":"message err";
  message.textContent=res.ok?("Сохранено: "+$("destination").value+", "+$("sold").value+" шт., сумма "+$("total").textContent):data.error;
  if(res.ok){$("destination").value="";$("sold").value="";$("returned").value="";render();loadWorkKpi()}
  $("submit").disabled=false;$("submit").textContent="Сохранить продажу";
};
$("expenseForm").onsubmit=async(e)=>{
  e.preventDefault();
  if(appRole==="employee" && (!currentShift || currentShift.closed_at)){
    const message=$("expenseMessage");message.hidden=false;message.className="message err";message.textContent="Сначала откройте смену.";
    return;
  }
  const entries = [];
  if(selectedExpenses.has("parking")) entries.push({ expenseType: "parking", amount: 1000, comment: "" });
  if(selectedExpenses.has("stretch")) entries.push({ expenseType: "stretch", amount: 1900, comment: "" });
  if(selectedExpenses.has("salary")) entries.push({ expenseType: "salary", amount: Number($("expenseSalaryAmount").value || 0), comment: "" });
  if(selectedExpenses.has("other")) entries.push({ expenseType: "other", amount: Number($("expenseOtherAmount").value || 0), comment: $("expenseComment").value });
  const invalid = entries.find((item)=>item.amount<=0 || (item.expenseType==="other" && !item.comment.trim()));
  const message=$("expenseMessage");message.hidden=false;
  if(!entries.length || invalid){
    message.className="message err";
    message.textContent=!entries.length ? "Выберите расход." : "Заполните сумму и комментарий для выбранного расхода.";
    return;
  }
  $("expenseSubmit").disabled=true;$("expenseSubmit").textContent="Сохраняем...";
  const results = await Promise.all(entries.map((entry)=>fetch("/api/mobile/expenses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    ...entry,
    employeeName: appEmployee,
    shiftId: currentShift ? currentShift.id : ""
  })}).then(async(res)=>({res,data:await res.json()}))));
  const failed = results.find((item)=>!item.res.ok);
  message.className=failed?"message err":"message ok";
  message.textContent=failed?(failed.data.error||"Не удалось сохранить расход"):("Расходы сохранены: "+money(entries.reduce((sum,item)=>sum+item.amount,0)));
  if(!failed){
    selectedExpenses.clear();
    $("expenseSalaryAmount").value="";
    $("expenseOtherAmount").value="";
    $("expenseComment").value="";
    renderExpense();
    loadWorkKpi();
  }
  $("expenseSubmit").disabled=false;$("expenseSubmit").textContent="Сохранить расход";
};
$("warehouseForm").onsubmit=async(e)=>{
  e.preventDefault();
  $("warehouseSubmit").disabled=true;$("warehouseSubmit").textContent="Сохраняем...";
  const entries = [];
  if(selectedWarehouseEntries.has("arrival")) entries.push({ entryType: "arrival", quantity: Number($("warehouseArrivalQuantity").value || 0), comment: "Приход" });
  if(selectedWarehouseEntries.has("return")) entries.push({ entryType: "return", quantity: Number($("warehouseReturnQuantity").value || 0), comment: "Возврат" });
  if(selectedWarehouseEntries.has("writeoff")) entries.push({ entryType: "writeoff", quantity: Number($("warehouseWriteoffQuantity").value || 0), comment: "Списание" });
  const message=$("warehouseMessage");message.hidden=false;
  if(!entries.length){
    message.className="message err";
    message.textContent="Выберите приход, возврат или списание.";
    $("warehouseSubmit").disabled=false;$("warehouseSubmit").textContent="Сохранить склад";
    return;
  }
  if(entries.some((item)=>item.quantity<=0)){
    message.className="message err";
    message.textContent="Введите количество для выбранных пунктов.";
    $("warehouseSubmit").disabled=false;$("warehouseSubmit").textContent="Сохранить склад";
    return;
  }
  const results = await Promise.all(entries.map((entry)=>fetch("/api/mobile/warehouse",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(entry)}).then(async(res)=>({res,data:await res.json()}))));
  const failed = results.find((item)=>!item.res.ok);
  message.className=failed?"message err":"message ok";
  message.textContent=failed?(failed.data.error||"Не удалось сохранить склад"):("Склад сохранен: "+entries.map((item)=>warehouseTypeName(item.entryType)+" "+item.quantity+" шт.").join(", "));
  if(!failed){
    $("warehouseArrivalQuantity").value="";
    $("warehouseReturnQuantity").value="";
    $("warehouseWriteoffQuantity").value="";
    selectedWarehouseEntries.clear();
    renderWarehouse();
  }
  if(!failed && appRole==="admin"){
    await loadAssets();
    await loadWarehouseDebt();
  }
  $("warehouseSubmit").disabled=false;$("warehouseSubmit").textContent="Сохранить склад";
};
$("warehousePaymentForm").onsubmit=async(e)=>{
  e.preventDefault();
  $("warehousePaymentSubmit").disabled=true;$("warehousePaymentSubmit").textContent="Сохраняем...";
  const res=await fetch("/api/mobile/warehouse/payment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    cashAmount:Number($("warehousePaidCash").value||0),
    transferAmount:Number($("warehousePaidTransfer").value||0)
  })});
  const data=await res.json();
  const message=$("warehousePaymentMessage");message.hidden=false;message.className=res.ok?"message ok":"message err";
  message.textContent=res.ok?"Оплата сохранена":(data.error||"Не удалось сохранить оплату");
  if(res.ok){$("warehousePaidCash").value="";$("warehousePaidTransfer").value="";await loadWarehouseDebt();}
  $("warehousePaymentSubmit").disabled=false;$("warehousePaymentSubmit").textContent="Сохранить оплату";
};
async function calculateReport(){
  if(appRole === "employee" && (!currentShift || currentShift.closed_at)){
    if(lastClosedReport){
      $("reportBox").hidden=false;
      $("reportBox").innerHTML=lastClosedReport;
      $("reportMessage").hidden=false;$("reportMessage").className="message ok";$("reportMessage").textContent="Показан последний закрытый отчет. Откройте новую смену, чтобы начать заново.";
    } else {
      $("reportBox").hidden=true;
      $("reportMessage").hidden=false;$("reportMessage").className="message err";$("reportMessage").textContent="Откройте смену, чтобы рассчитать итог.";
    }
    return;
  }
  $("reportButton").disabled=true;$("reportButton").textContent="Считаем...";
  $("reportMessage").hidden=true;
  reportEditMode=false;
  $("reportEditButton").textContent="ПРАВИТЬ";
  const from=appRole==="employee" ? currentShift.opened_date : $("reportFrom").value;
  const to=appRole==="employee" ? currentShift.opened_date : ($("reportTo").value || from);
  const params = new URLSearchParams({from, to, role: appRole});
  if(appRole==="admin" && $("reportFilter").value.trim()) params.set("filter", $("reportFilter").value.trim());
  if(appRole==="admin" && adminReportPaymentFilter) params.set("payment", adminReportPaymentFilter);
  if(appRole==="admin" && adminReportScope !== "all") params.set("scope", adminReportScope);
  if(appRole==="employee"){
    params.set("employeeName", appEmployee);
    params.set("shiftId", currentShift.id);
  }
  const res=await fetch("/api/mobile/report?"+params.toString());
  const data=await res.json();
  if(!res.ok){
    $("reportMessage").hidden=false;$("reportMessage").className="message err";$("reportMessage").textContent=data.error;
  } else {
    lastReportData = data;
    $("reportBox").hidden=false;
    const periodLine = currentReportPrefix(data);
    $("reportBox").innerHTML = appRole === "admin" ? renderAdminReport(data, periodLine) : renderEmployeeReport(data, periodLine, false);
    $("reportEditButton").classList.toggle("hidden", !["employee","admin"].includes(appRole) || !(data.salesRows || []).length);
  }
  $("reportButton").disabled=false;$("reportButton").textContent=appRole==="employee"?"РАССЧИТАТЬ":"Расчет за период";
}
$("reportButton").onclick=calculateReport;
async function loadWorkKpi(){
  if(!currentShift || currentShift.closed_at){
    $("miniBottles").textContent = "0 шт.";
    $("miniEarning").textContent = "0 руб.";
    return;
  }
  const params = new URLSearchParams({
    from: currentShift.opened_date,
    to: currentShift.opened_date,
    role: "employee",
    employeeName: appEmployee,
    shiftId: currentShift.id
  });
  const res = await fetch("/api/mobile/report?"+params.toString());
  const data = await res.json();
  if(!res.ok || !data.ok) return;
  $("miniBottles").textContent = Number(data.warehouseBottleTotal || 0).toLocaleString("ru-RU") + " шт.";
  $("miniEarning").textContent = money(data.warehouseServiceAmount);
}
async function loadCoolers(){
  const params = new URLSearchParams();
  if($("coolerFilter").value.trim()) params.set("filter", $("coolerFilter").value.trim());
  const res = await fetch("/api/mobile/coolers?"+params.toString());
  const data = await res.json();
  if(!res.ok || !data.ok){
    $("coolerMessage").className = "message err";
    $("coolerMessage").textContent = data.error || "Не удалось загрузить кулеры";
    return;
  }
  coolerRows = data.rows || [];
  coolersExpanded = false;
  $("coolerTotal").textContent = Number(data.total || 0).toLocaleString("ru-RU") + " шт.";
  $("coolerMessage").className = "hint";
  $("coolerMessage").textContent = coolerRows.length ? "Показаны точки, где последний статус кулера: наш." : "Наших кулеров по фильтру не найдено.";
  renderCoolerList();
}
function renderCoolerList(){
  const visible = coolersExpanded ? coolerRows : coolerRows.slice(0, 3);
  $("coolerList").innerHTML = visible.length
    ? visible.map((row)=>
      '<div class="asset-card cooler-card">'+
        '<div class="asset-icon">💧</div>'+
        '<div><div class="asset-title">'+escapeHtml(row.channel === "warehouse" ? "Склад" : "Павильон")+'</div><div class="asset-value">'+escapeHtml(row.name)+'</div><div class="asset-sub">'+escapeHtml(row.employeeName || "Сотрудник")+(row.date ? " · "+escapeHtml(row.date) : "")+'</div></div>'+
      '</div>'
    ).join("")
    : '<div class="report-line"><span>Список</span><b>нет данных</b></div>';
  $("coolerToggle").classList.toggle("hidden", coolerRows.length <= 3);
  $("coolerToggle").textContent = coolersExpanded ? "Свернуть" : "Развернуть еще " + Math.max(0, coolerRows.length - 3);
}
$("auditButton").onclick=async()=>{
  $("auditButton").disabled=true;$("auditButton").textContent="Считаем...";
  $("auditMessage").hidden=true;
  const from=$("auditFrom").value;
  const to=$("auditTo").value || from;
  const res=await fetch("/api/mobile/audit?from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to));
  const data=await res.json();
  if(!res.ok){
    $("auditMessage").hidden=false;$("auditMessage").className="message err";$("auditMessage").textContent=data.error;
  } else {
    const fixedItems = data.fixedExpenses.monthlyItems.map((item)=>"<li>"+item.name+": "+money(item.amount)+" / месяц</li>").join("");
    const warehouseItems = (data.warehouse || []).map((item)=>
      '<div class="report-line"><span>'+warehouseTypeName(item.entry_type)+'</span><b>'+Number(item.quantity||0)+' шт. '+escapeHtml(item.comment||'')+'</b></div>'
    ).join("") || '<div class="report-line"><span>Складские операции</span><b>нет</b></div>';
    $("auditBox").hidden=false;
    $("auditBox").innerHTML =
      '<div class="report-line"><span>Период</span><b>'+data.period.from+' — '+data.period.to+'</b></div>'+
      '<div class="report-section">Полный отчет</div>'+
      renderAdminReport(data.report, "")+
      '<div class="report-section">Складские операции</div>'+
      '<div class="report-line"><span>Приход</span><b>'+Number(data.warehouseSummary.arrival||0)+' шт.</b></div>'+
      '<div class="report-line"><span>Возврат</span><b>'+Number(data.warehouseSummary.return||0)+' шт.</b></div>'+
      '<div class="report-line"><span>Остаток</span><b>'+Number(data.warehouseSummary.remaining||0)+' шт.</b></div>'+
      '<div class="report-line"><span>Списание</span><b>'+Number(data.warehouseSummary.writeoff||0)+' шт.</b></div>'+
      warehouseItems+
      '<div class="report-section">Аудит</div>'+
      '<div class="report-line"><span>Зарплаты</span><b>'+money(data.salaryTotal)+'</b></div>'+
      '<div class="report-line"><span>Текущие расходы</span><b>'+money(data.variableExpenses)+'</b></div>'+
      '<div class="report-line"><span>Аренда/сервис</span><b>'+money(data.fixedExpenses.total)+'</b></div>'+
      '<ul class="fixed-list">'+fixedItems+'</ul>'+
      '<div class="report-line"><span>Итого расходы</span><b>'+money(data.expenseTotal)+'</b></div>'+
      '<div class="report-line"><span>Итог</span><b>'+money(data.profit)+'</b></div>';
  }
  $("auditButton").disabled=false;$("auditButton").textContent="Аудит за период";
};
document.addEventListener("click",(event)=>{
  const suggestion = event.target.closest(".suggestion-btn");
  if(suggestion){
    $("destination").value = suggestion.dataset.name || suggestion.textContent || "";
    hideDestinationSuggestions();
    $("destination").focus();
    return;
  }
  if(!event.target.closest(".destination-field")) hideDestinationSuggestions();
  const toggle = event.target.closest(".client-toggle");
  if(toggle){
    const wrapper = toggle.closest(".client-list");
    const extras = Array.from(wrapper?.querySelectorAll(".client-extra") || []);
    const expanded = toggle.dataset.expanded === "1";
    extras.forEach((row)=>row.classList.toggle("hidden", expanded));
    toggle.dataset.expanded = expanded ? "0" : "1";
    toggle.textContent = expanded ? "Развернуть еще "+extras.length : "Свернуть";
    return;
  }
  const button = event.target.closest(".delete-sale");
  if(!button) return;
  const row = button.closest("[data-sale-id]");
  if(!row) return;
  const deleted = row.dataset.delete === "1";
  row.dataset.delete = deleted ? "0" : "1";
  row.style.opacity = deleted ? "1" : ".45";
  button.textContent = deleted ? "Удалить" : "Вернуть";
});
async function saveReportEdits(){
  const rows = Array.from(document.querySelectorAll("[data-sale-id]"));
  $("reportEditButton").disabled = true;
  $("reportEditButton").textContent = "...";
  for(const row of rows){
    const id = row.dataset.saleId;
    if(!id) continue;
    if(row.dataset.delete === "1"){
      const res = await fetch("/api/mobile/sales/"+encodeURIComponent(id), { method: "DELETE" });
      if(!res.ok){ alert("Не удалось удалить запись"); $("reportEditButton").disabled=false; $("reportEditButton").textContent="SAVE"; return; }
      continue;
    }
    const unitPrice = Number(row.querySelector(".edit-price")?.value || 0);
    const quantitySold = Number(row.querySelector(".edit-sold")?.value || 0);
    const quantityReturned = Number(row.querySelector(".edit-returned")?.value || 0);
    const res = await fetch("/api/mobile/sales/"+encodeURIComponent(id), {
      method: "PATCH",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ unitPrice, quantitySold, quantityReturned })
    });
    if(!res.ok){ const data = await res.json().catch(()=>({})); alert(data.error || "Не удалось сохранить правки"); $("reportEditButton").disabled=false; $("reportEditButton").textContent="SAVE"; return; }
  }
  reportEditMode = false;
  $("reportEditButton").disabled = false;
  $("reportEditButton").textContent = "ПРАВИТЬ";
  await calculateReport();
}
async function loadWarehouseDebt(){
  const res = await fetch("/api/mobile/warehouse/debt");
  const data = await res.json();
  const box = $("warehouseDebtBox");
  const form = $("warehousePaymentForm");
  box.hidden = false;
  form.hidden = false;
  if(!res.ok || !data.ok){
    box.innerHTML = '<div class="message err">'+escapeHtml(data.error || "Не удалось загрузить долг склада")+'</div>';
    return;
  }
  box.innerHTML =
    '<div class="report-section">Общая сводка</div>'+
    '<div class="report-line"><span>Всего приняли</span><b>'+Number(data.bottles||0)+' шт.</b></div>'+
    '<div class="report-line"><span>Всего отправили</span><b>'+Number(data.sentBottles||0)+' шт.</b></div>'+
    '<div class="report-section">Долг за бутылки</div>'+
    '<div class="report-line"><span>Приход</span><b>'+Number(data.bottles||0)+' шт. × 120</b></div>'+
    '<div class="report-line"><span>Нал 115</span><b>'+money(data.cashRemaining)+' осталось</b></div>'+
    '<div class="report-line"><span>Безнал 5</span><b>'+money(data.transferRemaining)+' осталось</b></div>'+
    '<div class="report-line report-total"><span>Остаток долга</span><b>'+money(data.remainingTotal)+'</b></div>'+
    '<div class="report-mini"><div>💵 оплачено<b>'+money(data.cashPaid)+'</b></div><div>🏦 оплачено<b>'+money(data.transferPaid)+'</b></div></div>';
}
function parseAmount(text){
  const match=String(text).replace(/\\s/g,"").match(/\\d+(?:[.,]\\d+)?/);
  return match?Number(match[0].replace(",",".")):0;
}
function money(value){return Number(value||0).toLocaleString("ru-RU")+" руб."}
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#039;"}[char]));
}
function expenseName(category){
  return ({parking:"Парковка",salary:"Зарплата",fuel:"Топливо",other:"Расход"})[category] || "Расход";
}
function warehouseTypeName(type){
  return ({arrival:"Приход",return:"Возврат",remaining:"Остаток",writeoff:"Списание"})[type] || "Склад";
}
function paymentLabel(type){
  if(type === "cash") return "НАЛ";
  if(type === "transfer") return "БНАЛ";
  return "—";
}
function scopeLabel(scope){
  if(scope === "floor1") return "Этаж 1";
  if(scope === "floor2") return "Этаж 2";
  if(scope === "warehouse") return "Склад";
  return "Все";
}
function coolerLabel(status){
  if(status === "our") return "наш";
  if(status === "not_our") return "не наш";
  return "—";
}
function renderPriceRows(data){
  return (data.byPrice || []).map((item)=>
    '<div class="report-line"><span>'+item.price+' руб.</span><b>'+Number(item.bottles||0)+' шт. / '+money(item.amount)+'</b></div>'
  ).join("");
}
function renderExpenseRows(data){
  const items = data.expenseItems || [];
  if(!items.length) return '<div class="report-line"><span>Расходы</span><b>нет</b></div>';
  return items.map((item)=>{
    const title = escapeHtml(item.comment || expenseName(item.category));
    const pay = item.paymentType === "cash" ? "НАЛ" : "БНАЛ";
    return '<div class="report-line"><span>'+title+' · '+pay+'</span><b>'+money(item.amount)+'</b></div>';
  }).join("");
}
function currentReportPrefix(data = lastReportData){
  return appRole === "employee"
    ? '<div class="report-line"><span>Сотрудник</span><b>'+escapeHtml(appEmployee)+'</b></div>'+
      '<div class="report-line"><span>Дата смены</span><b>'+(currentShift ? currentShift.opened_date : data?.period?.from || "")+'</b></div>'+
      '<div class="report-line"><span>Открыта</span><b>'+(currentShift ? currentShift.opened_at : "")+'</b></div>'
    : '<div class="report-line"><span>Период</span><b>'+data.period.from+' — '+data.period.to+'</b></div>'+
      (data.paymentFilter ? '<div class="report-line"><span>Оплата</span><b>'+paymentLabel(data.paymentFilter)+'</b></div>' : '<div class="report-line"><span>Оплата</span><b>Общий</b></div>')+
      '<div class="report-line"><span>Раздел</span><b>'+scopeLabel(data.scope || adminReportScope)+'</b></div>'+
      (data.filter ? '<div class="report-line"><span>Фильтр</span><b>'+escapeHtml(data.filter)+'</b></div>' : '');
}
function renderEditableSales(data){
  const rows = data.salesRows || [];
  if(!rows.length) return '<div class="report-line"><span>Поставки</span><b>нет</b></div>';
  return '<div class="report-table">'+
    '<div class="report-row head"><span>Клиент</span><span>Цена</span><span>Продал</span><span>Забрал</span><span>Сумма</span><span></span></div>'+
    rows.map((row)=>
      '<div class="report-row" data-sale-id="'+escapeHtml(row.id || '')+'">'+
        '<b>'+escapeHtml(row.destination)+'<small>'+escapeHtml(row.dateTime || row.date || "")+'</small></b>'+
        '<input class="edit-price" inputmode="numeric" value="'+Number(row.unitPrice||0)+'" />'+
        '<input class="edit-sold" inputmode="numeric" value="'+Number(row.quantitySold||0)+'" />'+
        '<input class="edit-returned" inputmode="numeric" value="'+Number(row.quantityReturned||0)+'" />'+
        '<b>'+money(row.amount)+'</b>'+
        '<button class="danger-small delete-sale" type="button">Удалить</button>'+
      '</div>'
    ).join("")+
  '</div>';
}
function renderEmployeeReport(data, prefix, editable=false){
  return prefix+
    (editable ? '<div class="report-section">Правка поставок</div>'+renderEditableSales(data) : '')+
    '<div class="report-section">Бутылки</div>'+
    '<div class="report-line"><span>Сдано всего</span><b>'+Number(data.bottleTotal||0)+' шт.</b></div>'+
    '<div class="report-line"><span>Забрали обратно</span><b>'+Number(data.returnedTotal||0)+' шт.</b></div>'+
    renderPriceRows(data)+
    '<div class="report-section">Расходы</div>'+
    renderExpenseRows(data)+
    '<div class="report-line"><span>Всего расходы</span><b>'+money(data.expenseTotal)+'</b></div>'+
    '<div class="report-line"><span>Расход бутылки 120</span><b>'+money(data.bottleCostTotal)+'</b></div>'+
    '<div class="report-section">Деньги</div>'+
    '<div class="report-line"><span>Заплатили наличными</span><b>'+money(data.cashIncome)+'</b></div>'+
    '<div class="report-line"><span>Заплатили безналом</span><b>'+money(data.transferIncome)+'</b></div>'+
    '<div class="report-line"><span>Общий заработок</span><b>'+money(data.income)+'</b></div>'+
    '<div class="report-line report-total"><span>Итог после расходов</span><b>'+money(data.profit ?? data.factTotal)+'</b></div>'+
    '<div class="report-mini"><div>💵 Наличные<b>'+money(data.cashBalance)+'</b></div><div>🏦 Безнал<b>'+money(data.transferBalance)+'</b></div></div>';
}
function renderClientTable(data){
  const rows = data.clientRows || [];
  if(!rows.length) return '<div class="report-line"><span>Клиенты</span><b>нет данных</b></div>';
  const hiddenCount = Math.max(0, rows.length - 5);
  return '<div class="client-list">'+
  '<div class="report-table client-table">'+
    '<div class="report-row head"><span>Клиент</span><span>Метод</span><span>Продал</span><span>Забрал</span><span>Оплатил</span><span>Спис.</span><span>Кулер</span></div>'+
    rows.map((row,index)=>
      '<div class="report-row '+(index >= 5 ? 'client-extra hidden' : '')+'">'+
        '<b>'+escapeHtml(row.name)+'</b>'+
        '<span class="method">'+paymentLabel(row.paymentType)+'</span>'+
        '<span class="client-time">'+escapeHtml((row.saleTimes || []).slice(0,4).join(", ") || "дата не указана")+'</span>'+
        '<b>'+Number(row.sold||0)+'</b>'+
        '<b>'+Number(row.returned||0)+'</b>'+
        '<b class="paid">'+money(row.amount)+'</b>'+
        '<b>'+Number(row.writeoffs||0)+'</b>'+
        '<span>'+coolerLabel(row.coolerStatus)+'</span>'+
      '</div>'
    ).join("")+
  '</div>'+
  (hiddenCount ? '<button class="mini-btn client-toggle" type="button" data-expanded="0">Развернуть еще '+hiddenCount+'</button>' : '')+
  '</div>';
}
function renderExpenseTable(data){
  const byType = { stretch: 0, parking: 0, salary: 0, other: 0 };
  for(const item of data.expenseItems || []){
    const comment = String(item.comment || "").toLowerCase();
    if(item.category === "parking") byType.parking += Number(item.amount || 0);
    else if(item.category === "salary") byType.salary += Number(item.amount || 0);
    else if(comment.includes("стрейч")) byType.stretch += Number(item.amount || 0);
    else byType.other += Number(item.amount || 0);
  }
  return '<div class="report-table expense-report-table">'+
    '<div class="report-row head"><span>Стрейч</span><span>Парковка</span><span>Зарплата</span><span>Прочее</span><span></span><span></span></div>'+
    '<div class="report-row"><b>'+money(byType.stretch)+'</b><b>'+money(byType.parking)+'</b><b>'+money(byType.salary)+'</b><b>'+money(byType.other)+'</b><span></span><span></span></div>'+
  '</div>';
}
function renderProfitTable(data){
  return '<div class="profit-cards">'+
    '<div class="profit-card"><span>Продали</span><b>'+Number(data.bottleTotal||0)+' шт.</b></div>'+
    '<div class="profit-card"><span>Забрали</span><b>'+Number(data.returnedTotal||0)+' шт.</b></div>'+
    '<div class="profit-card"><span>Оборот</span><b>'+money(data.income)+'</b></div>'+
    '<div class="profit-card"><span>Расходы</span><b>'+money(data.expenseTotal)+'</b></div>'+
    '<div class="profit-card"><span>Расход бутылки 120</span><b>'+money(data.bottleCostTotal)+'</b></div>'+
    '<div class="profit-card"><span>Чистая прибыль</span><b>'+money(data.profit ?? data.factTotal)+'</b></div>'+
    '<div class="profit-card"><span>💵 / 🏦</span><b>'+money(data.cashIncome)+' / '+money(data.transferIncome)+'</b></div>'+
  '</div>';
}
function renderWarehouseDebtReport(data){
  const debt = data.warehouseDebt || {};
  return '<div class="report-line"><span>Приход по 120</span><b>'+Number(debt.bottles||0)+' шт. / '+money(debt.totalDebt)+'</b></div>'+
    '<div class="report-line"><span>Долг наличными 115</span><b>'+money(debt.cashRemaining)+' из '+money(debt.cashDebt)+'</b></div>'+
    '<div class="report-line"><span>Долг безнал 5</span><b>'+money(debt.transferRemaining)+' из '+money(debt.transferDebt)+'</b></div>'+
    '<div class="report-line report-total"><span>Остаток долга</span><b>'+money(debt.remainingTotal)+'</b></div>';
}
function renderAdminReport(data, prefix, editable=false){
  return prefix+
    (editable ? '<div class="report-section">Правка поставок</div>'+renderEditableSales(data) : '')+
    '<div class="report-section">Таблица клиенты</div>'+
    renderClientTable(data)+
    '<div class="report-section">Расходы сотрудников</div>'+
    renderExpenseTable(data)+
    '<div class="report-section">Таблица прибыли</div>'+
    renderProfitTable(data)+
    '<div class="report-section">Склад и долг за бутылки</div>'+
    renderWarehouseDebtReport(data);
}
async function loadAssets(){
  const res = await fetch("/api/mobile/assets");
  const data = await res.json();
  if(!res.ok || !data.ok) return;
  const total = Math.max(1, Number(data.totalTracked || 0));
  $("assetTotal").textContent = Number(data.totalTracked || 0).toLocaleString("ru-RU") + " шт.";
  $("assetWarehouse").textContent = Number(data.warehouseRemaining || 0).toLocaleString("ru-RU");
  $("assetClients").textContent = Number(data.clientBottles || 0).toLocaleString("ru-RU");
  $("assetWriteoff").textContent = Number(data.writtenOff || 0).toLocaleString("ru-RU");
  $("assetWarehouseLine").style.width = Math.round(Number(data.warehouseRemaining || 0) / total * 100) + "%";
  $("assetClientLine").style.width = Math.round(Number(data.clientBottles || 0) / total * 100) + "%";
  $("assetWriteoffLine").style.width = Math.round(Number(data.writtenOff || 0) / total * 100) + "%";
}
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
$("reportFrom").value=today;$("reportTo").value=today;
$("auditFrom").value=today;$("auditTo").value=today;
render();
renderExpense();
renderWarehouse();
applyShiftState();
render();
if (appRole === "admin") loadAssets();
window.addEventListener("load", () => {
  setTimeout(() => $("bootLoader")?.classList.add("hidden"), 350);
});
setTimeout(() => $("bootLoader")?.classList.add("hidden"), 1800);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
</script>
</body>
</html>`;
}
