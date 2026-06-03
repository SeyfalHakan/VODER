"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Droplets, Landmark, Loader2, Store, Undo2 } from "lucide-react";
import { clsx } from "clsx";

type SaleChannel = "warehouse" | "pavilion";

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

export default function EmployeeMobilePage() {
  const [saleChannel, setSaleChannel] = useState<SaleChannel>("pavilion");
  const [unitPrice, setUnitPrice] = useState(300);
  const [paymentType, setPaymentType] = useState<"cash" | "transfer">("cash");
  const [destinationName, setDestinationName] = useState("");
  const [quantityDelivered, setQuantityDelivered] = useState("");
  const [quantityReturned, setQuantityReturned] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "" });

  const total = useMemo(() => Number(quantityDelivered || 0) * unitPrice, [quantityDelivered, unitPrice]);

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ status: "saving", message: "Сохраняем продажу..." });

    const response = await fetch("/api/mobile/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saleChannel,
        destinationName: saleChannel === "warehouse" ? destinationName : undefined,
        pavilionCode: saleChannel === "pavilion" ? destinationName : undefined,
        quantityDelivered: Number(quantityDelivered),
        quantityReturned: saleChannel === "pavilion" ? Number(quantityReturned || 0) : 0,
        unitPrice,
        paymentType
      })
    });

    const result = await response.json();
    if (!response.ok) {
      setSaveState({ status: "error", message: result.error ?? "Не удалось сохранить" });
      return;
    }

    setSaveState({
      status: "saved",
      message: `${saleChannel === "warehouse" ? "Склад" : "Павильон"}: ${destinationName}. Продано ${quantityDelivered} шт. Сумма ${total} руб.`
    });
    setDestinationName("");
    setQuantityDelivered("");
    setQuantityReturned("");
  }

  return (
    <main className="min-h-screen bg-soft px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+16px)]">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-md flex-col">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-aqua text-white shadow-soft">
              <Droplets size={24} />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-ink">Учет воды</h1>
              <p className="text-sm text-muted">Продажа бутылок 19 л</p>
            </div>
          </div>
          <span className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-muted">Москва</span>
        </header>

        <section className="rounded-lg border border-line bg-white p-3 shadow-soft">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setSaleChannel("warehouse");
                setUnitPrice(250);
              }}
              className={channelButtonClass(saleChannel === "warehouse")}
            >
              <Landmark size={22} />
              Склад
            </button>
            <button
              type="button"
              onClick={() => {
                setSaleChannel("pavilion");
                setUnitPrice(300);
              }}
              className={channelButtonClass(saleChannel === "pavilion")}
            >
              <Store size={22} />
              Павильон
            </button>
          </div>
        </section>

        <section className="mt-3 rounded-lg border border-line bg-white p-3 shadow-soft">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setUnitPrice(250)} className={priceButtonClass(unitPrice === 250)}>
              250 руб.
            </button>
            <button type="button" onClick={() => setUnitPrice(300)} className={priceButtonClass(unitPrice === 300)}>
              300 руб.
            </button>
          </div>
        </section>

        <section className="mt-3 rounded-lg border border-line bg-white p-3 shadow-soft">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPaymentType("cash")} className={priceButtonClass(paymentType === "cash")}>
              НАЛ
            </button>
            <button type="button" onClick={() => setPaymentType("transfer")} className={priceButtonClass(paymentType === "transfer")}>
              БЕЗНАЛ
            </button>
          </div>
        </section>

        <form onSubmit={submitSale} className="mt-4 flex flex-1 flex-col gap-4 rounded-lg border border-line bg-white p-4 shadow-soft">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted">
              {saleChannel === "warehouse" ? "Склад / клиент" : "Номер павильона"}
            </span>
            <input
              value={destinationName}
              onChange={(event) => setDestinationName(event.target.value)}
              inputMode={saleChannel === "pavilion" ? "numeric" : "text"}
              className="h-14 w-full rounded-lg border border-line bg-white px-4 text-lg font-semibold text-ink outline-none focus:border-aqua"
              placeholder={saleChannel === "warehouse" ? "Например: Фудсити" : "Например: 12"}
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted">Продано / оставлено бутылок 19 л</span>
            <input
              value={quantityDelivered}
              onChange={(event) => setQuantityDelivered(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              className="h-14 w-full rounded-lg border border-line bg-white px-4 text-lg font-semibold text-ink outline-none focus:border-aqua"
              placeholder="Например: 20"
              required
            />
          </label>

          {saleChannel === "pavilion" ? (
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                <Undo2 size={16} />
                Сколько забрал обратно
              </span>
              <input
                value={quantityReturned}
                onChange={(event) => setQuantityReturned(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                className="h-14 w-full rounded-lg border border-line bg-white px-4 text-lg font-semibold text-ink outline-none focus:border-aqua"
                placeholder="Например: 3"
              />
            </label>
          ) : null}

          <div className="mt-auto rounded-lg bg-soft px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Цена</span>
              <span className="font-semibold text-ink">{unitPrice} руб. / бутылка</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Итого</span>
              <span className="text-2xl font-semibold text-ink">{total} руб.</span>
            </div>
          </div>

          {saveState.message ? (
            <p
              className={clsx(
                "rounded-lg px-3 py-2 text-sm",
                saveState.status === "error" ? "bg-red-50 text-danger" : "bg-emerald-50 text-emerald-700"
              )}
            >
              {saveState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saveState.status === "saving"}
            className="flex h-14 items-center justify-center gap-2 rounded-lg bg-aqua px-4 text-base font-semibold text-white shadow-soft disabled:opacity-70"
          >
            {saveState.status === "saving" ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            Сохранить продажу
          </button>
        </form>
      </div>
    </main>
  );
}

function channelButtonClass(active: boolean) {
  return clsx(
    "flex h-20 flex-col items-center justify-center gap-2 rounded-lg border text-base font-semibold",
    active ? "border-aqua bg-aqua text-white" : "border-line bg-white text-muted"
  );
}

function priceButtonClass(active: boolean) {
  return clsx(
    "flex h-14 items-center justify-center rounded-lg border text-base font-semibold",
    active ? "border-aqua bg-aqua text-white" : "border-line bg-white text-muted"
  );
}
